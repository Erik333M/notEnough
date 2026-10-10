import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { avatarUrlFor } from '../avatar-store.js';
import { hiddenFrom } from '../permissions.js';
import { REPORT_KINDS, REPORT_REASONS } from '../moderation.js';
import { ValidationError, optionalString, requireString } from '../validate.js';

/**
 * Blocking and reporting.
 *
 * Blocking is the one that matters, because it is the only remedy that needs
 * nobody's agreement and takes effect the moment it is pressed. Reporting
 * records what a filter and a block cannot resolve on their own.
 */
export const moderationRouter = Router();

moderationRouter.use(requireAuth);

/** Everybody you have blocked, so a screen can offer to undo it. */
moderationRouter.get('/blocks', async (req, res, next) => {
  try {
    const data = await read();
    const mine = data.blocks
      .filter((row) => row.userId === req.user.id)
      .map((row) => {
        const user = data.users.find((entry) => entry.id === row.blockedUserId);
        const avatar = data.avatars.find((entry) => entry.userId === row.blockedUserId);
        return {
          userId: row.blockedUserId,
          name: user?.name ?? 'Someone',
          avatarUrl: avatar ? avatarUrlFor(avatar.file) : null,
          createdAt: row.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ blocks: mine });
  } catch (error) {
    return next(error);
  }
});

/**
 * Block somebody.
 *
 * Takes effect both ways and immediately: neither of you sees the other's
 * posts, neither appears on the other's friend list, and a friend request
 * between you stops being one. Nothing either of you recorded is touched.
 */
moderationRouter.post('/blocks', async (req, res, next) => {
  try {
    const targetId = requireString(req.body?.userId, 'userId', { min: 1, max: 80 });
    const userId = req.user.id;
    if (targetId === userId) throw new ValidationError('userId', 'You cannot block yourself.');

    const outcome = await write((data) => {
      if (!data.users.some((row) => row.id === targetId)) return { error: 'no_such_user' };
      // Pressing block twice is a double tap, not an error.
      const existing = data.blocks.find(
        (row) => row.userId === userId && row.blockedUserId === targetId,
      );
      if (existing) return { ok: true };

      data.blocks.push({
        id: crypto.randomUUID(),
        userId,
        blockedUserId: targetId,
        createdAt: new Date().toISOString(),
      });
      return { ok: true };
    });

    if (outcome.error) {
      return res.status(404).json({ error: 'no_such_user', message: 'No such person.' });
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

/** Undo it. Everything hidden comes back; nothing was ever deleted. */
moderationRouter.delete('/blocks/:userId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    await write((data) => {
      data.blocks = data.blocks.filter(
        (row) => !(row.userId === userId && row.blockedUserId === req.params.userId),
      );
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

/**
 * Report something.
 *
 * Recorded against the content and the person, and kept when either of them
 * goes — a report is evidence, and evidence that disappears with the account
 * it is about is worthless.
 *
 * Reporting also blocks, unless the reporter says otherwise. Somebody who has
 * just seen something bad enough to report almost never wants to keep seeing
 * that person while they wait, and making them press twice is a worse
 * experience at the worst moment.
 */
moderationRouter.post('/reports', async (req, res, next) => {
  try {
    const kind = req.body?.kind;
    if (!REPORT_KINDS.includes(kind)) {
      throw new ValidationError('kind', 'Unknown kind of report.');
    }
    const reason = req.body?.reason;
    if (!REPORT_REASONS.includes(reason)) {
      throw new ValidationError('reason', 'Pick a reason.');
    }
    const targetUserId = requireString(req.body?.targetUserId, 'targetUserId', { min: 1, max: 80 });
    const targetId = optionalString(req.body?.targetId, 'targetId', 80);
    const note = optionalString(req.body?.note, 'note', 1000);
    const alsoBlock = req.body?.block !== false;
    const userId = req.user.id;

    if (targetUserId === userId) {
      throw new ValidationError('targetUserId', 'You cannot report yourself.');
    }

    const report = await write((data) => {
      const row = {
        id: crypto.randomUUID(),
        reporterId: userId,
        kind,
        reason,
        note,
        targetId: targetId || null,
        targetUserId,
        /*
         * A snapshot of what was reported, taken now.
         *
         * The message may be deleted a minute later — often by the person who
         * posted it — and a report pointing at a row that no longer exists
         * cannot be judged by anybody.
         */
        snapshot:
          kind === 'message'
            ? data.messages.find((entry) => entry.id === targetId)?.body?.slice(0, 500) ?? null
            : kind === 'post'
              ? data.shares.find((entry) => entry.id === targetId)?.title?.slice(0, 500) ?? null
              : null,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      data.reports.push(row);

      if (alsoBlock && !data.blocks.some((b) => b.userId === userId && b.blockedUserId === targetUserId)) {
        data.blocks.push({
          id: crypto.randomUUID(),
          userId,
          blockedUserId: targetUserId,
          createdAt: new Date().toISOString(),
        });
      }
      return row;
    });

    return res.status(201).json({ report: { id: report.id, status: report.status }, blocked: alsoBlock });
  } catch (error) {
    return next(error);
  }
});

/**
 * What the caller currently cannot see, as plain ids.
 *
 * Handed to the client so a list fetched before a block can be filtered
 * without a second round trip, and so the app never has to guess.
 */
moderationRouter.get('/hidden', async (req, res, next) => {
  try {
    const data = await read();
    return res.json({ hidden: [...hiddenFrom(data, req.user.id)] });
  } catch (error) {
    return next(error);
  }
});
