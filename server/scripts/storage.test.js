/**
 * Where each collection is written, and when.
 *   node scripts/storage.test.js
 *
 * Unlike the other suites this one talks to db.js directly rather than over
 * HTTP, because what it checks is not behaviour a route can show you: which
 * file a write touches, and whether a file written before the chat split still
 * loads.
 *
 * The migration check earns its place. The first version of the split dropped
 * messages out of the core file and never wrote them to the new one — the
 * "has this changed?" comparison had been seeded from the very messages that
 * had never been saved, so they looked clean. The copy in memory would have
 * been the last one in existence.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let failures = 0;
function check(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}${detail && !condition ? ` — ${detail}` : ''}`);
}

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const dbFile = path.join(os.tmpdir(), `notenough-storage-${stamp}.json`);
const messagesFile = dbFile.replace(/\.json$/, '') + '.messages.json';
process.env.DB_FILE = dbFile;

const aMessage = (body) => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  eventId: 'e1',
  userId: 'u1',
  body,
  createdAt: new Date().toISOString(),
});

const mtime = async (file) => (await fs.stat(file)).mtimeMs;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

try {
  console.log('\nStorage tests\n');

  /* ------------------------------------------------------------ migration */

  console.log(' a database written before the split');
  await fs.writeFile(
    dbFile,
    JSON.stringify({ users: [{ id: 'u1', name: 'Old' }], messages: [aMessage('from before')] }),
  );

  const db = await import(`../src/db.js?${stamp}`);
  const loaded = await db.read();
  check('its messages are carried into memory', loaded.messages.length === 1,
    String(loaded.messages.length));
  check('and so is everything else', loaded.users.length === 1);

  await db.write((data) => data.users.push({ id: 'u2', name: 'New' }));
  const core = JSON.parse(await fs.readFile(dbFile, 'utf8'));
  check('the next write drops them from the core file', core.messages === undefined);
  const moved = JSON.parse(await fs.readFile(messagesFile, 'utf8'));
  check('and writes them to their own', moved.length === 1 && moved[0].body === 'from before',
    JSON.stringify(moved));

  /* --------------------------------------------------- writing one or other */

  console.log('\n which file a write touches');
  await settle();
  const coreBefore = await mtime(dbFile);
  const chatBefore = await mtime(messagesFile);

  await db.write((data) => data.messages.push(aMessage('a new announcement')));
  check('posting leaves the core file alone', (await mtime(dbFile)) === coreBefore,
    `${coreBefore} then ${await mtime(dbFile)}`);
  check('and rewrites only the messages file', (await mtime(messagesFile)) > chatBefore);

  await settle();
  const chatMid = await mtime(messagesFile);
  await db.write((data) => data.teams.push({ id: 't1', name: 'Squad' }));
  check('an ordinary write leaves the messages file alone',
    (await mtime(messagesFile)) === chatMid);
  check('and rewrites the core', (await mtime(dbFile)) > coreBefore);

  await settle();
  const coreIdle = await mtime(dbFile);
  const chatIdle = await mtime(messagesFile);
  await db.write(() => 'nothing changed');
  check('a write that changes nothing rewrites nothing',
    (await mtime(dbFile)) === coreIdle && (await mtime(messagesFile)) === chatIdle);

  /* ------------------------------------------------------------ reloading */

  console.log('\n reading it back');
  db.resetCache();
  const again = await db.read();
  check('messages survive a restart', again.messages.length === 2, String(again.messages.length));
  check('and the rest of the database with them',
    again.users.length === 2 && again.teams.length === 1,
    `${again.users.length} users, ${again.teams.length} teams`);

  /* -------------------------------------------------------------- corrupt */

  console.log('\n a corrupt file');
  await fs.writeFile(messagesFile, '{ this is not json');
  db.resetCache();
  let complained = '';
  try {
    await db.read();
  } catch (error) {
    complained = error.message;
  }
  check('is loud rather than silently empty', /not valid JSON/.test(complained), complained);
  check('and says which file', complained.includes(messagesFile), complained);
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  await fs.rm(dbFile, { force: true });
  await fs.rm(messagesFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
