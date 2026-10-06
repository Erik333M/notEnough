/**
 * Can somebody actually find these things?
 *   node e2e/discovery.mjs
 *
 * Three reports from a real user drove this file: events would not create,
 * the body map could not be found, and there was no visible place to write
 * down a football result. The first turned out to be an unreachable server
 * rather than a bug — but the other two were real, and all three are the
 * kind of failure a passing feature test says nothing about.
 *
 * So these checks are about reach, not correctness: how many taps from a
 * cold start, and is the thing named in words somebody would search for.
 */

import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4137';
const stamp = Date.now();

const health = await fetch(`${API}/api/health`).catch(() => null);
if (!health?.ok) {
  console.error(`\nAPI is not reachable at ${API}. Start it with: cd server && npm start\n`);
  process.exit(1);
}

let fails = 0;
const check = (label, ok, detail = '') => {
  if (!ok) fails += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${!ok && detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const body = () => page.locator('body').innerText();
const tap = async (text, wait = 1200) => {
  await page.getByText(text, { exact: true }).last().click({ force: true });
  await page.waitForTimeout(wait);
};

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByText('NOTenough').first().waitFor({ timeout: 40000 });
  await page.getByText('Create account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Alex Carter').fill('Finder');
  await page.getByPlaceholder('you@example.com').fill(`find-${stamp}@test.local`);
  await page.getByPlaceholder('At least 6 characters').fill('runfast123');
  await page.getByText('Create account', { exact: true }).last().click();
  await page.waitForTimeout(2800);
  await page.getByText('Train on my own', { exact: true }).click({ force: true });
  await page.waitForTimeout(2500);

  /* --------------------------------------------------------- the body map */

  console.log('\n finding the body map');
  await tap('Train');
  let t = await body();
  check('the Train tab offers Movements', t.includes('Movements'), t.slice(0, 300));
  check('and says what it is for', /body map/i.test(t), t.slice(0, 400));

  await tap('Movements', 2000);
  t = await body();
  check('two taps reach the library', t.includes('Back squat') || /squat/i.test(t), t.slice(0, 300));
  check('a row says which muscles it works', /quads|glutes|chest|lats/i.test(t), t.slice(0, 400));

  const figures = await page.getByLabel(/Which muscles .* works/).count();
  check('rows carry a figure to open the map', figures > 0, `${figures} found`);
  if (figures > 0) {
    await page.getByLabel(/Which muscles .* works/).first().click({ force: true });
    await page.waitForTimeout(1200);
    t = await body();
    check('the map opens', /Front/i.test(t) && /Back/i.test(t), t.slice(0, 300));
    check('and names what is worked', /mainly this|also working/i.test(t), t.slice(0, 400));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  /* ------------------------------------------------- the training plan */

  console.log('\n the training plan is reachable at all');
  await tap('Train');
  await page.waitForTimeout(800);
  t = await body();
  check('the timer offers the plan', t.includes('Training plan'), t.slice(0, 400));

  /* ------------------------------------------------- events and statistics */

  console.log('\n finding match statistics');
  await tap('Teams');
  t = await body();
  check('the Teams tab shows Events', t.includes('Events'), t.slice(0, 300));
  check('and says results and counting live there', /goals|assists|cards|table/i.test(t),
    t.slice(0, 600));

  await tap('Set up an event', 1200);
  await page.getByPlaceholder('Summer Camp').fill('Saturday League');
  await page.waitForTimeout(300);
  await tap('Create the event', 3500);
  t = await body();
  check('an event is created and opens', t.includes('Saturday League'), t.slice(0, 300));
  check('statistics are named on the event', /Games and statistics/i.test(t), t.slice(0, 1200));
  check('and it says squads come first', /two squads/i.test(t), t.slice(0, 1600));

  check('no crashes along the way', errors.length === 0, errors.join(' | '));
} catch (error) {
  fails += 1;
  console.error('\n  [FAIL] run threw —', error.message);
} finally {
  await browser.close();
}

console.log(fails === 0 ? '\nAll checks passed.\n' : `\n${fails} check(s) failed.\n`);
process.exit(fails === 0 ? 0 : 1);
