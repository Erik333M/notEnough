import { chromium } from 'playwright';
import path from 'node:path';
const SHOTS = process.env.S;
let fails = 0; const errors = [];
const check = (l, ok, d = '') => { if (!ok) fails++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${l}${!ok && d ? ` — ${d}` : ''}`); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`) });
const body = () => page.locator('body').innerText();

await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('Create account', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Alex Carter').fill('Phase Four');
await page.getByPlaceholder('you@example.com').fill(`p4-${Date.now()}@example.com`);
await page.getByPlaceholder('At least 6 characters').fill('runfast123');
await page.getByText('Create account', { exact: true }).last().click();
await page.getByText('Daily goals', { exact: true }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1000);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1400);
// Phase 7 added a one-time onboarding gate in front of the feature. These
// drives are about what comes after it, so dismiss it the way most users will.
if ((await page.locator('body').innerText()).includes('One page a day')) {
  await page.getByText('Skip, take me to today', { exact: true }).first().click();
  await page.waitForTimeout(1200);
}

let t = await body();
check('benchmarks reachable from home', t.includes('Benchmarks'));
check('untested state is inviting, not a zero', t.includes('Test something once, then beat it later'));

await page.getByText('Benchmarks', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('list opens grouped', t.includes('CARDIO') && t.includes('GYMNASTICS') && t.includes('WEIGHTLIFTING'));
check('seeded tests present', t.includes('400 m run') && t.includes('Deadlift, one rep max'));
check('untested rows say so', t.includes('Not tested'));
await shot('p4-01-list');

/* --- a TIME benchmark: lower is better --- */
await page.getByText('400 m run', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('detail shows measurement direction', t.includes('lower is better'));
check('untested detail has an empty state', t.includes('Not tested yet'));
await shot('p4-02-detail-empty');

await page.getByText('Log a result', { exact: true }).first().click();
await page.waitForTimeout(700);
check('time metric gets minutes and seconds', await page.getByLabel('Minutes').first().isVisible());
await page.getByLabel('Minutes').first().fill('1');
await page.getByLabel('Seconds').first().fill('20');
await page.getByText('Log result', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('time renders as m:ss, not raw seconds', t.includes('1:20'));
check('first result is a personal best', t.includes('PB'));
check('one point is not yet a trend', t.includes('Log it once more and a trend line appears'));

// a SLOWER time must NOT be a PB
await page.getByText('Log a result', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByLabel('Minutes').first().fill('1');
await page.getByLabel('Seconds').first().fill('35');
await page.getByText('Log result', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('slower time logged', t.includes('1:35'));
const pbCount = (t.match(/\bPB\b/g) || []).length;
check('a slower time is not a PB', pbCount === 1, `${pbCount} PB badges`);
check('best still shows the faster time', /Best/.test(t) && t.includes('1:20'));
check('two points draw a trend', t.includes('down is an improvement'));
await shot('p4-03-detail-time');

/* --- back-filling must not steal the badge --- */
await page.getByText('Log a result', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByLabel('Minutes').first().fill('2');
await page.getByLabel('Seconds').first().fill('0');
await page.getByText('Log result', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
const pbAfter = (t.match(/\bPB\b/g) || []).length;
check('back-filled slower result adds no PB badge', pbAfter === 1, `${pbAfter} badges`);

/* --- editing a result --- */
await page.getByLabel(/^2:00 on /).first().click();
await page.waitForTimeout(700);
check('tapping a result opens it for editing', await page.getByText('Save changes', { exact: true }).first().isVisible());
await page.getByLabel('Seconds').first().fill('30');
await page.getByText('Save changes', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('edit persisted', t.includes('2:30') && !t.includes('2:00'));

/* --- deleting a result --- */
await page.getByLabel(/^2:30 on /).first().click();
await page.waitForTimeout(700);
await page.getByText('Delete this result', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('result deleted', !t.includes('2:30'));

/* --- a WEIGHT benchmark: higher is better, kg round trip --- */
await page.getByLabel('Back to benchmarks').first().click();
await page.waitForTimeout(800);
await page.getByText('Deadlift, one rep max', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('weight metric says higher is better', t.includes('higher is better'));
await page.getByText('Log a result', { exact: true }).first().click();
await page.waitForTimeout(700);
check('weight metric gets a single kg box', await page.getByLabel(/^Weight in kg/).first().isVisible());
await page.getByLabel(/^Weight in kg/).first().fill('120');
await page.getByText('Log result', { exact: true }).first().click();
await page.waitForTimeout(900);
check('weight stored and shown with its unit', (await body()).includes('120 kg'));

/* --- custom benchmark --- */
await page.getByLabel('Back to benchmarks').first().click();
await page.waitForTimeout(800);
await page.getByLabel('Add a benchmark').first().click();
await page.waitForTimeout(700);
t = await body();
check('new-benchmark sheet explains the metric consequence', t.includes('A personal best is the'));
await page.getByPlaceholder('2 km row').fill('2 km row');
await page.getByText('Time', { exact: true }).last().click();
await page.waitForTimeout(300);
check('choosing time flips the PB direction copy', (await body()).includes('lowest'));
await page.getByText('Add benchmark', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('creating opens the new benchmark', t.includes('2 km row') && t.includes('Not tested yet'));
await shot('p4-04-custom');

/* --- custom can be deleted; seeded cannot --- */
check('custom benchmark can be deleted', await page.getByLabel(/^Delete the 2 km row/).first().isVisible());
await page.getByLabel('Back to benchmarks').first().click();
await page.waitForTimeout(800);
await page.getByText('400 m run', { exact: true }).first().click();
await page.waitForTimeout(800);
check('seeded benchmark has no delete affordance', (await page.getByLabel(/^Delete the /).count()) === 0);

/* --- survives reload --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1000);
t = await body();
check('home reports tested count', /\d+ tested/.test(t));
await page.getByText('Benchmarks', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('results survived a reload', t.includes('1:20') && t.includes('120 kg'));
check('custom benchmark survived a reload', t.includes('2 km row'));
await shot('p4-05-list-after-reload');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
