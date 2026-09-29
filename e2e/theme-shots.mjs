/**
 * Screenshots of the same screens in both themes.
 *   node e2e/theme-shots.mjs
 *
 * The point is the comparison, so both passes drive an identical script and
 * differ only in the emulated colour scheme — anything that changes between
 * the two pairs is the theme and not the route taken to get there.
 *
 * Needs Metro on :8081 and the API on :4137.
 */

import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = 'docs/design';
const stamp = Date.now();

const probe = await fetch('http://localhost:4137/api/health').catch(() => null);
if (!probe?.ok) {
  console.error('\nAPI is not reachable on :4137. Start it first.\n');
  process.exit(1);
}

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

/** One full pass through the app in a single colour scheme. */
async function pass(scheme) {
  const page = await browser.newPage({
    viewport: { width: 412, height: 900 },
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}-${scheme}.png` });
    console.log(`  ${name}-${scheme}.png`);
  };

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByText('NOTenough').first().waitFor({ timeout: 40000 });
  await shot('01-sign-in');

  await page.getByText('Create account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Alex Carter').fill('Theme Tester');
  await page.getByPlaceholder('you@example.com').fill(`theme-${scheme}-${stamp}@test.local`);
  await page.getByPlaceholder('At least 6 characters').fill('runfast123');
  await page.getByText('Create account', { exact: true }).last().click();
  await page.waitForTimeout(2600);
  await shot('02-opening-question');

  await page.getByText('Train on my own', { exact: true }).click({ force: true });
  await page.waitForTimeout(2600);
  await shot('03-today');

  for (const [tab, name] of [
    ['Journey', '04-journey'],
    ['Train', '05-timer'],
    ['Teams', '06-teams'],
    ['Profile', '07-profile'],
  ]) {
    await page.getByText(tab, { exact: true }).last().click({ force: true });
    await shot(name);
  }

  // Settings carries the appearance control itself, which is worth seeing.
  await page.getByText('Settings', { exact: true }).first().click({ force: true });
  await shot('08-settings');

  await page.close();
}

try {
  for (const scheme of ['dark', 'light']) {
    console.log(`\n ${scheme}`);
    await pass(scheme);
  }
  console.log(`\nWritten to ${OUT}\n`);
} finally {
  await browser.close();
}
