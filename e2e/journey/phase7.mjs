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

/** Opens one of the home screen's link rows by its accessibility label. */
async function openLink(name) {
  const row = page.getByLabel(new RegExp(`^${name}\\.`)).first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.waitForTimeout(1000);
}

async function register(name) {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByText('Create account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Alex Carter').fill(name);
  await page.getByPlaceholder('you@example.com').fill(`p7-${Date.now()}@example.com`);
  await page.getByPlaceholder('At least 6 characters').fill('runfast123');
  await page.getByText('Create account', { exact: true }).last().click();
  await page.getByText('Daily goals', { exact: true }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.getByText('Journey', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1400);
}

/* ---------- onboarding appears, and the skip is never buried ---------- */
await register('Phase Seven');
let t = await body();
check('onboarding shows on first open', t.includes('One page a day'));
check('skip offered on the very first screen', t.includes('Skip, take me to today'));
check('no sensitive question before the why-we-ask gate',
  !t.includes('injur') && !t.includes('medical') && !t.includes('Emergency'));
await shot('p7-01-welcome');

await page.getByText('Next', { exact: true }).first().click();
await page.waitForTimeout(700);
t = await body();
check('why-we-ask gate explains what is collected', t.includes('Why we ask'));
check('it promises local-only storage', t.includes('Kept on this phone'));
check('it promises no sync', t.includes('never part of any sync'));
check('it says skipping is normal', t.includes('perfectly normal answer'));
await shot('p7-02-why');

await page.getByText('Answer them', { exact: true }).first().click();
await page.waitForTimeout(800);
t = await body();
check('questions come only after the gate', t.includes('A few questions') && t.includes('Emergency contact'));
check('every question is optional', t.includes('Leave the rest blank'));
await shot('p7-03-questions');

/* ---------- answering, and the data staying local ---------- */
await page.getByText('Yes', { exact: true }).first().click();
await page.getByText('4', { exact: true }).first().click();
await page.getByPlaceholder('Football, climbing, none').fill('Climbing');
await page.getByPlaceholder('Leave blank if none').first().fill('Left knee, 2024');
await page.waitForTimeout(300);
await page.getByText('Save and start', { exact: true }).first().click();
await page.waitForTimeout(1400);
t = await body();
check('saving lands on today', t.includes('DECISION') && t.includes('PLUS ONE'));
check('onboarding does not reappear', !t.includes('One page a day'));

/* the sensitive answers must never reach the synced payload */
const synced = await page.evaluate(async () => {
  const keys = Object.keys(window.localStorage);
  return keys.map((k) => `${k}::${window.localStorage.getItem(k) ?? ''}`).join('\n');
});
check('injury text is not in the synced app state',
  !/ne\.state\.[^\n]*Left knee/.test(synced), 'found in app state');
check('injury text is stored under its own key',
  /ne\.journey\.intake[^\n]*Left knee/.test(synced), 'not found under the intake key');

/* ---------- onboarding is once-only across a reload ---------- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1400);
check('onboarding stays gone after a reload', !(await body()).includes('One page a day'));

/* ---------- progress overview ---------- */
t = await body();
check('progress reachable from home', t.includes('A quiet summary'));
await openLink('Progress');
t = await body();
check('empty progress states what it is for', t.includes('Nothing to summarise yet'));
check('privacy control is findable afterwards', t.includes('Your answers'));
check('it repeats the local-only promise', t.includes('never synced'));
check('withdrawal is offered', t.includes('Delete my answers'));
await shot('p7-04-progress-empty');

/* ---------- withdrawal actually deletes ---------- */
await page.getByText('Delete my answers', { exact: true }).first().click();
await page.waitForTimeout(500);
check('deletion asks for confirmation', (await body()).includes('Delete them'));
await page.getByText('Delete them', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('deletion is confirmed to the user', t.includes('deleted from this device'));
check('copy flips to the skipped wording', t.includes('Nothing about your health is stored'));
const after = await page.evaluate(() =>
  Object.keys(window.localStorage).map((k) => window.localStorage.getItem(k) ?? '').join('\n'));
check('injury text is gone from storage', !after.includes('Left knee'));

/* ---------- progress fills in as the feature is used ---------- */
await page.getByLabel('Back to the journey home').first().click();
await page.waitForTimeout(900);
await page.getByText('Physical', { exact: true }).first().click();
await page.waitForTimeout(700);
await openLink('Progress');
t = await body();
check('a written day reaches the summary', t.includes('This month') && t.includes('Day streak'));
check('records section explains itself when empty', t.includes('becomes a record to beat'));
await shot('p7-05-progress-filled');

/* ---------- every empty state does work ---------- */
await page.getByLabel('Back to the journey home').first().click();
await page.waitForTimeout(800);
for (const [link, marker] of [
  ['Habits', 'No habits yet'],
  ['Measurements', 'Nothing tracked yet'],
]) {
  await openLink(link);
  check(`${link} empty state says what it is for`, (await body()).includes(marker));
  await page.getByLabel('Back to the journey home').first().click();
  await page.waitForTimeout(800);
}

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
