import { chromium } from 'playwright';
let fails = 0; const errors = [];
const check = (l, ok, d = '') => { if (!ok) fails++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${l}${!ok && d ? ` — ${d}` : ''}`); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const body = () => page.locator('body').innerText();

await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('Create account', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Alex Carter').fill('Phase Three');
await page.getByPlaceholder('you@example.com').fill(`p3-${Date.now()}@example.com`);
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

check('day 1 home hides the workout card', !(await body()).includes('WORKOUT'));
await page.getByText('Open the full page', { exact: true }).first().click();
await page.waitForTimeout(800);
let t = await body();
check('workout card is on the day page', t.includes('WORKOUT') && t.includes('Log a workout'));

await page.getByText('Log a workout', { exact: true }).first().click();
await page.waitForTimeout(800);
t = await body();
check('builder opens', t.includes('WHAT KIND') && t.includes('ROUNDS') && t.includes('MOVEMENTS'));
check('jargon explained inline', t.includes('M · Cardio') && t.includes('W · Lifting'));
check('labels are not duplicated', !t.includes('How it was set up\nHow it was set up'));

await page.getByText('W · Lifting', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByText('3', { exact: true }).first().click();
await page.waitForTimeout(300);

await page.getByText('Add a line', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByLabel('Choose a movement').first().click();
await page.waitForTimeout(700);
check('picker opens', await page.getByPlaceholder('Search movements').first().isVisible());
await page.getByPlaceholder('Search movements').first().fill('thrust');
await page.waitForTimeout(600);
check('search finds a seeded movement', (await body()).includes('Thruster'));
await page.getByText('Thruster', { exact: true }).first().click();
await page.waitForTimeout(700);
await page.getByLabel('Reps').first().fill('21');
await page.getByLabel(/^Weight in/).first().fill('42.5');
await page.waitForTimeout(700);

await page.getByText('Add a line', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByLabel('Choose a movement').first().click();
await page.waitForTimeout(700);
await page.getByPlaceholder('Search movements').first().fill('Sled push');
await page.waitForTimeout(700);
t = await body();
check('unknown movement offers to be created', t.includes('Add “Sled push” to your movements'));
check('and offers a one-off alternative', t.includes('Just this once'));
await page.getByText('Add “Sled push” to your movements', { exact: true }).first().click();
await page.waitForTimeout(800);
check('custom movement lands on the line', (await body()).includes('Sled push'));

await page.getByPlaceholder('3 rounds for time. 12 minutes, as many as possible.').first().fill('3 rounds for time');
await page.getByPlaceholder('A time, a number of rounds, or how it felt').first().fill('11:42');
await page.waitForTimeout(900);

await page.getByLabel(/^Movement: /).first().click();
await page.waitForTimeout(700);
await page.getByText('Browse the full library', { exact: true }).first().click();
await page.waitForTimeout(900);
t = await body();
check('movements library opens', t.includes('Movements') && t.includes('yours'));
check('custom movement is in the library', t.includes('Sled push'));
await page.getByPlaceholder('Search movements').first().fill('t2b');
await page.waitForTimeout(600);
check('alias search works', (await body()).includes('Toes to bar'));

await page.getByPlaceholder('Search movements').first().fill('');
await page.getByLabel('Back', { exact: true }).first().click();
await page.waitForTimeout(800);
check('back returns to the builder', (await body()).includes('WHAT KIND'));
check('reps persisted', (await page.getByLabel('Reps').first().inputValue()) === '21');
check('weight round-tripped through kg', (await page.getByLabel(/^Weight in/).first().inputValue()) === '42.5');

await page.getByLabel('Back to the day').first().click();
await page.waitForTimeout(900);
t = await body();
check('summary shows rounds', t.includes('3 rounds'));
check('summary shows a movement line', t.includes('21 × Thruster'));
check('summary shows the result', t.includes('11:42'));
check('empty line was pruned', !t.includes('Choose a movement'));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByText('Journey', { exact: true }).first().click({ force: true });
await page.waitForTimeout(1000);
t = await body();
check('workout card appears on home once a day is written', t.includes('WORKOUT'));
check('workout survived a reload', t.includes('11:42') && t.includes('21 × Thruster'));

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
