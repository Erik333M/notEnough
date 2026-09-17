/**
 * Friends, end to end, in two browser contexts.
 *
 *   node e2e/friends.mjs
 *
 * Two people, because a friendship is the one thing that cannot be tested
 * from one side. Covers both ways in — a code, and a shared team roster — and
 * the property that matters most: until a request is accepted, neither person
 * can see anything of the other.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4137';
const SHOTS = path.join(process.cwd(), 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
let failures = 0;
const consoleErrors = [];
const check = (l, ok, d = '') => {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${l}${!ok && d ? ` — ${d}` : ''}`);
};

const health = await fetch(`${API}/api/health`).catch(() => null);
if (!health?.ok) {
  console.error(`\nAPI is not reachable at ${API}.\n`);
  process.exit(1);
}

/**
 * Refuse to run against an API that predates this feature.
 *
 * A server started before these routes existed answers /api/health perfectly
 * and 404s everything else, which reads as a broken screen rather than a
 * stale process. This has cost five debugging cycles; one probe is cheaper.
 */
const probe = await fetch(`${API}/api/friends/code`).catch(() => null);
if (probe?.status === 404) {
  console.error(`\nThe API at ${API} has no /api/friends — it predates this feature.`);
  console.error('Restart it:  lsof -ti:4137 | xargs kill && node server/src/index.js\n');
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function signUp(name, label) {
  const context = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${label}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${label} pageerror: ${e.message}`));

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByText('NOTenough').first().waitFor({ timeout: 30000 });
  await page.getByText('Create account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Alex Carter').fill(name);
  await page.getByPlaceholder('you@example.com').fill(`${label}-${stamp}@test.local`);
  await page.getByPlaceholder('At least 6 characters').fill('runfast123');
  await page.getByText('Create account', { exact: true }).last().click();
  await page.waitForTimeout(2500);
  await page.getByText('Train on my own', { exact: true }).click({ force: true });
  await page.waitForTimeout(2200);
  return page;
}

const openFriends = async (page) => {
  await page.getByText('Profile', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(1600);
  await page.getByText('Friends', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(2200);
};

const shot = async (page, name) => {
  try {
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), timeout: 8000 });
  } catch {
    console.log(`  [warn] screenshot ${name} timed out`);
  }
};

try {
  console.log(`\nDriving friends against ${API}\n`);

  const ada = await signUp('Ada Whitfield', 'ada');
  const bo = await signUp('Bo Nakamura', 'bo');

  console.log(' the friends screen');
  await openFriends(ada);
  let t = await ada.locator('body').innerText();
  check('friends opens from profile', t.includes('YOUR FRIEND CODE'), t.slice(0, 250));
  check('it states what a friend sees', t.includes('What a friend sees'), t.slice(0, 400));
  check('and names the limits', t.includes('not your journal'), t.slice(0, 500));
  check('the empty state is reassuring', t.includes('Nothing of yours is shared until you do'), t.slice(0, 600));
  check('sharing is offered', t.includes('Share my code'));

  const code = (t.match(/\b[A-HJ-NP-Z2-9]{6}\b/) ?? [])[0];
  check('a code is shown', Boolean(code), code ?? 'none found');
  await shot(ada, 'friends-empty');

  console.log('\n adding by code');
  await openFriends(bo);
  await bo.getByPlaceholder('e.g. 7KDP2M').fill(code);
  await bo.getByText('Send request', { exact: true }).click({ force: true });
  await bo.waitForTimeout(2200);
  t = await bo.locator('body').innerText();
  check('the request appears as outgoing', t.includes('Waiting on them'), t.slice(0, 500));
  check('and names who was asked', t.includes('Ada Whitfield'), t.slice(0, 500));

  console.log('\n nothing is shared before accepting');
  await ada.reload({ waitUntil: 'networkidle' });
  await ada.waitForTimeout(2800);
  await openFriends(ada);
  t = await ada.locator('body').innerText();
  check('the request shows as incoming', t.includes('Wants to add you'), t.slice(0, 500));
  check('with the asker named', t.includes('Bo Nakamura'));
  check(
    'a pending request shows no figures of theirs',
    t.includes('Nothing published yet'),
    t.slice(0, 600),
  );
  await shot(ada, 'friends-request');

  console.log('\n accepting');
  await ada.getByText('Accept', { exact: true }).first().click({ force: true });
  await ada.waitForTimeout(2500);
  t = await ada.locator('body').innerText();
  check('the request moves to friends', !t.includes('Wants to add you'), t.slice(0, 400));
  check('and the friend is listed', t.includes('Bo Nakamura'), t.slice(0, 500));
  check('with a level', /Level \d/.test(t), t.slice(0, 600));
  await shot(ada, 'friends-accepted');

  const bothWays = await fetch(`${API}/api/health`);
  check('api still healthy', bothWays.ok);

  console.log('\n removing');
  await ada.getByText('Friends', { exact: true }).first().click({ force: true });
  await ada.waitForTimeout(800);
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] drive threw —', error.message);
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
