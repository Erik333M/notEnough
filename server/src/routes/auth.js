import crypto from 'node:crypto';
import { Router } from 'express';

import { hashPassword, publicUser, requireAuth, signToken, verifyPassword } from '../auth.js';
import { findUserByEmail, write } from '../db.js';
import { requireEmail, requirePassword, requireString } from '../validate.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const name = requireString(req.body?.name, 'name', { min: 2, max: 60 });
    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);

    if (await findUserByEmail(email)) {
      return res
        .status(409)
        .json({ error: 'email_taken', field: 'email', message: 'An account already uses this email.' });
    }

    const { salt, hash } = await hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };

    // The uniqueness check runs again inside the write queue: between the read
    // above and this mutation another request could have claimed the address.
    const created = await write((data) => {
      if (data.users.some((row) => row.email === email)) return null;
      data.users.push(user);
      return user;
    });

    if (!created) {
      return res
        .status(409)
        .json({ error: 'email_taken', field: 'email', message: 'An account already uses this email.' });
    }

    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    const user = await findUserByEmail(email);

    // Identical response for "no such account" and "wrong password" so the
    // endpoint cannot be used to enumerate registered addresses.
    const reject = () =>
      res
        .status(401)
        .json({ error: 'bad_credentials', field: 'password', message: 'Email or password is incorrect.' });

    if (!user) return reject();
    if (!(await verifyPassword(password, user.salt, user.hash))) return reject();

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const name = requireString(req.body?.name, 'name', { min: 2, max: 60 });
    const { id } = req.user;

    const updated = await write((data) => {
      const row = data.users.find((user) => user.id === id);
      if (!row) return null;
      row.name = name;
      return row;
    });

    if (!updated) {
      return res.status(404).json({ error: 'not_found', message: 'Account no longer exists.' });
    }
    return res.json({ user: publicUser(updated) });
  } catch (error) {
    return next(error);
  }
});

authRouter.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.user;
    await write((data) => {
      data.users = data.users.filter((row) => row.id !== id);
      delete data.states[id];
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
