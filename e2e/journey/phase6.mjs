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
await page.getByPlaceholder('Alex Carter').fill('Phase Six');
await page.getByPlaceholder('you@example.com').fill(`p6-${Date.now()}@example.com`);
await page.getByPlaceholder('At least 6 characters').fill('runfast123');
await page.getByText('Create account', { exact: true }).last().click();
// A new account is asked once how it will use the app; these drives are all
// solo-path, so they answer and move on.
await page.getByText('How will you use this?').waitFor({ timeout: 20000 });
await page.getByText('Train on my own', { exact: true }).click();
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
check('day 1 shows no habits card', !t.includes('HABITS'));
check('habits reachable from home', t.includes('One small thing, repeated daily'));

await page.getByText('Habits', { exact: true }).first().click();
await page.waitForTimeout(1000);
t = await body();
check('empty state is encouraging', t.includes('No habits yet') && t.includes('worst day'));
check('empty state has one primary action', t.includes('Add your first habit'));
await shot('p6-01-empty');

/* --- adopt a template --- */
await page.getByText('Add your first habit', { exact: true }).first().click();
await page.waitForTimeout(800);
t = await body();
check('template browser groups suggestions', t.includes('HEALTH') && t.includes('MIND'));
check('own habit comes first', t.includes('Your own'));
await shot('p6-02-templates');
await page.getByText('Read a few pages', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('adopted habit appears', t.includes('Read a few pages'));
const rowLabel = await page.getByLabel(/^Read a few pages\./).first().getAttribute('aria-label');
check('streak starts without a zero', /Start whenever/.test(rowLabel ?? '') && !/\b0 day/.test(rowLabel ?? ''), rowLabel ?? '');
check('summary appears once a habit exists', t.includes('0/1') && t.includes('Last 30 days'));

/* --- tick it --- */
await page.getByLabel(/^Read a few pages\. Not done today/).first().click();
await page.waitForTimeout(800);
t = await body();
check('ticking updates today count', t.includes('1/1'));
check('streak reads as started', t.includes('Started today'));
await shot('p6-03-ticked');

/* --- adopted templates disappear from the browser --- */
await page.getByText('Add another habit', { exact: true }).first().click();
await page.waitForTimeout(800);
// the habits list behind the sheet still shows the title, so count the
// adoptable rows instead of scanning the whole page
const offered = await page.getByLabel('Adopt: Read a few pages').count();
check('an adopted template is no longer offered', offered === 0, `${offered} offers`);

/* --- write a custom habit --- */
await page.getByPlaceholder('Ten minutes outside').fill('Cold shower');
await page.getByText('Money', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByText('Add this habit', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('custom habit added', t.includes('Cold shower'));
check('two habits running', t.includes('1/2'));

/* --- rename --- */
await page.getByLabel('Edit Cold shower').first().click();
await page.waitForTimeout(800);
check('edit sheet warns that ticks survive', (await body()).includes('keeps every day you already ticked'));
await page.getByPlaceholder('What are you trying to repeat?').fill('Cold shower, 60s');
await page.getByText('Save', { exact: true }).first().click();
await page.waitForTimeout(900);
check('rename persisted', (await body()).includes('Cold shower, 60s'));

/* --- home card + daily-line suggestions --- */
await page.getByLabel('Back to the journey home').first().click();
await page.waitForTimeout(900);
t = await body();
check('habits card now on home', t.includes('HABITS') && t.includes('Read a few pages'));
check('home card shows the done count', t.includes('1 of 2'));
check('home does not duplicate habit labels as chips', (await page.getByText('Cold shower, 60s', { exact: true }).count()) === 1);
await shot('p6-04-home');

// un-ticking from home works
await page.getByLabel(/^Read a few pages\. Done today/).first().click();
await page.waitForTimeout(800);
check('un-ticking from home works', (await body()).includes('0 of 2'));

// the full day page offers the habits as one-tap fills for its habit line
await page.getByText('Open the full page', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('full page offers habits as one-tap fills', t.includes('Cold shower, 60s') && t.includes('Read a few pages'));
await page.getByText('Cold shower, 60s', { exact: true }).first().click();
await page.waitForTimeout(900);
const line = await page.getByPlaceholder('Leave blank if today has no one thing').last().inputValue();
check('suggestion filled the daily habit line', line === 'Cold shower, 60s', line);
check('chips disappear once the line is written', !(await body()).includes('Read a few pages'));
await page.getByLabel('Back to the journey home').first().click();
await page.waitForTimeout(800);

/* --- archive keeps history --- */
await page.getByText('Manage habits', { exact: true }).first().click();
await page.waitForTimeout(900);
await page.getByLabel('Edit Cold shower, 60s').first().click();
await page.waitForTimeout(800);
await page.getByText('Stop tracking this', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('archived habit leaves the list', !t.includes('Cold shower'));
check('remaining habit still there', t.includes('Read a few pages'));
check('toast says ticks are kept', t.includes('ticks are still there'));

/* --- survives a reload --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1000);
t = await body();
check('home reports habits running', t.includes('1 running'));
check('habit survived a reload', t.includes('Read a few pages'));
await page.getByText('Open the full page', { exact: true }).first().click();
await page.waitForTimeout(900);
const lineAfter = await page.getByPlaceholder('Leave blank if today has no one thing').last().inputValue();
check('daily habit line survived a reload', lineAfter === 'Cold shower, 60s', lineAfter);
await shot('p6-05-after-reload');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
