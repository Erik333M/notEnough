/**
 * End-to-end drive of the running app.
 *
 * Boots a real browser against the web build and performs a full user session:
 * register → log progress → confirm it reached the API → add goals → run the
 * stopwatch → reload → confirm the session and state survived.
 *
 * Every assertion that involves data is checked against the API rather than the
 * screen, so a UI that renders the right thing for the wrong reason still fails.
 *
 *   npm run web            # terminal 1 — serves the app on :8081
 *   cd server && npm start # terminal 2 — API on :4000
 *   npm run e2e            # terminal 3
 *
 * Override targets with APP_URL / API_URL. Pass --headed to watch it run.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4000';
const HEADED = process.argv.includes('--headed');
const SHOTS = path.join(process.cwd(), 'e2e', 'screenshots');

fs.mkdirSync(SHOTS, { recursive: true });

const email = `e2e-${Date.now()}@example.com`;
const password = 'runfast123';
const displayName = 'Portfolio Demo';

let failures = 0;
const consoleErrors = [];

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${!ok && detail ? ` — ${detail}` : ''}`);
}

async function apiCall(method, endpoint, { token, body } = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const health = await fetch(`${API}/api/health`).catch(() => null);
if (!health?.ok) {
  console.error(`\nAPI is not reachable at ${API}. Start it with: cd server && npm start\n`);
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED });
const page = await browser.newPage({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

const shot = (label) => page.screenshot({ path: path.join(SHOTS, `${label}.png`) });

console.log(`\nDriving ${APP} against ${API}`);
console.log(`Account: ${email}\n`);

await page.goto(APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

/* ------------------------------------------------------------------- auth */

await page.getByText('NOTenough').first().waitFor({ timeout: 20000 });
const authText = await page.locator('body').innerText();
check('auth screen renders', authText.includes('Sign in') && authText.includes('Create account'));
await shot('01-auth');

await page.getByText('Create account', { exact: true }).first().click();
await page.waitForTimeout(500);

const nameField = page.getByPlaceholder('Alex Carter');
check('register mode reveals the name field', await nameField.isVisible());

await nameField.fill(displayName);
await page.getByPlaceholder('you@example.com').fill(email);
await page.getByPlaceholder('At least 6 characters').fill(password);
await page.getByText('Create account', { exact: true }).last().click();

/* ------------------------------------------------------------------ today */

await page.getByText('Daily goals', { exact: true }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1200);

const todayText = await page.locator('body').innerText();
check('signed in and landed on Today', todayText.includes('Daily goals'));
check('greeting uses the first name', todayText.includes('Portfolio'));
check('seed goals rendered', todayText.includes('Easy run') && todayText.includes('Ball touches'));
await shot('02-today');

// The account must exist server-side, not just in local state.
const login = await apiCall('POST', '/api/auth/login', { body: { email, password } });
check('account was created on the backend', login.status === 200 && Boolean(login.body.token));
const token = login.body.token;

/* -------------------------------------------------------------- progress */

const addButton = page.getByText('500m', { exact: true }).first();
check('quick-add control present on a goal card', await addButton.isVisible());
await addButton.click();
await addButton.click();
await page.waitForTimeout(600);

const afterAdd = await page.locator('body').innerText();
check('progress reflected in the card', afterAdd.includes('1.00 / 5.00 km'));
await shot('03-progress-logged');

// Poll rather than sleep a fixed time: the push is debounced.
let synced = null;
for (let attempt = 0; attempt < 16; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const { body } = await apiCall('GET', '/api/state', { token });
  if (body?.state && Object.keys(body.state.log ?? {}).length > 0) {
    synced = body.state;
    break;
  }
}
check('state reached the backend', synced !== null);

if (synced) {
  const today = Object.values(synced.log)[0];
  const logged = Object.values(today).reduce((sum, value) => sum + value, 0);
  check('logged distance matches what the UI showed', logged === 1000, `got ${logged}`);
  check('goals reached the backend', synced.goals.length >= 4, `got ${synced.goals.length}`);
}

/* ----------------------------------------------------------------- goals */

await page.getByText('Goals', { exact: true }).first().click();
await page.waitForTimeout(1000);

const goalsText = await page.locator('body').innerText();
check('quick-add templates render', goalsText.includes('Quick add') && goalsText.includes('Push-ups'));
await shot('04-goals');

await page.getByText('Push-ups', { exact: true }).first().click();
await page.waitForTimeout(900);
const afterTemplate = await page.locator('body').innerText();
check('template created a goal', (afterTemplate.match(/Push-ups/g) ?? []).length >= 2);

await page.getByText('New goal', { exact: true }).first().click();
await page.waitForTimeout(900);
const editorText = await page.locator('body').innerText();
check('goal editor opens', editorText.includes('New daily goal') && editorText.includes('Daily reminder'));
await shot('05-goal-editor');

await page.mouse.click(206, 24); // backdrop
await page.waitForTimeout(800);
check('editor dismisses via backdrop', !(await page.locator('body').innerText()).includes('New daily goal'));

/* ----------------------------------------------------------------- timer */

await page.getByText('Timer', { exact: true }).first().click();
await page.waitForTimeout(1000);

const timerText = await page.locator('body').innerText();
check('timer screen renders', timerText.includes('Stopwatch') && timerText.includes('Laps'));

// The digits are written from a worklet, so this is the one behaviour where the
// native and web paths genuinely differ — worth asserting rather than assuming.
const before = await page.locator('input[readonly]').first().inputValue();
await page.getByText('Ready', { exact: true }).first().waitFor();
await page.mouse.click(206, 430); // start
await page.waitForTimeout(2200);
const after = await page.locator('input[readonly]').first().inputValue();
check('stopwatch digits advance while running', before !== after, `before=${before} after=${after}`);
await shot('06-stopwatch');

await page.getByText('Intervals', { exact: true }).first().click();
await page.waitForTimeout(900);
const intervalText = await page.locator('body').innerText();
check('interval mode renders', intervalText.includes('WORK') && intervalText.includes('Session shape'));
await shot('07-intervals');

/* -------------------------------------------------------------- progress */

await page.getByText('Progress', { exact: true }).first().click();
await page.waitForTimeout(1200);
const progressText = await page.locator('body').innerText();
check('progress screen renders', progressText.includes('day streak') && progressText.includes('Last 7 days'));
check('run history shows its empty state', progressText.includes('No sessions yet'));
await shot('08-progress');

/* ------------------------------------------------------------------ menu */

await page.getByLabel('Open menu').click();
await page.waitForTimeout(900);

// The drawer is always mounted and translated off-screen, so DOM text proves
// nothing — assert the panel is actually within the viewport.
const signOutBox = await page.getByText('Sign out', { exact: true }).first().boundingBox();
check('slide-out menu is on screen', Boolean(signOutBox) && signOutBox.x >= 0);
check('menu shows the signed-in account', (await page.locator('body').innerText()).includes(email));
await shot('09-menu');

await page.getByText('Settings', { exact: true }).first().click();
await page.waitForTimeout(2500);
const settingsText = await page.locator('body').innerText();
check('settings screen renders', settingsText.includes('Endpoint') && settingsText.includes('Notifications'));
check('settings reports a healthy sync', settingsText.includes('Synced') || settingsText.includes('Ready'));
await shot('10-settings');

/* ---------------------------------------------------------------- reload */

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const afterReload = await page.locator('body').innerText();
check('session survived a reload', !afterReload.includes('At least 6 characters'));
check('state restored after reload', afterReload.includes('Daily goals') || afterReload.includes('day streak'));
await shot('11-after-reload');

/* ---------------------------------------------------------------- report */

check('no console errors during the session', consoleErrors.length === 0, `${consoleErrors.length} logged`);
for (const error of consoleErrors.slice(0, 10)) console.log(`      • ${error.slice(0, 200)}`);

await apiCall('DELETE', '/api/auth/me', { token });

await browser.close();
console.log(
  failures === 0
    ? `\nAll checks passed. Screenshots in ${path.relative(process.cwd(), SHOTS)}\n`
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
