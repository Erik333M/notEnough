import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { areFriends, canViewProfile } from '../permissions.js';
import { requireNumber } from '../validate.js';
import { publicProfile } from './profile-shape.js';

/**
 * Published figures, and who may read them.
 *
 * Split from the friends routes only for length; it is the same idea. The
 * numbers are worked out on the owner's device from a log this server never
 * reads into, so publishing is an act rather than a consequence of training.
 */
export const profilesRouter = Router();

profilesRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that profile.' });

/**
 * Publish your own figures.
 *
 * Worked out on your device from a log this server never reads. Only you can
 * write your own, and there is no route that writes anyone else's.
 */
profilesRouter.put('/profile', async (req, res, next) => {
  try {
    const streak = requireNumber(req.body?.streak ?? 0, 'streak', { min: 0, max: 100000 });
    const level = requireNumber(req.body?.level ?? 1, 'level', { min: 1, max: 100 });
    const daysWon = requireNumber(req.body?.daysWon ?? 0, 'daysWon', { min: 0, max: 100000 });
    const userId = req.user.id;

    const profile = await write((data) => {
      const existing = data.profiles.find((row) => row.userId === userId);
      const next = {
        userId,
        streak,
        level,
        daysWon,
        updatedAt: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, next);
      else data.profiles.push(next);
      return next;
    });

    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

/** Somebody's public profile. Yourself, or an accepted friend. */
profilesRouter.get('/:userId/profile', async (req, res, next) => {
  try {
    const data = await read();
    const { userId } = req.params;
    if (!canViewProfile(data, req.user.id, userId)) return forbidden(res);

    return res.json({
      profile: publicProfile(data, userId),
      isFriend: areFriends(data, req.user.id, userId),
    });
  } catch (error) {
    return next(error);
  }
});
