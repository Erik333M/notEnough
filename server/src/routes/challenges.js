import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import {
  canEnterChallenge,
  canManageChallenge,
  canViewTeam,
  isCoach,
} from '../permissions.js';
import { requireChallengeInput, requireScore } from '../validate.js';

/**
 * Challenges, and the rankings they produce.
 *
 * A challenge is a window and a number. The number is worked out on the
 * athlete's own device from their own data and submitted here; the server
 * never learns what it was derived from, so a leaderboard cannot be read back
 * into anybody's training. A score of 6 is a score of 6.
 *
 * Joining is the whole of the consent. A member who has not joined has no
 * entry, no score and no row on the board — a ranking is something you opt
 * into, never something that happens to you because you are on a roster.
 */
export const challengesRouter = Router();

challengesRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that challenge.' });

/**
 * The board, highest first.
 *
 * Ties keep their order rather than being broken by id or by who joined first:
 * two people on the same score are on the same score, and inventing a
 * separation between them would be the server making something up.
 */
function boardFor(data, challengeId) {
  return data.entries
    .filter((row) => row.challengeId === challengeId)
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((row, index, all) => ({
      ...row,
      // Standard competition ranking: equal scores share a place, and the next
      // score takes the place its position implies.
      rank: all.findIndex((other) => other.score === row.score) + 1,
    }));
}

/* ------------------------------------------------------ on a team */

/** Create one. Coaches of that team. */
challengesRouter.post('/:teamId/challenges', async (req, res, next) => {
  try {
    const input = requireChallengeInput(req.body);
    const { teamId } = req.params;
    const userId = req.user.id;

    const created = await write((data) => {
      if (!isCoach(data, userId, teamId)) return null;
      const challenge = {
        id: crypto.randomUUID(),
        teamId,
        ...input,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        archived: false,
      };
      data.challenges.push(challenge);
      return challenge;
    });

    if (!created) return forbidden(res);
    return res.status(201).json({ challenge: created, entries: [] });
  } catch (error) {
    return next(error);
  }
});

/** Everything running for a team, plus whether you are in it. */
challengesRouter.get('/:teamId/challenges', async (req, res, next) => {
  try {
    const data = await read();
    const { teamId } = req.params;
    const userId = req.user.id;
    if (!canViewTeam(data, userId, teamId)) return forbidden(res);

    const challenges = data.challenges
      .filter((row) => row.teamId === teamId && !row.archived)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((challenge) => {
        const entries = data.entries.filter((row) => row.challengeId === challenge.id);
        const mine = entries.find((row) => row.userId === userId) ?? null;
        return {
          challenge,
          joined: mine !== null,
          myScore: mine?.score ?? 0,
          entrants: entries.length,
        };
      });

    return res.json({ challenges });
  } catch (error) {
    return next(error);
  }
});

/* --------------------------------------------------- one challenge */

/** Detail and full board. Any member of the team, joined or not. */
challengesRouter.get('/detail/:challengeId', async (req, res, next) => {
  try {
    const data = await read();
    const challenge = data.challenges.find((row) => row.id === req.params.challengeId);
    if (!challenge || !canViewTeam(data, req.user.id, challenge.teamId)) return forbidden(res);

    return res.json({
      challenge,
      entries: boardFor(data, challenge.id),
      role: isCoach(data, req.user.id, challenge.teamId) ? 'coach' : 'athlete',
    });
  } catch (error) {
    return next(error);
  }
});

/** Join. Idempotent — a second tap is a double tap, not a reset. */
challengesRouter.post('/detail/:challengeId/join', async (req, res, next) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;
    const name = req.user.name;

    const outcome = await write((data) => {
      const challenge = data.challenges.find((row) => row.id === challengeId);
      if (!canEnterChallenge(data, userId, challenge)) return { error: 'forbidden' };

      const existing = data.entries.find(
        (row) => row.challengeId === challengeId && row.userId === userId,
      );
      if (existing) return { entry: existing };

      const entry = {
        id: crypto.randomUUID(),
        challengeId,
        userId,
        // Captured on joining, so a later rename does not rewrite a finished board.
        name,
        score: 0,
        updatedAt: new Date().toISOString(),
      };
      data.entries.push(entry);
      return { entry };
    });

    if (outcome.error) return forbidden(res);
    return res.json({ entry: outcome.entry });
  } catch (error) {
    return next(error);
  }
});

/**
 * Leave, taking your score with you.
 *
 * Nothing of yours is kept behind on the board. Someone who decides a ranking
 * is not for them should be able to step off it completely.
 */
challengesRouter.delete('/detail/:challengeId/leave', async (req, res, next) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;

    await write((data) => {
      data.entries = data.entries.filter(
        (row) => !(row.challengeId === challengeId && row.userId === userId),
      );
    });

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

/**
 * Report your score.
 *
 * Only your own, and only into a challenge you joined. The number arrives
 * already computed — the server has no way to check it and does not pretend
 * to. In a squad where the coach knows everyone, that is the right trade
 * against uploading the training it came from.
 */
challengesRouter.put('/detail/:challengeId/score', async (req, res, next) => {
  try {
    const score = requireScore(req.body?.score);
    const { challengeId } = req.params;
    const userId = req.user.id;

    const outcome = await write((data) => {
      const challenge = data.challenges.find((row) => row.id === challengeId);
      if (!canEnterChallenge(data, userId, challenge)) return { error: 'forbidden' };

      const entry = data.entries.find(
        (row) => row.challengeId === challengeId && row.userId === userId,
      );
      if (!entry) return { error: 'not_joined' };

      entry.score = score;
      entry.updatedAt = new Date().toISOString();
      return { entry };
    });

    if (outcome.error === 'not_joined') {
      return res
        .status(409)
        .json({ error: 'not_joined', message: 'Join the challenge before reporting a score.' });
    }
    if (outcome.error) return forbidden(res);
    return res.json({ entry: outcome.entry });
  } catch (error) {
    return next(error);
  }
});

/** Close one. Coaches only; entries stay so the result can still be read. */
challengesRouter.patch('/detail/:challengeId', async (req, res, next) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.id;
    const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : null;

    const updated = await write((data) => {
      const challenge = data.challenges.find((row) => row.id === challengeId);
      if (!canManageChallenge(data, userId, challenge)) return null;
      if (archived !== null) challenge.archived = archived;
      return challenge;
    });

    if (!updated) return forbidden(res);
    return res.json({ challenge: updated });
  } catch (error) {
    return next(error);
  }
});
