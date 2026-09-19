import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import {
  avatarPath,
  avatarUrlFor,
  contentTypeOf,
  deleteAvatar,
  isAvatarFile,
  saveAvatar,
} from '../avatar-store.js';

/**
 * Profile pictures.
 *
 * Three routes for your own and one that serves bytes. There is no route that
 * writes anybody else's — the same shape as the published profile beside it.
 *
 * The read route is the odd one: it takes no session, because the file name is
 * an unguessable token that is only ever included in a payload the profile
 * rules already allowed. avatar-store.js sets out why, and what that costs.
 */
export const avatarsRouter = Router();

const urlOf = (data, userId) => {
  const row = data.avatars.find((entry) => entry.userId === userId);
  return row ? avatarUrlFor(row.file) : null;
};

/** Your own, so the profile screen knows whether to show a picture or initials. */
avatarsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const data = await read();
    return res.json({ avatarUrl: urlOf(data, req.user.id) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Replace your picture.
 *
 * The old file is unlinked after the row is updated, not before: if the write
 * fails, the row still points at a file that exists.
 */
avatarsRouter.put('/me', requireAuth, async (req, res, next) => {
  try {
    const file = await saveAvatar(req.body?.image);
    const userId = req.user.id;

    const previous = await write((data) => {
      const existing = data.avatars.find((row) => row.userId === userId);
      const old = existing?.file ?? null;
      if (existing) {
        existing.file = file;
        existing.updatedAt = new Date().toISOString();
      } else {
        data.avatars.push({ userId, file, updatedAt: new Date().toISOString() });
      }
      return old;
    });

    if (previous) await deleteAvatar(previous);
    return res.json({ avatarUrl: avatarUrlFor(file) });
  } catch (error) {
    return next(error);
  }
});

/** Back to initials. */
avatarsRouter.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const removed = await write((data) => {
      const existing = data.avatars.find((row) => row.userId === userId);
      data.avatars = data.avatars.filter((row) => row.userId !== userId);
      return existing?.file ?? null;
    });

    if (removed) await deleteAvatar(removed);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

/**
 * The bytes.
 *
 * `isAvatarFile` is the whole of the path safety here: the name must be
 * thirty-two hex characters and an extension we wrote ourselves, so there is
 * no input that can climb out of the directory.
 */
avatarsRouter.get('/:file', async (req, res, next) => {
  try {
    const { file } = req.params;
    if (!isAvatarFile(file)) {
      return res.status(404).json({ error: 'not_found', message: 'No such image.' });
    }

    const data = await read();
    if (!data.avatars.some((row) => row.file === file)) {
      return res.status(404).json({ error: 'not_found', message: 'No such image.' });
    }

    res.type(contentTypeOf(file));
    // The name changes on every upload, so a copy can never be stale.
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    return res.sendFile(avatarPath(file), (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
});
