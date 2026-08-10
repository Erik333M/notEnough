import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import { config } from './config.js';
import { findUserById } from './db.js';

const SCRYPT_KEYLEN = 64;

/**
 * Password hashing with scrypt (memory-hard, in Node's standard library — no
 * native bcrypt build step). Salt is per-user and random; comparison is
 * constant-time so response timing cannot be used to probe the hash.
 */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (error, derived) => {
      if (error) reject(error);
      else resolve({ salt, hash: derived.toString('hex') });
    });
  });
}

export async function verifyPassword(password, salt, expected) {
  const { hash } = await hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.tokenTtl,
  });
}

/** Strips salt/hash — this shape is the only user object that leaves the server. */
export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

/** Express middleware: verifies the bearer token and attaches `req.user`. */
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing bearer token.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Account no longer exists.' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Session expired.' });
  }
}
