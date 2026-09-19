import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { canManageEvent, canViewEvent, childTeamsOf } from '../permissions.js';
import {
  ensureScoreField,
  fieldsOf,
  leadersOf,
  standingsOf,
  statKey,
} from '../stats-core.js';
import { ValidationError, requireDayKey, requireNumber, requireString } from '../validate.js';

/**
 * Games between squads, and the numbers they produce.
 *
 * A game is two squads and a date. Everything recorded against it is a value
 * in a field the organiser defined, so this file knows nothing about goals or
 * cards — only about teams, players and numbers.
 */
export const eventGamesRouter = Router();

eventGamesRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that event.' });

const eventFrom = (data, eventId) => data.events.find((row) => row.id === eventId) ?? null;

const gameShape = (data, game) => ({
  ...game,
  stats: data.gameStats
    .filter((row) => row.gameId === game.id)
    .map(({ teamId, userId, fieldId, value }) => ({ teamId, userId, fieldId, value })),
});

/**
 * The whole picture: fixtures, the table, and who is leading each field.
 *
 * One request rather than three. They are read together on one screen, and
 * computed from the same rows, so splitting them would only create a window in
 * which the table disagreed with the games above it.
 */
eventGamesRouter.get('/:eventId/games', async (req, res, next) => {
  try {
    const data = await read();
    const event = eventFrom(data, req.params.eventId);
    if (!canViewEvent(data, req.user.id, event)) return forbidden(res);

    const squads = childTeamsOf(data, event.teamId);
    const nameOf = (userId) => data.users.find((row) => row.id === userId)?.name ?? 'Unknown';

    return res.json({
      games: data.games
        .filter((row) => row.eventId === event.id)
        .sort((a, b) => a.playedOn.localeCompare(b.playedOn) || a.createdAt.localeCompare(b.createdAt))
        .map((game) => gameShape(data, game)),
      fields: fieldsOf(data, event.id),
      standings: standingsOf(data, event.id, squads),
      leaders: leadersOf(data, event.id, nameOf),
      canManage: canManageEvent(data, req.user.id, event),
    });
  } catch (error) {
    return next(error);
  }
});

/** Put a fixture in. Staff only. */
eventGamesRouter.post('/:eventId/games', async (req, res, next) => {
  try {
    const homeTeamId = requireString(req.body?.homeTeamId, 'homeTeamId', { min: 1, max: 80 });
    const awayTeamId = requireString(req.body?.awayTeamId, 'awayTeamId', { min: 1, max: 80 });
    const playedOn = requireDayKey(req.body?.playedOn, 'playedOn');
    const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 40) : '';
    if (homeTeamId === awayTeamId) {
      throw new ValidationError('awayTeamId', 'A squad cannot play itself.');
    }
    const userId = req.user.id;

    const outcome = await write((data) => {
      const event = eventFrom(data, req.params.eventId);
      if (!canManageEvent(data, userId, event)) return { error: 'forbidden' };

      // Both sides must be squads of *this* event, or a game would be a way to
      // reference a team from somewhere else entirely.
      const squads = new Set(childTeamsOf(data, event.teamId).map((row) => row.id));
      if (!squads.has(homeTeamId) || !squads.has(awayTeamId)) return { error: 'not_a_squad' };

      ensureScoreField(data, event.id);

      const game = {
        id: crypto.randomUUID(),
        eventId: event.id,
        title,
        homeTeamId,
        awayTeamId,
        playedOn,
        // A fixture is not a nil-nil draw until somebody says it was played.
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
      data.games.push(game);
      return { game: gameShape(data, game) };
    });

    if (outcome.error === 'not_a_squad') {
      throw new ValidationError('homeTeamId', 'Both sides have to be squads in this event.');
    }
    if (outcome.error) return forbidden(res);
    return res.status(201).json(outcome);
  } catch (error) {
    return next(error);
  }
});

/**
 * Record the numbers, and mark it played. Staff only.
 *
 * The whole game's stats are replaced in one write rather than patched field
 * by field. Entering a result is one act — somebody sits down with a team
 * sheet and types it all in — and a partial save that left three of eight
 * numbers from the previous attempt would be worse than none.
 */
eventGamesRouter.put('/:eventId/games/:gameId/stats', async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (entries.length > 600) throw new ValidationError('entries', 'That is too much for one game.');
    const status = req.body?.status === 'scheduled' ? 'scheduled' : 'played';
    const userId = req.user.id;

    const clean = entries.map((entry, index) => ({
      teamId: requireString(entry?.teamId, `entries[${index}].teamId`, { min: 1, max: 80 }),
      userId: entry?.userId ? requireString(entry.userId, `entries[${index}].userId`, { min: 1, max: 80 }) : null,
      fieldId: requireString(entry?.fieldId, `entries[${index}].fieldId`, { min: 1, max: 80 }),
      value: requireNumber(entry?.value, `entries[${index}].value`, { min: -100000, max: 100000 }),
    }));

    const outcome = await write((data) => {
      const event = eventFrom(data, req.params.eventId);
      if (!canManageEvent(data, userId, event)) return { error: 'forbidden' };

      const game = data.games.find(
        (row) => row.id === req.params.gameId && row.eventId === event.id,
      );
      if (!game) return { error: 'forbidden' };

      const sides = new Set([game.homeTeamId, game.awayTeamId]);
      const fields = new Map(fieldsOf(data, event.id).map((row) => [row.id, row]));

      const seen = new Set();
      const rows = [];
      for (const entry of clean) {
        const field = fields.get(entry.fieldId);
        // Silently dropping unknown rows would make a typo look like a save.
        if (!field) return { error: 'no_such_field' };
        if (!sides.has(entry.teamId)) return { error: 'not_playing' };
        // A team total belongs to no player, and a player figure belongs to
        // one. Mixing them would put a person in the standings.
        if (field.scope === 'team' && entry.userId) return { error: 'scope' };
        if (field.scope === 'player' && !entry.userId) return { error: 'scope' };

        const key = statKey(entry.teamId, entry.userId, entry.fieldId);
        if (seen.has(key)) return { error: 'duplicate' };
        seen.add(key);

        rows.push({ id: crypto.randomUUID(), gameId: game.id, ...entry });
      }

      data.gameStats = data.gameStats.filter((row) => row.gameId !== game.id);
      data.gameStats.push(...rows);
      game.status = status;
      return { game: gameShape(data, game) };
    });

    if (outcome.error === 'no_such_field') {
      throw new ValidationError('entries', 'One of those is not a field on this event.');
    }
    if (outcome.error === 'not_playing') {
      throw new ValidationError('entries', 'One of those squads is not in this game.');
    }
    if (outcome.error === 'scope') {
      throw new ValidationError('entries', 'A team total cannot be recorded against a player.');
    }
    if (outcome.error === 'duplicate') {
      throw new ValidationError('entries', 'The same figure was sent twice.');
    }
    if (outcome.error) return forbidden(res);
    return res.json(outcome);
  } catch (error) {
    return next(error);
  }
});

/** Call one off. Staff only. Its numbers go with it. */
eventGamesRouter.delete('/:eventId/games/:gameId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const removed = await write((data) => {
      const event = eventFrom(data, req.params.eventId);
      if (!canManageEvent(data, userId, event)) return false;
      const game = data.games.find(
        (row) => row.id === req.params.gameId && row.eventId === event.id,
      );
      if (!game) return false;

      data.gameStats = data.gameStats.filter((row) => row.gameId !== game.id);
      data.games = data.games.filter((row) => row.id !== game.id);
      return true;
    });

    if (!removed) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
