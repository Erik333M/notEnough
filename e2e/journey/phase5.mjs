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
await page.getByPlaceholder('Alex Carter').fill('Phase Five');
await page.getByPlaceholder('you@example.com').fill(`p5-${Date.now()}@example.com`);
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

check('measurements reachable from home', (await body()).includes('Measurements'));
await page.getByText('Measurements', { exact: true }).first().click();
await page.waitForTimeout(1000);
let t = await body();
check('empty state is inviting', t.includes('Nothing tracked yet'));
check('baseline card offers a skip', t.includes('or skip it entirely'));
check('no wall of empty charts', !t.includes('Body fat') && !t.includes('Water'));
await shot('p5-01-empty');

/* --- weight-only user gets a usable screen --- */
await page.getByText('Log a reading', { exact: true }).first().click();
await page.waitForTimeout(800);
t = await body();
check('sheet opens with weight only', t.includes('Weight') && t.includes('Add another reading'));
const visibleInputs = await page.locator('input').count();
check(`sheet is not a wall of inputs (${visibleInputs})`, visibleInputs <= 3, `${visibleInputs}`);
check('other metrics are opt-in chips', t.includes('Body fat') && t.includes('Breathing recovery'));
await shot('p5-02-sheet');

await page.getByLabel('Weight in kg').first().fill('82.5');
await page.getByText('Save reading', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('weight card appears', t.includes('WEIGHT') && t.includes('82.5 kg'));
check('one point is not yet a chart', t.includes('Log this once more and a line appears'));
check('still no cards for untracked metrics', !t.includes('BODY FAT'));

/* --- second reading draws a chart --- */
await page.getByText('Log a reading', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByLabel('Weight in kg').first().fill('81');
await page.getByText('Body fat', { exact: true }).last().click();
await page.waitForTimeout(400);
await page.getByLabel('Body fat in %').first().fill('19.5');
await page.getByText('Save reading', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('two readings recorded', t.includes('2 readings'));
// 82.5 was logged first, then 81 — both today. Latest must be the second one.
check('latest is the most recently logged, not the first of the day', t.includes('81 kg'), t.match(/[\d.]+ kg/)?.[0] ?? '?');
check('change is signed correctly for same-day readings', t.includes('-1.5 since the first'),
  t.match(/[+-][\d.]+ since the first/)?.[0] ?? 'no change shown');
check('body fat now has its own card', t.includes('BODY FAT') && t.includes('19.5 %'));
await shot('p5-03-charts');

/* --- unit switch converts, never corrupts --- */
await page.getByText('lb / in', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('weight converts to pounds', /17[0-9](\.\d)? lb/.test(t), t.match(/[\d.]+ lb/)?.[0] ?? 'no lb');
check('percentages are unit-agnostic', t.includes('19.5 %'));
await page.getByText('kg / cm', { exact: true }).first().click();
await page.waitForTimeout(900);
check('switching back restores the exact kg value', (await body()).includes('81 kg'));

/* --- baseline --- */
await page.getByLabel('Add your baseline figures').first().click();
await page.waitForTimeout(800);
t = await body();
check('baseline is all optional', t.includes('All optional'));
check('target weight is not prescribed', t.includes('The app never suggests a number'));
await page.getByPlaceholder('Leave blank if you do not know').first().fill('178');
await page.getByText('Save baseline', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
const cardText = await page.getByLabel('Edit your baseline figures').first().innerText();
check('baseline saved and summarised', cardText.includes('Height') && cardText.includes('178 cm'));
check('unset baseline figures are omitted, not shown as dashes',
  !cardText.includes('Target') && !cardText.includes('—'), cardText.replace(/\n/g, ' | '));

/* --- out-of-range is refused --- */
await page.getByText('Log a reading', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByLabel('Weight in kg').first().fill('900');
await page.getByText('Save reading', { exact: true }).first().click();
await page.waitForTimeout(700);
check('an impossible weight is refused', (await body()).includes('looks out of range'));
await page.getByLabel('Weight in kg').first().fill('80');
await page.getByText('Save reading', { exact: true }).first().click();
await page.waitForTimeout(900);
check('a sane weight saves', (await body()).includes('3 readings'));

/* --- edit and delete a reading --- */
await page.getByLabel(/^Reading from .*Tap to edit/).first().click();
await page.waitForTimeout(800);
check('editing shows the fields that reading holds', await page.getByLabel('Weight in kg').first().isVisible());
await page.getByText('Delete this reading', { exact: true }).first().click();
await page.waitForTimeout(900);
check('reading deleted', (await body()).includes('2 readings'));

/* --- survives a reload --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1000);
check('home reports the reading count', /\d+ readings/.test(await body()));
await page.getByText('Measurements', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('readings survived a reload', t.includes('81 kg') && t.includes('19.5 %'));
check('baseline survived a reload', t.includes('178 cm'));
await shot('p5-04-after-reload');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
