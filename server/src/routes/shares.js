import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { canRemoveShare, canViewTeam, isMember } from '../permissions.js';
import { SHARE_PAGE, requireShareInput } from '../validate.js';

/**
 * Achievements an athlete chose to show their team.
 *
 * This is the one place in the app where somebody's own training becomes
 * visible to others, and it happens only because they tapped a button saying
 * so. Nothing here is derived, inferred or automatic: the server stores what
 * it was handed and shows it back to that one team.
 *
 * A share is a flat snapshot — title, detail, a number, a date — never a
 * pointer into the author's data. So the feed cannot be walked back into
 * somebody's journal, and a post stays what it was on the day it was made.
 */
export const sharesRouter = Router();

sharesRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that team.' });

/** Post one. Any active member — a coach can show off too. */
sharesRouter.post('/:teamId/shares', async (req, res, next) => {
  try {
    const input = requireShareInput(req.body);
    const { teamId } = req.params;
    const userId = req.user.id;
    const name = req.user.name;

    const outcome = await write((data) => {
      if (!isMember(data, userId, teamId)) return { error: 'forbidden' };

      // Posting the same achievement twice is a double tap or a stale screen,
      // not an intention. The existing post wins and the caller gets it back.
      const existing = data.shares.find(
        (row) =>
          row.teamId === teamId && row.userId === userId && row.achievementId === input.achievementId,
      );
      if (existing) return { share: existing, duplicate: true };

      const share = {
        id: crypto.randomUUID(),
        teamId,
        userId,
        // Denormalised so the feed reads without a join, and so a later rename
        // does not silently rewrite what a post said at the time.
        authorName: name,
        ...input,
        createdAt: new Date().toISOString(),
      };
      data.shares.push(share);
      return { share };
    });

    if (outcome.error) return forbidden(res);
    return res.status(outcome.duplicate ? 200 : 201).json({ share: outcome.share });
  } catch (error) {
    return next(error);
  }
});

/** The team's feed, newest first. Any active member. */
sharesRouter.get('/:teamId/shares', async (req, res, next) => {
  try {
    const data = await read();
    const { teamId } = req.params;
    if (!canViewTeam(data, req.user.id, teamId)) return forbidden(res);

    const shares = data.shares
      .filter((row) => row.teamId === teamId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, SHARE_PAGE);

    return res.json({ shares });
  } catch (error) {
    return next(error);
  }
});

/** Take one down. The author, or a coach keeping the feed clean. */
sharesRouter.delete('/:teamId/shares/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const userId = req.user.id;

    const outcome = await write((data) => {
      const share = data.shares.find((row) => row.id === shareId);
      if (!canRemoveShare(data, userId, share)) return { error: 'forbidden' };
      data.shares = data.shares.filter((row) => row.id !== shareId);
      return { ok: true };
    });

    if (outcome.error) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
