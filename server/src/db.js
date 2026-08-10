import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from './config.js';

/**
 * A single JSON file acting as the database.
 *
 * Two things keep that honest rather than naive:
 *  - every write is serialised through one promise chain, so concurrent
 *    requests can never interleave a read-modify-write and lose an update;
 *  - writes go to a temp file and are then renamed, which is atomic on every
 *    mainstream filesystem — a crash mid-write cannot leave a truncated db.
 *
 * Swapping this module for Postgres would not require touching a route.
 */

/**
 * @typedef {Object} UserRow
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string} salt
 * @property {string} hash
 * @property {string} createdAt
 *
 * @typedef {Object} StateRow
 * @property {number} version
 * @property {unknown[]} goals
 * @property {Record<string, Record<string, number>>} log
 * @property {unknown[]} runs
 * @property {Record<string, unknown>} plan
 * @property {number} updatedAt
 *
 * @typedef {Object} Schema
 * @property {UserRow[]} users
 * @property {Record<string, StateRow>} states
 */

/** @type {Schema} */
const EMPTY = { users: [], states: {} };

/** @type {Schema | null} */
let cache = null;

/** Serialises all mutations. Each write awaits the previous one. */
let queue = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(config.dbFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      states: parsed.states && typeof parsed.states === 'object' ? parsed.states : {},
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // A corrupt file should be loud, not silently replaced with an empty db.
      if (error instanceof SyntaxError) {
        throw new Error(`Database file at ${config.dbFile} is not valid JSON.`);
      }
      throw error;
    }
    cache = structuredClone(EMPTY);
  }
  return cache;
}

async function persist(data) {
  await fs.mkdir(path.dirname(config.dbFile), { recursive: true });
  const tmp = `${config.dbFile}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, config.dbFile);
}

/** Read-only snapshot. */
export async function read() {
  return load();
}

/**
 * Mutate the database inside the write queue.
 * @template T
 * @param {(data: Schema) => T | Promise<T>} mutator
 * @returns {Promise<T>}
 */
export function write(mutator) {
  const next = queue.then(async () => {
    const data = await load();
    const result = await mutator(data);
    await persist(data);
    return result;
  });

  // Keep the chain alive even if this mutation rejects, so one failed write
  // does not permanently wedge every later write.
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function findUserByEmail(email) {
  const data = await load();
  return data.users.find((user) => user.email === email) ?? null;
}

export async function findUserById(id) {
  const data = await load();
  return data.users.find((user) => user.id === id) ?? null;
}

/** Test hook — drops the in-memory cache so a fresh file is read. */
export function resetCache() {
  cache = null;
}
