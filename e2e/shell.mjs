/**
 * The app shell: five tabs, and the depth behind each one.
 *
 *   node e2e/shell.mjs
 *
 * Covers what the restructure changed rather than what any feature does —
 * that every destination is reachable, that a drill-down offers a way back,
 * and that the slide-out menu is gone rather than merely hidden. The feature
 * drives assume they can navigate; this is the one that proves they can.
 */

import { chromium } from 'playwright';
const APP = 'http://localhost:8081';
const stamp = Date.now();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let fails = 0;
const check = (l, ok, d='') => { if (!ok) fails++; console.log(`  [${ok?'PASS':'FAIL'}] ${l}${!ok&&d?` — ${d}`:''}`); };

await page.goto(APP, { waitUntil: 'networkidle' });
await page.getByText('NOTenough').first().waitFor({ timeout: 30000 });
await page.getByText('Create account', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Alex Carter').fill('Shell Tester');
await page.getByPlaceholder('you@example.com').fill(`shell-${stamp}@test.local`);
await page.getByPlaceholder('At least 6 characters').fill('runfast123');
await page.getByText('Create account', { exact: true }).last().click();
await page.waitForTimeout(2500);
await page.getByText('Train on my own', { exact: true }).click({ force: true });
await page.waitForTimeout(2500);

let t = await page.locator('body').innerText();
console.log('\n the five tabs');
for (const tab of ['Home','Journey','Train','Teams','Profile']) check(`${tab} tab present`, t.includes(tab), t.slice(0,200));
check('no slide-out menu button', (await page.getByLabel('Open menu').count()) === 0);
check('home shows today', t.includes('today is'), t.slice(0,200));
check('victories card on home', t.includes('3 Victories'), t.slice(0,300));

console.log('\n home stack');
await page.getByText('3 Victories', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1500);
t = await page.locator('body').innerText();
check('victories opens', t.includes('PHYSICAL') && t.includes('MIND'), t.slice(0,200));
check('and offers a way back', (await page.getByLabel('Back to today').count()) > 0);
await page.getByLabel('Back to today').click({ force: true });
await page.waitForTimeout(1200);
check('back returns to today', (await page.locator('body').innerText()).includes('today is'));

console.log('\n train tab');
await page.getByText('Train', { exact: true }).last().click({ force: true });
await page.waitForTimeout(1800);
t = await page.locator('body').innerText();
check('train opens on the timer', t.includes('Stopwatch') || t.includes('Interval'), t.slice(0,200));

console.log('\n profile tab');
await page.getByText('Profile', { exact: true }).last().click({ force: true });
await page.waitForTimeout(1800);
t = await page.locator('body').innerText();
check('profile shows the account', t.includes('Shell Tester'), t.slice(0,300));
check('with figures', t.includes('day streak') && t.includes('days logged'), t.slice(0,400));
check('and the account rows', t.includes('Settings') && t.includes('Privacy') && t.includes('Friends'), t.slice(0,500));
await page.screenshot({ path: 'e2e/screenshots/shell-profile.png', timeout: 8000 }).catch(()=>{});

await page.getByText('Settings', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1500);
t = await page.locator('body').innerText();
check('settings opens under profile', t.includes('Reminders') || t.includes('Sync'), t.slice(0,250));
check('with a back path', (await page.getByLabel('Back to your profile').count()) > 0);

check('no console errors', errors.length === 0, errors.slice(0,2).join(' | '));
await browser.close();
console.log(fails === 0 ? '\nAll checks passed.\n' : `\n${fails} failed.\n`);
process.exit(fails === 0 ? 0 : 1);
