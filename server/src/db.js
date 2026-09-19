import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from './config.js';

/**
 * JSON files acting as the database.
 *
 * Two things keep that honest rather than naive:
 *  - every write is serialised through one promise chain, so concurrent
 *    requests can never interleave a read-modify-write and lose an update;
 *  - writes go to a temp file and are then renamed, which is atomic on every
 *    mainstream filesystem — a crash mid-write cannot leave a truncated db.
 *
 * Swapping this module for Postgres would not require touching a route.
 *
 * ── Two files, not one ──────────────────────────────────────────────────────
 *
 * Chat is kept in its own file. Every write rewrites a whole file, so with
 * messages inside db.json, posting one would rewrite every team, session and
 * result in the system: the cost of saving anything would grow with the size
 * of everything. Callers see no difference — `data.messages` is an array on
 * the same object as the rest — because which file a collection lands in is
 * this module's business and nobody else's.
 *
 * On top of that, a file is only rewritten when its contents actually changed.
 * Serialising is cheap; the temp-file-and-rename is not, and most writes touch
 * one half or the other.
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
 * @property {Object[]} challenges
 * @property {Object[]} entries
 * @property {Object[]} friendships
 * @property {Object[]} profiles
 * @property {Object[]} avatars
 * @property {Object[]} events
 * @property {Object[]} statFields
 * @property {Object[]} games
 * @property {Object[]} gameStats
 * @property {Object[]} messages
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
  challenges: [],
  entries: [],
  friendships: [],
  profiles: [],
  avatars: [],
  events: [],
  statFields: [],
  games: [],
  gameStats: [],
  messages: [],
};

/** @type {Schema | null} */
let cache = null;

/** Serialises all mutations. Each write awaits the previous one. */
let queue = Promise.resolve();

/** What was last written to each file, so an unchanged one is left alone. */
let lastCore = null;
let lastMessages = null;

async function readJson(file, label) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    // A corrupt file should be loud, not silently replaced with an empty db.
    if (error instanceof SyntaxError) throw new Error(`${label} at ${file} is not valid JSON.`);
    throw error;
  }
}

async function load() {
  if (cache) return cache;

  const parsed = (await readJson(config.dbFile, 'Database file')) ?? {};
  const separate = await readJson(config.messagesFile, 'Messages file');

  /*
   * Messages used to live inside db.json. A database written before the split
   * still has them there, so they are taken across on first load and dropped
   * from the core file by the next write. Nothing to run, and nothing to
   * remember to run.
   */
  const messages = Array.isArray(separate)
    ? separate
    : Array.isArray(parsed.messages)
      ? parsed.messages
      : [];

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
    challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
    profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
    avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    statFields: Array.isArray(parsed.statFields) ? parsed.statFields : [],
    games: Array.isArray(parsed.games) ? parsed.games : [],
    gameStats: Array.isArray(parsed.gameStats) ? parsed.gameStats : [],
    messages,
  };

  /*
   * Seed the comparison so the next write does not rewrite a file it has not
   * changed — including the very first write after start-up.
   *
   * With one exception, and it is the dangerous one: when messages came out of
   * the old core file, nothing has ever written them to a file of their own.
   * Seeding from them here would mark them as already saved, the next write
   * would drop them from the core file, and the copy in memory would be the
   * only one left. So migration deliberately leaves them dirty.
   */
  const { messages: held, ...core } = cache;
  lastCore = JSON.stringify(core, null, 2);
  lastMessages = separate === null && held.length > 0 ? null : JSON.stringify(held, null, 2);
  return cache;
}

/** Temp file then rename: a crash mid-write cannot leave a truncated file. */
async function writeAtomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}

async function persist(data) {
  const { messages, ...core } = data;
  const coreText = JSON.stringify(core, null, 2);
  const messagesText = JSON.stringify(messages, null, 2);

  if (coreText !== lastCore) {
    await writeAtomic(config.dbFile, coreText);
    lastCore = coreText;
  }
  if (messagesText !== lastMessages) {
    await writeAtomic(config.messagesFile, messagesText);
    lastMessages = messagesText;
  }
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
 *
 * Returns the avatar file name to unlink, if they had one.
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
  // Their leaderboard entries go too, so a deleted account cannot keep
  // occupying a place on a ranking nobody can remove them from.
  data.entries = data.entries.filter((row) => row.userId !== userId);
  // Friendships are two-sided, so both directions go — otherwise the other
  // person keeps a row pointing at nobody.
  data.friendships = data.friendships.filter(
    (row) => row.requesterId !== userId && row.addresseeId !== userId,
  );
  data.profiles = data.profiles.filter((row) => row.userId !== userId);
  // The row goes here; the file on disk is removed by the caller, which can
  // await. Returning the name is the only way this synchronous mutator can
  // hand that job on without leaving an orphan in the avatar directory.
  const avatar = data.avatars.find((row) => row.userId === userId);
  data.avatars = data.avatars.filter((row) => row.userId !== userId);
  return avatar?.file ?? null;
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
  lastCore = null;
  lastMessages = null;
  cache = null;
}
