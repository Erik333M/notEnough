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
 * @property {Object[]} teams
 * @property {Object[]} memberships
 * @property {Object[]} sessions
 * @property {Object[]} sessionTasks
 * @property {Object[]} assignments
 * @property {Object[]} results
 * @property {Object[]} shares
 */

/**
 * `states` holds one opaque blob per user and is private to that user: the
 * server never reads inside it and no route can serve part of it to anyone
 * else. The four collections beside it are the shared half of the app — work a
 * coach handed out and the results recorded against it. The split is the
 * privacy boundary, and it is a storage boundary rather than a rule someone has
 * to remember to apply.
 */

/** @type {Schema} */
const EMPTY = {
  users: [],
  states: {},
  teams: [],
  memberships: [],
  sessions: [],
  sessionTasks: [],
  assignments: [],
  results: [],
  shares: [],
};

/** @type {Schema | null} */
let cache = null;

/** Serialises all mutations. Each write awaits the previous one. */
let queue = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(config.dbFile, 'utf8');
    const parsed = JSON.parse(raw);
    // Each collection is defaulted independently, so a database file written
    // before this feature existed loads as an account with no teams rather
    // than crashing on a missing key. That is the whole migration for existing
    // solo users: zero memberships, everything works exactly as before.
    cache = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      states: parsed.states && typeof parsed.states === 'object' ? parsed.states : {},
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      sessionTasks: Array.isArray(parsed.sessionTasks) ? parsed.sessionTasks : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
      results: Array.isArray(parsed.results) ? parsed.results : [],
      shares: Array.isArray(parsed.shares) ? parsed.shares : [],
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

/**
 * Everything belonging to a deleted account, removed in one pass.
 *
 * Called from the delete-account route. Their memberships go, and with them any
 * access anyone had to their results; the results themselves go too, because
 * they are that person's record of their own work. Assignments a coach wrote
 * for them are removed as well — an assignment with no one to do it is not
 * history worth keeping, it is a row that would render as a ghost on the
 * coach's roster forever.
 *
 * Teams they coached are left standing: other people's memberships and work
 * live in them, and deleting your account should not delete a squad.
 */
export function purgeUserData(data, userId) {
  const theirs = new Set(
    data.assignments.filter((row) => row.assigneeUserId === userId).map((row) => row.id),
  );
  data.memberships = data.memberships.filter((row) => row.userId !== userId);
  data.results = data.results.filter((row) => row.userId !== userId && !theirs.has(row.assignmentId));
  data.assignments = data.assignments.filter((row) => row.assigneeUserId !== userId);
  // Their posts go too. A boast with no author behind it is a ghost on a feed
  // nobody can remove.
  data.shares = data.shares.filter((row) => row.userId !== userId);
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
