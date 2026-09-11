/**
 * Domain checks for the training-group state layer. No browser, no app.
 *
 * Compile the slice to CommonJS first (expo-crypto has no Node build, so its
 * makeId is stubbed):
 *
 *   npx tsc --ignoreConfig src/state/group/*.ts src/state/journey/coerce.ts \
 *     --outDir /tmp/gbuild --rootDir src --module commonjs --target es2020 \
 *     --resolveJsonModule --esModuleInterop --skipLibCheck --strict
 *   mkdir -p /tmp/gbuild/lib
 *   echo "const {randomUUID}=require('node:crypto');exports.makeId=()=>randomUUID();" \
 *     > /tmp/gbuild/lib/crypto.js
 *
 *   B=/tmp/gbuild node e2e/group/domain-smoke.js
 */

const assert = require('node:assert');
const B = process.env.B;
const { migrateGroups, GROUP_SCHEMA_VERSION } = require(`${B}/state/group/schema.js`);
const { groupReducer } = require(`${B}/state/group/reducer.js`);
const { createGroupActions } = require(`${B}/state/group/actions.js`);
const { createGroupState } = require(`${B}/state/group/factory.js`);
const S = require(`${B}/state/group/selectors.js`);

let pass = 0;
const ok = (n, f) => { f(); console.log('  ok', n); pass++; };

console.log('\n— migration is total —');
ok('anything at all yields a valid slice', () => {
  for (const junk of [undefined, null, 42, 'no', [], true]) {
    const s = migrateGroups(junk);
    assert.equal(s.schemaVersion, GROUP_SCHEMA_VERSION);
    assert.ok(Array.isArray(s.groups) && Array.isArray(s.assignments));
  }
});
ok('bad rows are dropped, good ones survive', () => {
  const s = migrateGroups({
    groups: [{ id: 'g1', name: 'U16' }, { name: '' }, 'junk'],
    players: [
      { id: 'p1', groupId: 'g1', name: 'Ana', level: 'nonsense' },
      { id: 'p2', groupId: 'ghost', name: 'Orphan' },
      { groupId: 'g1' },
    ],
    tasks: [{ id: 't1', planId: 'plan1', title: 'Sprints', target: -5 }],
  });
  assert.equal(s.groups.length, 1, 'nameless + junk groups dropped');
  assert.ok(s.groups[0].inviteCode.length === 6, 'invite code minted for legacy rows');
  assert.equal(s.players.length, 1, 'orphan and nameless players dropped');
  assert.equal(s.players[0].level, 'Starter', 'bad level defaulted');
  assert.equal(s.tasks.length, 0, 'task whose plan does not exist is pruned');
});
ok('orphans are pruned on load', () => {
  const s = migrateGroups({
    groups: [{ id: 'g1', name: 'A' }],
    plans: [{ id: 'pl1', groupId: 'g1', name: 'Plan' }, { id: 'pl2', groupId: 'gone', name: 'X' }],
    tasks: [{ id: 't1', planId: 'pl1', title: 'Run' }, { id: 't2', planId: 'pl2', title: 'Ghost' }],
  });
  assert.equal(s.plans.length, 1);
  assert.equal(s.tasks.length, 1, 'task under the dropped plan went too');
});
ok('round-trips through JSON unchanged', () => {
  const once = migrateGroups({ groups: [{ id: 'g', name: 'Squad' }] });
  assert.deepEqual(migrateGroups(JSON.parse(JSON.stringify(once))), once);
});

console.log('\n— reducer —');
let st = createGroupState(GROUP_SCHEMA_VERSION);
const A = createGroupActions((a) => { st = groupReducer(st, a); });

ok('a group gets a readable invite code', () => {
  const g = A.addGroup('U16 Squad');
  assert.match(g.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/, g.inviteCode);
});
ok('no-op edit returns the identical object', () => {
  const before = st;
  const after = groupReducer(st, { type: 'group/update', id: 'nope', patch: { name: 'x' } });
  assert.strictEqual(after, before);
});
ok('players carry a level', () => {
  const g = st.groups[0];
  A.addPlayer(g.id, 'Ana', 'Advanced');
  A.addPlayer(g.id, 'Bo');
  const roster = S.playersInGroup(st, g.id);
  assert.deepEqual(roster.map((p) => p.name), ['Ana', 'Bo'], 'alphabetical');
  assert.equal(roster[0].level, 'Advanced');
  assert.equal(roster[1].level, 'Starter', 'defaults to Starter');
  assert.equal(roster[0].linkedUserId, null, 'no real account linked yet');
});
ok('one task assigns to a whole squad in one action', () => {
  const g = st.groups[0];
  const plan = A.addPlan(g.id, 'Pre-season');
  const task = A.addTask(plan.id, 'Sprints', 'reps', 0);
  const ids = S.playersInGroup(st, g.id).map((p) => p.id);
  const made = A.assignTask(task.id, ids, '2026-09-14');
  assert.equal(made.length, 2);
  assert.equal(st.assignments.length, 2);
  assert.equal(S.assignedPlayerIds(st, task.id, '2026-09-14').size, 2);
});
ok('progress counts against the task target', () => {
  const g = st.groups[0];
  const task = st.tasks[0];
  assert.equal(task.target, 20, 'reps default');
  const [a1, a2] = st.assignments;
  A.setProgress(a1.id, 20);
  assert.equal(S.isComplete(st.assignments[0], task), true, 'hitting the target completes it');
  assert.equal(S.isComplete(st.assignments[1], task), false);
  const prog = S.groupProgress(st, g.id);
  assert.deepEqual([prog.total, prog.complete], [2, 1]);
  assert.equal(prog.ratio, 0.5);
});
ok('an explicit done survives falling short of the target', () => {
  const task = st.tasks[0];
  const a2 = st.assignments[1];
  A.setProgress(a2.id, 4);
  A.setDone(a2.id, true);
  const updated = st.assignments.find((a) => a.id === a2.id);
  assert.equal(updated.amount, 4);
  assert.equal(S.isComplete(updated, task), true, 'the trainer judgement wins');
});
ok('reordering tasks is a stored change', () => {
  const plan = st.plans[0];
  const second = A.addTask(plan.id, 'Cooldown', 'minutes', 1);
  A.reorderTasks(plan.id, [second.id, st.tasks[0].id]);
  assert.deepEqual(S.tasksInPlan(st, plan.id).map((t) => t.title), ['Cooldown', 'Sprints']);
});

console.log('\n— deletes cascade —');
ok('deleting a task removes its assignments', () => {
  const before = st.assignments.length;
  assert.ok(before > 0);
  A.deleteTask(st.tasks.find((t) => t.title === 'Sprints').id);
  assert.equal(st.assignments.length, 0, 'no orphaned assignments');
});
ok('deleting a player removes only their assignments', () => {
  let s2 = createGroupState(1);
  const a2 = createGroupActions((a) => { s2 = groupReducer(s2, a); });
  const g = a2.addGroup('T');
  const p1 = a2.addPlayer(g.id, 'One');
  const p2 = a2.addPlayer(g.id, 'Two');
  const plan = a2.addPlan(g.id, 'P');
  const task = a2.addTask(plan.id, 'Work', 'check', 0);
  a2.assignTask(task.id, [p1.id, p2.id], '2026-09-14');
  a2.deletePlayer(p1.id);
  assert.equal(s2.assignments.length, 1);
  assert.equal(s2.assignments[0].playerId, p2.id);
});
ok('deleting a group takes everything under it', () => {
  let s3 = createGroupState(1);
  const a3 = createGroupActions((a) => { s3 = groupReducer(s3, a); });
  const g = a3.addGroup('Doomed');
  const p = a3.addPlayer(g.id, 'Ana');
  const plan = a3.addPlan(g.id, 'Plan');
  const task = a3.addTask(plan.id, 'Task', 'check', 0);
  a3.assignTask(task.id, [p.id], '2026-09-14');
  a3.deleteGroup(g.id);
  assert.deepEqual(
    [s3.groups.length, s3.players.length, s3.plans.length, s3.tasks.length, s3.assignments.length],
    [0, 0, 0, 0, 0],
  );
});

console.log(`\n${pass} checks passed\n`);
