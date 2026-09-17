import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { publicProfile } from './profile-shape.js';
import { ValidationError, makeInviteCode, requireString } from '../validate.js';

/**
 * Friends — added by code, never by search.
 *
 * There is deliberately no directory and no lookup by email. The sign-in
 * routes are built so that nobody can probe which addresses have accounts
 * here, and a "find my friend by email" endpoint would hand that straight
 * back: send a request, read the error, learn whether someone is a member.
 * So you share a code, the way you share a team's invite code.
 *
 * What a friend can then see is a published snapshot — name, streak, level —
 * and whatever you chose to post. Never your training. The profile below is
 * written by the owner's own device; the server stores numbers it cannot
 * derive and would not be able to recompute.
 */
export const friendsRouter = Router();

friendsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that profile.' });

/** Everyone's code is stable once issued, and generated the first time it is asked for. */
async function codeFor(userId) {
  return write((data) => {
    const user = data.users.find((row) => row.id === userId);
    if (!user) return null;
    if (!user.friendCode) {
      do {
        user.friendCode = makeInviteCode();
      } while (data.users.filter((row) => row.friendCode === user.friendCode).length > 1);
    }
    return user.friendCode;
  });
}

/* ------------------------------------------------------------------- code */

/** Your own code, to read out or paste to somebody. */
friendsRouter.get('/code', async (req, res, next) => {
  try {
    const code = await codeFor(req.user.id);
    if (!code) return forbidden(res);
    return res.json({ code });
  } catch (error) {
    return next(error);
  }
});

/* ---------------------------------------------------------------- requests */

/**
 * Ask to be someone's friend, using their code.
 *
 * A wrong code and a code belonging to nobody give the same answer, so this
 * cannot be used to sweep the space of codes for valid ones any faster than
 * guessing blind.
 */
friendsRouter.post('/request', async (req, res, next) => {
  try {
    const code = requireString(req.body?.code, 'code', { min: 6, max: 6 }).toUpperCase();
    const userId = req.user.id;

    const outcome = await write((data) => {
      const target = data.users.find((row) => row.friendCode === code);
      if (!target) return { error: 'no_such_code' };
      if (target.id === userId) return { error: 'self' };

      const existing = data.friendships.find(
        (row) =>
          (row.requesterId === userId && row.addresseeId === target.id) ||
          (row.requesterId === target.id && row.addresseeId === userId),
      );

      // They already asked you: taking their code is an answer of yes, which
      // is friendlier than telling somebody they have a request waiting.
      if (existing) {
        if (existing.status === 'pending' && existing.addresseeId === userId) {
          existing.status = 'accepted';
          existing.updatedAt = new Date().toISOString();
        }
        return { friendship: existing };
      }

      const friendship = {
        id: crypto.randomUUID(),
        requesterId: userId,
        addresseeId: target.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.friendships.push(friendship);
      return { friendship };
    });

    if (outcome.error === 'self') {
      throw new ValidationError('code', 'That is your own code.');
    }
    if (outcome.error) {
      return res
        .status(404)
        .json({ error: 'no_such_code', field: 'code', message: 'No one uses that code.' });
    }
    return res.status(201).json({ friendship: outcome.friendship });
  } catch (error) {
    return next(error);
  }
});

/**
 * Ask someone you already share a team with.
 *
 * By user id rather than by code, which is only safe because of the check
 * below: you must both be active members of the same team. You can already
 * see these people on a roster, so this exposes nothing new — and it covers
 * the common case, which is wanting to add the people you actually train
 * with rather than reciting six characters at them.
 *
 * Without the shared-team check this would be a way to friend anybody whose
 * id you could guess, which is exactly what the code exists to prevent.
 */
friendsRouter.post('/request-teammate', async (req, res, next) => {
  try {
    const targetId = requireString(req.body?.userId, 'userId', { min: 1, max: 80 });
    const userId = req.user.id;

    const outcome = await write((data) => {
      if (targetId === userId) return { error: 'self' };
      if (!data.users.some((row) => row.id === targetId)) return { error: 'forbidden' };

      const mine = new Set(
        data.memberships
          .filter((row) => row.userId === userId && row.status === 'active')
          .map((row) => row.teamId),
      );
      const shared = data.memberships.some(
        (row) => row.userId === targetId && row.status === 'active' && mine.has(row.teamId),
      );
      if (!shared) return { error: 'forbidden' };

      const existing = data.friendships.find(
        (row) =>
          (row.requesterId === userId && row.addresseeId === targetId) ||
          (row.requesterId === targetId && row.addresseeId === userId),
      );
      if (existing) {
        if (existing.status === 'pending' && existing.addresseeId === userId) {
          existing.status = 'accepted';
          existing.updatedAt = new Date().toISOString();
        }
        return { friendship: existing };
      }

      const friendship = {
        id: crypto.randomUUID(),
        requesterId: userId,
        addresseeId: targetId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.friendships.push(friendship);
      return { friendship };
    });

    if (outcome.error === 'self') throw new ValidationError('userId', 'That is you.');
    if (outcome.error) {
      return res
        .status(403)
        .json({ error: 'forbidden', message: 'You can only add people from a team you share.' });
    }
    return res.status(201).json({ friendship: outcome.friendship });
  } catch (error) {
    return next(error);
  }
});

/** Your friends, and the requests waiting in both directions. */
friendsRouter.get('/', async (req, res, next) => {
  try {
    const data = await read();
    const userId = req.user.id;
    const mine = data.friendships.filter(
      (row) => row.requesterId === userId || row.addresseeId === userId,
    );

    /**
     * A pending row carries a name and nothing else.
     *
     * You have to know who is asking, so the name is necessary. Their streak
     * and level are not: the profile route refuses those until a request is
     * accepted, and this list would otherwise hand over the same figures
     * through a different door.
     */
    const shape = (row) => {
      const otherId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      const full = publicProfile(data, otherId);
      const profile =
        row.status === 'accepted'
          ? full
          : { userId: full.userId, name: full.name, streak: 0, level: 1, daysWon: 0, updatedAt: null };
      return { id: row.id, status: row.status, profile };
    };

    return res.json({
      friends: mine.filter((row) => row.status === 'accepted').map(shape),
      incoming: mine
        .filter((row) => row.status === 'pending' && row.addresseeId === userId)
        .map(shape),
      outgoing: mine
        .filter((row) => row.status === 'pending' && row.requesterId === userId)
        .map(shape),
    });
  } catch (error) {
    return next(error);
  }
});

/** Accept one. Only the person who was asked can answer. */
friendsRouter.post('/:friendshipId/accept', async (req, res, next) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user.id;

    const updated = await write((data) => {
      const row = data.friendships.find((entry) => entry.id === friendshipId);
      if (!row || row.addresseeId !== userId || row.status !== 'pending') return null;
      row.status = 'accepted';
      row.updatedAt = new Date().toISOString();
      return row;
    });

    if (!updated) return forbidden(res);
    return res.json({ friendship: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * Decline, cancel, or unfriend — one route, because they are one act.
 *
 * Either side can do it at any point, and the row is deleted rather than
 * marked. A friendship nobody wants should not leave a record of itself.
 */
friendsRouter.delete('/:friendshipId', async (req, res, next) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user.id;

    const removed = await write((data) => {
      const row = data.friendships.find((entry) => entry.id === friendshipId);
      if (!row || (row.requesterId !== userId && row.addresseeId !== userId)) return false;
      data.friendships = data.friendships.filter((entry) => entry.id !== friendshipId);
      return true;
    });

    if (!removed) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
