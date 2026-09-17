/**
 * The body map, in the movements library.
 *
 *   node e2e/muscles.mjs
 *
 * Checks the tagging reaches the screen and that the figure renders — and
 * takes a picture, because whether a drawing reads as a body is not something
 * an assertion can answer.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const SHOTS = path.join(process.cwd(), 'e2e', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
let fails = 0;
const errors = [];
const check = (l, ok, d = '') => {
  if (!ok) fails += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${l}${!ok && d ? ` — ${d}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByText('NOTenough').first().waitFor({ timeout: 30000 });
  await page.getByText('Create account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Alex Carter').fill('Muscle Tester');
  await page.getByPlaceholder('you@example.com').fill(`muscle-${stamp}@test.local`);
  await page.getByPlaceholder('At least 6 characters').fill('runfast123');
  await page.getByText('Create account', { exact: true }).last().click();
  await page.waitForTimeout(2500);
  await page.getByText('Train on my own', { exact: true }).click({ force: true });
  await page.waitForTimeout(2200);

  console.log('\n reaching the library');
  await page.getByText('Journey', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(2500);
  if ((await page.locator('body').innerText()).includes('One page a day')) {
    await page.getByText('Skip, take me to today', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(1400);
  }
  await page.getByText('Open the full page', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  await page.getByText('Log a workout', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByText('Add a line', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByLabel('Choose a movement').first().click({ force: true });
  await page.waitForTimeout(900);
  await page.getByPlaceholder('Search movements').first().fill('Back squat');
  await page.waitForTimeout(900);

  let t = await page.locator('body').innerText();
  check('a movement is found', t.includes('Back squat'), t.slice(0, 200));

  console.log('\n the library');
  await page.getByLabel('Browse the full movements library').first().click({ force: true });
  await page.waitForTimeout(1800);
  t = await page.locator('body').innerText();
  check('the library opens', t.includes('Movements'), t.slice(0, 200));
  check('rows carry what they work', /Quads|Glutes|Chest|Lats/.test(t), t.slice(0, 400));
  await page.screenshot({ path: path.join(SHOTS, 'muscles-library.png'), timeout: 8000 }).catch(() => {});

  console.log('\n the figure');
  await page.getByLabel(/^Which muscles /).first().click({ force: true });
  await page.waitForTimeout(1400);
  t = await page.locator('body').innerText();
  check('the sheet opens', t.includes('What it works'), t.slice(0, 300));
  check('both views are drawn', t.includes('FRONT') && t.includes('BACK'), t.slice(0, 400));
  check('the legend explains the two shades', t.includes('Mainly this') && t.includes('Also working'));
  check('the figure can be switched', t.includes('Man') && t.includes('Woman'));
  check('and says it changes nothing else', t.includes('never sent anywhere'), t.slice(0, 600));
  await page.screenshot({ path: path.join(SHOTS, 'muscles-front-back.png'), timeout: 8000 }).catch(() => {});

  await page.getByText('Woman', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  check('switching the figure does not crash', (await page.locator('body').innerText()).includes('What it works'));
  await page.screenshot({ path: path.join(SHOTS, 'muscles-female.png'), timeout: 8000 }).catch(() => {});

  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(fails === 0 ? '\nAll checks passed.\n' : `\n${fails} failed.\n`);
  process.exit(fails === 0 ? 0 : 1);
} catch (error) {
  console.error('\n  [FAIL] drive threw —', error.message);
  await browser.close();
  process.exit(1);
}
