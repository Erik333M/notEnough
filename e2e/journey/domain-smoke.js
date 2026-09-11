/**
 * Domain-level checks for the Success Journey state layer.
 *
 * These exercise the reducers, migrations and selectors directly — no browser,
 * no app. They cover the rules that are easy to get wrong and invisible on
 * screen: ordering of same-day records, personal-best direction, what counts
 * as a missed day, and that a corrupt payload degrades instead of throwing.
 *
 * The state layer is TypeScript, so compile it to CommonJS first:
 *
 *   npx tsc --ignoreConfig src/state/journey/*.ts \
 *     --outDir /tmp/journey-build --rootDir src --module commonjs \
 *     --target es2020 --resolveJsonModule --esModuleInterop --skipLibCheck --strict
 *
 * `expo-crypto` and `expo-secure-store` have no Node build, so stub them:
 *
 *   mkdir -p /tmp/journey-build/lib
 *   echo "const {randomUUID}=require('node:crypto');exports.makeId=()=>randomUUID();" \
 *     > /tmp/journey-build/lib/crypto.js
 *   printf "const m=new Map();exports.secureGet=async(k,f)=>m.has(k)?m.get(k):f;\
 *   exports.secureSet=async(k,v)=>void m.set(k,v);\
 *   exports.secureDelete=async k=>void m.delete(k);" > /tmp/journey-build/lib/secure.js
 *
 *   B=/tmp/journey-build node e2e/journey/domain-smoke.js
 */

const assert = require('node:assert');
const B = process.env.B;
const { migrateJourney, JOURNEY_SCHEMA_VERSION } = require(`${B}/state/journey/schema.js`);
const { journeyReducer } = require(`${B}/state/journey/reducer.js`);
const { createJourneyActions } = require(`${B}/state/journey/actions.js`);
const { createJourneyState } = require(`${B}/state/journey/factory.js`);
const E = require(`${B}/state/journey/entries.js`);
const Bm = require(`${B}/state/journey/benchmarks.js`);
const Mv = require(`${B}/state/journey/movements.js`);
const Hb = require(`${B}/state/journey/habits.js`);
const Ms = require(`${B}/state/journey/measurements.js`);

let pass = 0;
const ok = (name, fn) => { fn(); console.log('  ok', name); pass++; };

console.log('\n— migration is total —');
ok('undefined -> valid slice', () => {
  const s = migrateJourney(undefined);
  assert.equal(s.schemaVersion, JOURNEY_SCHEMA_VERSION);
  assert.deepEqual(s.entries, {}); assert.equal(s.units, 'metric');
});
ok('garbage scalars -> valid slice', () => {
  for (const junk of [null, 42, 'nope', [], true]) {
    const s = migrateJourney(junk);
    assert.equal(s.schemaVersion, JOURNEY_SCHEMA_VERSION);
    assert.ok(Array.isArray(s.results));
  }
});
ok('corrupt fields are repaired, good ones survive', () => {
  const s = migrateJourney({
    schemaVersion: 1,
    entries: {
      '2026-09-06': { theme: 'Grit', plusOne: { physical: true, bogus: true }, decision: { text: 'Call mum', done: 'yes' } },
      'not-a-date': { theme: 'dropped' },
    },
    movements: [{ name: 'Sled push', category: 'nonsense' }, { name: '' }, 'junk'],
    results: [{ definitionId: 'bm-deadlift-1rm', date: '2026-09-01', value: 140 }, { definitionId: 'x' }],
    measurements: [{ date: '2026-09-01', weightKg: 82.5, bodyFatPct: 900 }],
    units: 'klingon',
  });
  assert.ok(s.entries['2026-09-06'], 'valid day kept');
  assert.equal(s.entries['2026-09-06'].theme, 'Grit');
  assert.equal(s.entries['2026-09-06'].plusOne.physical, true);
  assert.equal(s.entries['2026-09-06'].plusOne.bogus, undefined, 'unknown plusOne key dropped');
  assert.equal(s.entries['2026-09-06'].decision.done, null, 'non-boolean done -> unanswered');
  assert.equal(s.entries['not-a-date'], undefined, 'non-day key dropped');
  assert.equal(s.movements.length, 1, 'nameless + junk movements dropped');
  assert.equal(s.movements[0].category, 'strength', 'bad category defaulted');
  assert.equal(s.results.length, 1, 'result with no date/value dropped');
  assert.equal(s.measurements[0].weightKg, 82.5);
  assert.equal(s.measurements[0].bodyFatPct, null, 'out-of-range % -> null');
  assert.equal(s.units, 'metric', 'bad enum defaulted');
});
ok('future version keeps what it can read', () => {
  const s = migrateJourney({ schemaVersion: 99, entries: { '2026-09-06': { theme: 'from the future' } }, unknownField: 1 });
  assert.equal(s.entries['2026-09-06'].theme, 'from the future');
});
ok('round-trips through JSON unchanged', () => {
  const once = migrateJourney({ entries: { '2026-09-06': { theme: 'Stable' } } });
  assert.deepEqual(migrateJourney(JSON.parse(JSON.stringify(once))), once);
});

console.log('\n— reducer —');
const D = '2026-09-07';
let st = createJourneyState(JOURNEY_SCHEMA_VERSION);
const act = (a) => { st = journeyReducer(st, a); };
const A = createJourneyActions(act);

ok('reading a day never writes it', () => {
  const e = E.entryFor(st, '2020-01-01');
  assert.equal(e.theme, '');
  assert.equal(Object.keys(st.entries).length, 0, 'no record created');
});
ok('no-op edit returns the identical object', () => {
  const before = st;
  const after = journeyReducer(st, { type: 'entry/setText', date: D, field: 'theme', value: '' });
  assert.strictEqual(after, before, 'identity preserved -> no updatedAt stamp, no sync push');
});
ok('plusOne toggle creates the day lazily', () => {
  A.togglePlusOne(D, 'physical');
  assert.equal(st.entries[D].plusOne.physical, true);
  assert.equal(E.plusOneCount(st.entries[D].plusOne), 1);
});
ok('done cycles unanswered -> yes -> no -> unanswered', () => {
  const seen = [];
  let cur = st.entries[D].decision.done;
  for (let i = 0; i < 3; i++) { A.cycleIntentionDone(D, 'decision', cur); cur = st.entries[D].decision.done; seen.push(cur); }
  assert.deepEqual(seen, [true, false, null]);
});
ok('wod edit lazily creates the workout', () => {
  assert.equal(st.entries[D].wod, null);
  A.toggleWodTag(D, 'W');
  assert.deepEqual(st.entries[D].wod.tags, ['W']);
  A.setWodRounds(D, 3); assert.equal(st.entries[D].wod.rounds, 3);
  A.setWodRounds(D, 3); assert.equal(st.entries[D].wod.rounds, null, 'tapping the same round clears it');
});
ok('empty wod lines are pruned on close', () => {
  A.addWodLine(D); A.addWodLine(D);
  const id = st.entries[D].wod.lines[0].id;
  A.updateWodLine(D, id, { reps: 20, freeText: 'Thruster' });
  assert.equal(st.entries[D].wod.lines.length, 2);
  A.pruneWodLines(D);
  assert.equal(st.entries[D].wod.lines.length, 1, 'blank row dropped, filled row kept');
  assert.equal(st.entries[D].wod.lines[0].freeText, 'Thruster');
});
ok('deleting a benchmark takes its results with it', () => {
  const def = A.addBenchmark('Sled sprint', 'monostructural', 'time');
  A.logResult(def.id, '2026-09-01', 41);
  assert.equal(st.results.length, 1);
  A.deleteBenchmark(def.id);
  assert.equal(st.results.length, 0, 'no orphaned results');
});
ok('habit tick then untick leaves no empty day', () => {
  const h = A.addHabit('Walk', 'health');
  A.toggleHabitCheck(D, h.id);
  assert.equal(Hb.isChecked(st.checks, D, h.id), true);
  A.toggleHabitCheck(D, h.id);
  assert.equal(st.checks[D], undefined, 'day removed once its last tick is gone');
});
ok('archiving a habit keeps its history', () => {
  const h = A.addHabit('Read', 'mind');
  A.toggleHabitCheck(D, h.id);
  A.archiveHabit(h.id);
  assert.equal(Hb.activeHabits(st).find((x) => x.id === h.id), undefined);
  assert.equal(Hb.isChecked(st.checks, D, h.id), true, 'ticks survive archiving');
});

console.log('\n— benchmark PR direction —');
ok('lower wins for time, higher for weight', () => {
  assert.equal(Bm.lowerIsBetter('time'), true);
  assert.equal(Bm.lowerIsBetter('duration'), false);
  assert.equal(Bm.isBetter('time', 40, 45), true);
  assert.equal(Bm.isBetter('weight', 140, 145), false);
});
ok('back-filling an old session does not steal the PR badge', () => {
  let s2 = createJourneyState(1);
  const a2 = createJourneyActions((a) => { s2 = journeyReducer(s2, a); });
  const r1 = a2.logResult('bm-deadlift-1rm', '2026-03-01', 120);
  const r2 = a2.logResult('bm-deadlift-1rm', '2026-06-01', 140);
  const back = a2.logResult('bm-deadlift-1rm', '2026-01-01', 100);
  const rows = Bm.resultsFor(s2, 'bm-deadlift-1rm');
  const at = (r) => rows.findIndex((x) => x.id === r.id);
  assert.equal(Bm.wasPersonalBest(rows, 'weight', at(back)), true, 'first-ever lift is a PB');
  assert.equal(Bm.wasPersonalBest(rows, 'weight', at(r1)), true, '120 still beat 100');
  assert.equal(Bm.wasPersonalBest(rows, 'weight', at(r2)), true, '140 still the record');
  assert.equal(Bm.personalBest(s2, { id: 'bm-deadlift-1rm', metric: 'weight' }).value, 140);
});
ok('same-day results are ranked by insertion order, not random id', () => {
  // Regression: ids are random UUIDs, so a tie-break on id decided the badge
  // by coin flip. Run it repeatedly — a flaky rule would show up here.
  for (let attempt = 0; attempt < 50; attempt++) {
    let s4 = createJourneyState(1);
    const a4 = createJourneyActions((a) => { s4 = journeyReducer(s4, a); });
    a4.logResult('bm-run-400m', '2026-09-07', 80);   // first: a PB
    a4.logResult('bm-run-400m', '2026-09-07', 95);   // slower, same day
    a4.logResult('bm-run-400m', '2026-09-07', 120);  // slower again, same day
    const rows = Bm.resultsFor(s4, 'bm-run-400m');
    const flags = rows.map((_, i) => Bm.wasPersonalBest(rows, 'time', i));
    assert.equal(flags.filter(Boolean).length, 1, 'exactly one PB among same-day results');
    // rows are newest-first, so the 80 (logged first) sits last
    assert.equal(rows[rows.length - 1].value, 80);
    assert.equal(flags[flags.length - 1], true, 'the fastest, logged first, holds the badge');
  }
});

ok('the trend line runs oldest to newest, same-day included', () => {
  let s5 = createJourneyState(1);
  const a5 = createJourneyActions((a) => { s5 = journeyReducer(s5, a); });
  a5.logResult('bm-run-400m', '2026-09-01', 100);
  a5.logResult('bm-run-400m', '2026-09-07', 80);   // same day, logged first
  a5.logResult('bm-run-400m', '2026-09-07', 95);   // same day, logged second
  const series = Bm.benchmarkSeries(s5, 'bm-run-400m').map((p) => p.value);
  assert.deepEqual(series, [100, 80, 95], 'chronological, and same-day in logging order');
});

ok('measurements read oldest-to-newest, same-day included', () => {
  let s6 = createJourneyState(1);
  const a6 = createJourneyActions((a) => { s6 = journeyReducer(s6, a); });
  a6.logMeasurement('2026-09-01', { weightKg: 84 });
  a6.logMeasurement('2026-09-08', { weightKg: 82.5 }); // same day, logged first
  a6.logMeasurement('2026-09-08', { weightKg: 81 });   // same day, logged second
  const series = Ms.metricSeries(s6, 'weightKg', 'metric').map((p) => p.value);
  assert.deepEqual(series, [84, 82.5, 81], 'chronological, same-day in logging order');
  assert.equal(Ms.latestValue(s6, 'weightKg', 'metric'), 81, 'latest is the last one logged');
  assert.equal(Ms.metricChange(Ms.metricSeries(s6, 'weightKg', 'metric')), -3, 'change is signed');
});
ok('a blank metric is absent, not zero', () => {
  let s7 = createJourneyState(1);
  const a7 = createJourneyActions((a) => { s7 = journeyReducer(s7, a); });
  a7.logMeasurement('2026-09-08', { weightKg: 80 });
  assert.equal(Ms.metricSeries(s7, 'bodyFatPct', 'metric').length, 0, 'untouched metric has no points');
  assert.equal(Ms.latestValue(s7, 'bodyFatPct', 'metric'), null);
});

console.log('\n— seeds merge, never persist —');
ok('seed catalogues load and search', () => {
  const all = Mv.allMovements(st);
  assert.ok(all.length > 30, 'seed movements loaded');
  assert.ok(all.every((m) => m.id && m.name));
  const hits = Mv.searchMovements(all, 'sn');
  assert.equal(hits[0].name, 'Snatch', 'prefix match ranks first');
  assert.ok(Mv.searchMovements(all, 't2b').some((m) => m.name === 'Toes to bar'), 'alias search works');
  assert.equal(st.movements.every((m) => m.isCustom), true, 'only custom movements are stored');
  assert.ok(Bm.allBenchmarks(st).length > 25, 'seed benchmarks loaded');
  assert.ok(Hb.HABIT_TEMPLATES.length > 10, 'seed habits loaded');
});

console.log('\n— habits —');
ok('days before a habit existed are not counted as misses', () => {
  let s8 = createJourneyState(1);
  const a8 = createJourneyActions((a) => { s8 = journeyReducer(s8, a); });
  const h = a8.addHabit('Walk', 'health');
  const today = new Date('2026-09-08T12:00:00');
  const history = Hb.habitHistory(s8.checks, s8.habits[0], 14, today);
  assert.equal(history.length, 14);
  const tracked = history.filter((d) => d.tracked);
  assert.equal(tracked.length, 1, 'only today is tracked for a habit added today');
  assert.equal(history.filter((d) => !d.tracked).length, 13, 'the rest are pre-adoption, not misses');
  assert.equal(tracked[0].key, history[13].key, 'the tracked day is today');
  // and the headline stat agrees with the dots
  assert.equal(Hb.habitConsistency(s8, 30, today), 0, 'nothing ticked yet');
  a8.toggleHabitCheck('2026-09-08', h.id);
  assert.equal(Hb.habitConsistency(s8, 30, today), 1, 'one of one possible day');
});
ok('archiving keeps the ticks and frees the template', () => {
  let s9 = createJourneyState(1);
  const a9 = createJourneyActions((a) => { s9 = journeyReducer(s9, a); });
  const t0 = Hb.HABIT_TEMPLATES[0];
  const h = a9.adoptTemplate(t0);
  a9.toggleHabitCheck('2026-09-08', h.id);
  assert.equal(Hb.availableTemplates(s9).some((t) => t.id === t0.id), false, 'adopted template is hidden');
  a9.archiveHabit(h.id);
  assert.equal(Hb.activeHabits(s9).length, 0, 'archived habit leaves the list');
  assert.equal(Hb.isChecked(s9.checks, '2026-09-08', h.id), true, 'its ticks survive');
  assert.equal(Hb.availableTemplates(s9).some((t) => t.id === t0.id), true, 'template offered again');
});

console.log('\n— strip + streak —');
ok('day strip is a fixed window', () => {
  const strip = E.dayStrip(st, 14, new Date('2026-09-07T12:00:00'));
  assert.equal(strip.length, 14);
  assert.equal(strip[13].isToday, true);
  assert.equal(strip[13].filled, true, 'today has content');
  assert.equal(strip[0].filled, false);
});
ok('an untouched today does not break a streak', () => {
  let s3 = createJourneyState(1);
  const a3 = createJourneyActions((a) => { s3 = journeyReducer(s3, a); });
  a3.togglePlusOne('2026-09-06', 'social');
  a3.togglePlusOne('2026-09-05', 'social');
  assert.equal(E.entryStreak(s3, new Date('2026-09-07T12:00:00')), 2, 'blank today is not a miss');
});

console.log(`\n${pass} checks passed\n`);
