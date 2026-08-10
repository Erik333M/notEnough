import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { requireStatePayload } from '../validate.js';

export const stateRouter = Router();

stateRouter.use(requireAuth);

/** Returns null the first time an account syncs — the client then pushes its seed state. */
stateRouter.get('/', async (req, res, next) => {
  try {
    const data = await read();
    return res.json({ state: data.states[req.user.id] ?? null });
  } catch (error) {
    return next(error);
  }
});

/**
 * Last-write-wins on a client-supplied `updatedAt`.
 *
 * If the stored copy is newer than what the client based its edit on, the write
 * is refused with 409 and the server copy is returned, so a second device that
 * synced in the meantime never has its work silently overwritten. The client
 * adopts that copy and continues.
 */
stateRouter.put('/', async (req, res, next) => {
  try {
    const payload = requireStatePayload(req.body);
    const clientUpdatedAt = Number(req.body?.updatedAt) || Date.now();
    const userId = req.user.id;

    const result = await write((data) => {
      const existing = data.states[userId];
      if (existing && existing.updatedAt > clientUpdatedAt) {
        return { conflict: true, state: existing };
      }
      const next = { ...payload, updatedAt: clientUpdatedAt };
      data.states[userId] = next;
      return { conflict: false, state: next };
    });

    if (result.conflict) {
      return res.status(409).json({ error: 'stale_write', state: result.state });
    }
    return res.json({ state: result.state });
  } catch (error) {
    return next(error);
  }
});
