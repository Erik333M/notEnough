import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { avatarUrlFor } from '../avatar-store.js';
import { canManageEvent, canViewEvent } from '../permissions.js';
import { broadcastMessage } from '../realtime.js';
import { requireString } from '../validate.js';

/**
 * The event's channel.
 *
 * Staff post; everybody at the event reads. That is a deliberate shape rather
 * than a missing feature: a camp has an age group, and running a messaging
 * service between other people's children is a different product with
 * different duties — moderation, reporting, blocking — none of which exist
 * here. An announcements channel needs none of them.
 *
 * Messages are written here and pushed by the socket hub. The write is what
 * makes them real; the socket only saves everybody a refresh, so a client with
 * no live connection is behind rather than broken.
 */
export const eventChatRouter = Router();

eventChatRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that event.' });

/** One page. Enough to fill a screen several times over. */
const PAGE = 50;

const shape = (data, row) => {
  const user = data.users.find((entry) => entry.id === row.userId);
  const avatar = data.avatars.find((entry) => entry.userId === row.userId);
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    // Denormalised onto the message so a deleted account's posts still read as
    // somebody rather than as a blank, and so the client needs no second call.
    name: user?.name ?? 'Someone',
    avatarUrl: avatar ? avatarUrlFor(avatar.file) : null,
    body: row.body,
    createdAt: row.createdAt,
  };
};

/**
 * History, newest page first, oldest message first within it.
 *
 * `before` is a message id rather than a timestamp: two messages posted in the
 * same millisecond would make a timestamp cursor skip one or repeat one, and
 * on a channel that is exactly what a burst of announcements looks like.
 */
eventChatRouter.get('/:eventId/messages', async (req, res, next) => {
  try {
    const data = await read();
    const event = data.events.find((row) => row.id === req.params.eventId);
    if (!canViewEvent(data, req.user.id, event)) return forbidden(res);

    const all = data.messages
      .filter((row) => row.eventId === event.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

    const before = typeof req.query.before === 'string' ? req.query.before : null;
    const end = before ? all.findIndex((row) => row.id === before) : all.length;
    const stop = end < 0 ? all.length : end;
    const start = Math.max(0, stop - PAGE);

    return res.json({
      messages: all.slice(start, stop).map((row) => shape(data, row)),
      hasMore: start > 0,
      canPost: canManageEvent(data, req.user.id, event),
    });
  } catch (error) {
    return next(error);
  }
});

/** Post one. Staff only. */
eventChatRouter.post('/:eventId/messages', async (req, res, next) => {
  try {
    const body = requireString(req.body?.body, 'body', { min: 1, max: 2000 });
    const userId = req.user.id;

    const outcome = await write((data) => {
      const event = data.events.find((row) => row.id === req.params.eventId);
      if (!canViewEvent(data, userId, event)) return { error: 'forbidden' };
      if (!canManageEvent(data, userId, event)) return { error: 'read_only' };

      const row = {
        id: crypto.randomUUID(),
        eventId: event.id,
        userId,
        body,
        createdAt: new Date().toISOString(),
      };
      data.messages.push(row);
      return { message: shape(data, row) };
    });

    if (outcome.error === 'read_only') {
      return res
        .status(403)
        .json({ error: 'read_only', message: 'Only the event staff can post here.' });
    }
    if (outcome.error) return forbidden(res);

    // After the write, so nobody can be pushed a message that failed to save.
    await broadcastMessage(req.params.eventId, outcome.message);
    return res.status(201).json({ message: outcome.message });
  } catch (error) {
    return next(error);
  }
});

/** Take one back. Its author, or any staff member keeping the channel clean. */
eventChatRouter.delete('/:eventId/messages/:messageId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const removed = await write((data) => {
      const event = data.events.find((row) => row.id === req.params.eventId);
      if (!canViewEvent(data, userId, event)) return false;
      const row = data.messages.find(
        (entry) => entry.id === req.params.messageId && entry.eventId === event.id,
      );
      if (!row) return false;
      if (row.userId !== userId && !canManageEvent(data, userId, event)) return false;

      data.messages = data.messages.filter((entry) => entry.id !== row.id);
      return true;
    });

    if (!removed) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
