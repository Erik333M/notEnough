import { chromium } from 'playwright';
import path from 'node:path';

const SHOTS = process.env.S;
const email = `p2-${Date.now()}@example.com`;
let fails = 0;
const errors = [];
const check = (label, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${!ok && detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`) });

await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// register
await page.getByText('Create account', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Alex Carter').fill('Phase Two');
await page.getByPlaceholder('you@example.com').fill(email);
await page.getByPlaceholder('At least 6 characters').fill('runfast123');
await page.getByText('Create account', { exact: true }).last().click();
// A new account is asked once how it will use the app; these drives are all
// solo-path, so they answer and move on.
await page.getByText('How will you use this?').waitFor({ timeout: 20000 });
await page.getByText('Train on my own', { exact: true }).click();
await page.getByText('Daily goals', { exact: true }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1000);

/* --- the Journey tab exists and is reachable --- */
const journeyTab = page.getByText('Journey', { exact: true }).first();
check('Journey tab present in the bar', await journeyTab.isVisible());
await journeyTab.click();
await page.waitForTimeout(1400);
// Phase 7 added a one-time onboarding gate in front of the feature. This
// drive is about what comes after it, so dismiss it the way most users will.
if ((await page.locator('body').innerText()).includes('One page a day')) {
  await page.getByText('Skip, take me to today', { exact: true }).first().click();
  await page.waitForTimeout(1200);
}

let body = await page.locator('body').innerText();
check('lands on today, not a menu', body.includes('Success Journey') && body.includes('Today’s page'));
check('first-run copy is inviting, not demanding', body.includes('Start wherever you like'));
check('day one shows Decision', body.includes('DECISION'));
check('day one shows Habit', body.includes('HABIT'));
check('day one shows Plus One', body.includes('PLUS ONE'));
check('WOD is NOT on the first screen (progressive disclosure)', !body.includes('WOD'));
const inputs = await page.locator('input, textarea').count();
check(`no wall of inputs on first open (${inputs} fields)`, inputs <= 3, `${inputs} inputs`);
await shot('p2-01-home-day1');

/* --- Plus One: tap-only, no typing --- */
await page.getByText('Physical', { exact: true }).first().click();
await page.getByText('Social', { exact: true }).first().click();
await page.waitForTimeout(700);
await shot('p2-02-plusone-ticked');

/* --- Decision: type, then verify autosave survives a remount --- */
const decision = page.getByPlaceholder('Leave blank if today has no one thing').first();
await decision.fill('Call my brother');
await page.waitForTimeout(900); // debounce
// leave the tab and come back: the screen unmounts, state must persist
await page.getByText('Victories', { exact: true }).first().click({ force: true });
await page.waitForTimeout(600);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(900);
// innerText excludes form-field values, so read the control itself
const v1 = await page.getByPlaceholder('Leave blank if today has no one thing').first().inputValue();
check('decision text survived leaving the tab', v1 === 'Call my brother', v1);
body = await page.locator('body').innerText();
check('plus one ticks survived leaving the tab', body.includes('Physical'));

/* --- autosave survives a full reload (disk persistence) --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1400);
// Phase 7 added a one-time onboarding gate in front of the feature. These
// drives are about what comes after it, so dismiss it the way most users will.
if ((await page.locator('body').innerText()).includes('One page a day')) {
  await page.getByText('Skip, take me to today', { exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const v2 = await page.getByPlaceholder('Leave blank if today has no one thing').first().inputValue();
check('decision text survived a full reload', v2 === 'Call my brother', v2);
body = await page.locator('body').innerText();
check('strip now reports a written day', /1 day written/.test(body));
await shot('p2-03-after-reload');

/* --- drill into the full page and back --- */
await page.getByText('Open the full page', { exact: true }).first().click();
await page.waitForTimeout(900);
body = await page.locator('body').innerText();
check('full page opens for today', body.includes('THEME') && body.includes('Today'));
const v3 = await page.getByPlaceholder('Leave blank if today has no one thing').first().inputValue();
check('full page carries the decision through', v3 === 'Call my brother', v3);
check('optional long fields live here, not on home', body.includes('SKILL') && body.includes('STORY / SCRIPTURE'));
await shot('p2-04-full-page');

// info affordance
const info = page.getByLabel('What does Plus One mean?').first();
check('jargon has an info affordance', await info.isVisible());
await info.click();
await page.waitForTimeout(600);
body = await page.locator('body').innerText();
check('explainer is plain language', body.includes('Six parts of a life'));
await shot('p2-05-explainer');
await page.getByText('Got it', { exact: true }).first().click();
await page.waitForTimeout(500);

// back path
const backBtn = page.getByLabel('Back to the journey home').first();
check('back button has a screen-reader label', await backBtn.isVisible());
await backBtn.click();
await page.waitForTimeout(800);
body = await page.locator('body').innerText();
check('back returns to journey home', body.includes('Open the full page'));

/* --- past date from the strip --- */
const cells = page.getByLabel(/nothing logged/).first();
check('strip exposes past days', await cells.isVisible());
await cells.click();
await page.waitForTimeout(900);
body = await page.locator('body').innerText();
// "Today" is also the home tab's label, so assert on the page heading instead
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const now=new Date();
const todayHeading=`${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
const heading=(body.match(new RegExp(`\\d{1,2} (?:${months.join('|')}) \\d{4}`))||[''])[0];
check('a past date opens its own page', body.includes('THEME') && heading!=='' && heading!==todayHeading, `heading=${heading}`);
check('past empty day offers no destructive action', !body.includes('Clear this day'));
await shot('p2-06-past-day');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
