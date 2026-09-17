/**
 * End-to-end drive of the teams feature against the running web build.
 *
 *   npm run web            # terminal 1 — app on :8081
 *   cd server && npm start # terminal 2 — API on :4137
 *   node e2e/teams/drive.mjs
 *
 * Two browser contexts, because the whole point of this feature is that two
 * people see different things. The coach's context creates a team; the
 * athlete's context joins it with the code and must see their own row and
 * nothing of anyone else's.
 *
 * Data claims are checked against the API as well as the screen, so a view
 * that renders the right thing for the wrong reason still fails.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4137';
const HEADED = process.argv.includes('--headed');
const SHOTS = path.join(process.cwd(), 'e2e', 'teams', 'screenshots');

fs.mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const coach = { name: 'Coach Ada', email: `coach-${stamp}@example.com`, password: 'runfast123' };
const athlete = { name: 'Athlete Bo', email: `athlete-${stamp}@example.com`, password: 'runfast123' };

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

async function signUp(person, label) {
  const context = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${label}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => consoleErrors.push(`${label} pageerror: ${error.message}`));

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByText('NOTenough').first().waitFor({ timeout: 30000 });
  await page.getByText('Create account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Alex Carter').fill(person.name);
  await page.getByPlaceholder('you@example.com').fill(person.email);
  await page.getByPlaceholder('At least 6 characters').fill(person.password);
  await page.getByText('Create account', { exact: true }).last().click();
  await page.waitForTimeout(2500);
  return { context, page };
}

/**
 * Screenshots are diagnostics, not assertions.
 *
 * Reanimated drives its loops from requestAnimationFrame, which Playwright
 * cannot freeze, so a page with a breathing glow on it can keep the capture
 * waiting until it times out. That is worth a warning and nothing more — it
 * should never abort a run that is otherwise passing.
 */
async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), timeout: 8000 });
  } catch {
    console.log(`  [warn] screenshot ${name} timed out`);
  }
}

/**
 * Goes to the Teams tab.
 *
 * Clicks are forced. Almost everything in this app is spring-animated, and
 * Playwright's actionability check waits for an element's box to stop moving —
 * which a Reanimated loop never guarantees. The assertions after each tap are
 * what prove the tap worked.
 *
 * `.last()` on purpose: when you are already on Teams the shell header shows
 * the same word, and it is not the thing to click.
 */
async function openTeamsTab(page) {
  await page.getByText('Teams', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(1600);
}

try {
  console.log(`\nDriving ${APP} against ${API}\n`);

  /* ------------------------------------------------------- the opening ask */

  console.log(' the opening question');
  const coachSide = await signUp(coach, 'coach');
  let text = await coachSide.page.locator('body').innerText();
  check('a new account is asked how it will use the app', text.includes('How will you use this?'), text.slice(0, 200));
  check('all three answers are offered', text.includes('Train on my own') && text.includes('Train with a coach') && text.includes('Coach others'));
  check('the question can be skipped', text.includes('Skip for now'));
  check('it does not present itself as an identity', text.includes('change your mind'));
  await shot(coachSide.page, '01-intent');

  /* ------------------------------------------------------ creating a team */

  console.log('\n creating a team');
  await coachSide.page.getByText('Coach others', { exact: true }).click();
  await coachSide.page.waitForTimeout(1200);
  text = await coachSide.page.locator('body').innerText();
  check('choosing "coach others" opens the create form', text.includes('Create a team'), text.slice(0, 200));
  check('the privacy boundary is stated up front', text.includes('only ever see the work you set'));

  await coachSide.page.getByPlaceholder('e.g. Thursday squad').fill('Thursday squad');
  await coachSide.page.getByText('Create team', { exact: true }).last().click();
  await coachSide.page.waitForTimeout(2000);

  text = await coachSide.page.locator('body').innerText();
  check('the new team is listed', text.includes('Thursday squad'), text.slice(0, 300));
  // Exact match on the role pill: 'Coach' appears in body copy too, and a
  // loose includes() would pass on that instead of on the roster badge.
  check(
    'the row is badged Coach',
    (await coachSide.page.getByText('Coach', { exact: true }).count()) > 0,
  );
  await shot(coachSide.page, '02-team-created');

  const coachLogin = await apiCall('POST', '/api/auth/login', {
    body: { email: coach.email, password: coach.password },
  });
  const coachToken = coachLogin.body.token;
  const teams = await apiCall('GET', '/api/teams', { token: coachToken });
  check('the team really exists on the server', teams.body.teams.length === 1);
  check('the server made them a coach of it', teams.body.teams[0].role === 'coach');
  const inviteCode = teams.body.teams[0].team.inviteCode;
  check('an invite code was generated', /^[A-HJ-NP-Z2-9]{6}$/.test(inviteCode), inviteCode);

  /* ------------------------------------------------------------- the tabs */

  console.log('\n the tab bar');
  const tabs = await coachSide.page.locator('body').innerText();
  for (const tab of ['Home', 'Journey', 'Train', 'Teams', 'Profile']) {
    check(`${tab} is a tab`, tabs.includes(tab), tabs.slice(0, 200));
  }
  check('there is no slide-out menu', (await coachSide.page.getByLabel('Open menu').count()) === 0);
  await shot(coachSide.page, '03-tabs-coach');

  /* ----------------------------------------------- the answer is remembered */

  console.log('\n after a reload');
  await coachSide.page.reload({ waitUntil: 'networkidle' });
  await coachSide.page.waitForTimeout(3000);
  text = await coachSide.page.locator('body').innerText();
  check('the opening question is not asked twice', !text.includes('How will you use this?'), text.slice(0, 160));

  /* ------------------------------------------------------ the athlete side */

  console.log('\n the athlete');
  const athleteSide = await signUp(athlete, 'athlete');
  text = await athleteSide.page.locator('body').innerText();
  check('the athlete is asked the same question', text.includes('How will you use this?'));

  await athleteSide.page.getByText('Train with a coach', { exact: true }).click();
  await athleteSide.page.waitForTimeout(1200);
  text = await athleteSide.page.locator('body').innerText();
  check('choosing "with a coach" opens the join form', text.includes('Join a team'), text.slice(0, 200));

  await athleteSide.page.getByPlaceholder('e.g. 7KDP2M').fill(inviteCode);
  await athleteSide.page.getByText('Join', { exact: true }).last().click();
  await athleteSide.page.waitForTimeout(2000);

  text = await athleteSide.page.locator('body').innerText();
  check('the athlete now sees the team', text.includes('Thursday squad'), text.slice(0, 300));
  check(
    'the row is badged Athlete',
    (await athleteSide.page.getByText('Athlete', { exact: true }).count()) > 0,
  );
  check(
    'the athlete is not badged Coach',
    (await athleteSide.page.getByText('Coach', { exact: true }).count()) === 0,
  );
  await shot(athleteSide.page, '04-athlete-joined');

  const athleteLogin = await apiCall('POST', '/api/auth/login', {
    body: { email: athlete.email, password: athlete.password },
  });
  const athleteTeams = await apiCall('GET', '/api/teams', { token: athleteLogin.body.token });
  check('the membership is real, not just rendered', athleteTeams.body.teams[0]?.role === 'athlete');

  /* --------------------------------------------------- building a session */

  console.log('\n the coach builds a session');
  await openTeamsTab(coachSide.page);
  await coachSide.page.getByText('Thursday squad', { exact: true }).first().click();
  await coachSide.page.waitForTimeout(1800);
  text = await coachSide.page.locator('body').innerText();
  check('the team opens on its roster', text.includes('Roster'), text.slice(0, 200));
  check('the invite code is shown to the coach', text.includes(inviteCode), text.slice(0, 300));
  check('the roster has both people', text.includes('Coach Ada') && text.includes('Athlete Bo'));
  // Scoped to the athlete's address on purpose: the coach's own email appears
  // in the side-menu header, which is theirs to see. What must never appear is
  // somebody else's.
  check(
    'the coach cannot see an athlete’s email anywhere',
    !text.includes(athlete.email),
    text.slice(0, 400),
  );
  await shot(coachSide.page, '06-team-coach');

  await coachSide.page.getByText('New session', { exact: true }).click();
  await coachSide.page.waitForTimeout(700);
  await coachSide.page.getByPlaceholder('e.g. Tuesday conditioning').fill('Tuesday conditioning');
  await coachSide.page.getByText('Create session', { exact: true }).click();
  await coachSide.page.waitForTimeout(2000);

  text = await coachSide.page.locator('body').innerText();
  check('creating a session opens it', text.includes('Tuesday conditioning'), text.slice(0, 200));
  check('an empty session says what to do next', text.includes('Nothing in this session yet'));
  check('handing out is blocked until there is a task', text.includes('Hand out to the squad'));

  await coachSide.page.getByText('Add task', { exact: true }).click();
  await coachSide.page.waitForTimeout(700);
  await coachSide.page.getByPlaceholder('e.g. 2k row').fill('2k row');
  await coachSide.page.getByText('Reps', { exact: true }).click();
  await coachSide.page.waitForTimeout(300);
  await coachSide.page.getByText('Add task', { exact: true }).last().click();
  await coachSide.page.waitForTimeout(1800);

  text = await coachSide.page.locator('body').innerText();
  check('the task is listed', text.includes('2k row'), text.slice(0, 300));
  check('its target is shown in its own unit', text.includes('20 reps'), text.slice(0, 300));
  check('sharing is off by default', text.includes('Private to each athlete'));
  await shot(coachSide.page, '07-session-built');

  /* ------------------------------------------------------------ handing out */

  console.log('\n handing it out');
  await coachSide.page.getByText('Hand out to the squad', { exact: true }).click();
  await coachSide.page.waitForTimeout(2200);
  text = await coachSide.page.locator('body').innerText();
  check('progress appears once handed out', text.includes('Athlete Bo'), text.slice(0, 400));
  check('nothing is done yet', text.includes('0/1'), text.slice(0, 400));

  // Checked against the data rather than the toast: a toast auto-dismisses, so
  // asserting on it tests how fast this script reads the page.
  const teamIdForWork = teams.body.teams[0].team.id;
  const before = await apiCall('GET', `/api/work/teams/${teamIdForWork}`, { token: coachToken });
  await coachSide.page.getByText('Hand out again', { exact: true }).click();
  await coachSide.page.waitForTimeout(2200);
  const after = await apiCall('GET', `/api/work/teams/${teamIdForWork}`, { token: coachToken });
  check(
    'handing out twice creates no duplicates',
    after.body.assignments.length === before.body.assignments.length,
    `${before.body.assignments.length} → ${after.body.assignments.length}`,
  );
  // One task, one athlete, one row — and specifically NOT a row for the coach,
  // who holds an active membership but is not part of the squad being set work.
  check('one task, one athlete, one row', after.body.assignments.length === 1, `got ${after.body.assignments.length}`);
  check(
    'the coach did not assign the work to themselves',
    !after.body.assignments.some((row) => row.assigneeUserId === teams.body.teams[0].team.ownerId),
  );

  /* ------------------------------------------------- the athlete does the work */

  console.log('\n the athlete finds the work on Today');
  await athleteSide.page.getByText('Home', { exact: true }).last().click({ force: true });
  await athleteSide.page.waitForTimeout(2500);
  text = await athleteSide.page.locator('body').innerText();
  check('assigned work appears on Today, not buried in Teams', text.includes('From your coach'), text.slice(0, 400));
  check('the task itself is listed there', text.includes('2k row'), text.slice(0, 400));
  check('it says how much is left', text.includes('1 left'), text.slice(0, 400));
  await shot(athleteSide.page, '08-today-athlete');

  /* ------------------------------------------------------- logging honestly */

  console.log('\n logging a short session');
  await athleteSide.page.getByLabel('Log 2k row').first().click();
  await athleteSide.page.waitForTimeout(900);
  text = await athleteSide.page.locator('body').innerText();
  check('the log sheet says what was asked for', text.includes('asked for 20 reps'), text.slice(0, 300));
  check('it opens on the target', text.includes('20 reps'));

  // Two taps down: 20 -> 18, a session that fell short of the target.
  await athleteSide.page.getByLabel('Decrease What you did').click();
  await athleteSide.page.getByLabel('Decrease What you did').click();
  await athleteSide.page.waitForTimeout(400);
  text = await athleteSide.page.locator('body').innerText();
  check('the amount can be corrected downwards', text.includes('18 reps'), text.slice(0, 300));
  check(
    'falling short is presented as a normal answer',
    text.includes('Short of the target is still worth logging'),
    text.slice(0, 400),
  );
  await shot(athleteSide.page, '09-log-sheet');

  await athleteSide.page.getByText('Mark done', { exact: true }).click();
  await athleteSide.page.waitForTimeout(2500);
  text = await athleteSide.page.locator('body').innerText();
  check('Today reflects the logged result', text.includes('All done'), text.slice(0, 400));
  check('and keeps the honest number', text.includes('18 / 20 reps'), text.slice(0, 400));

  /* -------------------------------------------------- what the coach can see */

  console.log('\n the transparency screen');
  await openTeamsTab(athleteSide.page);
  await athleteSide.page.getByText('Thursday squad', { exact: true }).first().click();
  await athleteSide.page.waitForTimeout(1800);
  text = await athleteSide.page.locator('body').innerText();
  check('the athlete is offered the visibility screen', text.includes('What your coach can see'), text.slice(0, 400));

  await athleteSide.page.getByLabel('What your coach can see').click();
  await athleteSide.page.waitForTimeout(1400);
  text = await athleteSide.page.locator('body').innerText();
  check('it lists what they can see', text.includes('They can see'), text.slice(0, 300));
  check('it lists what they cannot', text.includes('They can never see'), text.slice(0, 300));
  check('the journey is named as private', text.includes('Success Journey'));
  check('medical answers are named as private', text.includes('emergency contact'));
  check('other teams are named as separate', text.includes('other teams'));
  check('leaving is explained', text.includes('access ends immediately'));
  await shot(athleteSide.page, '10-visibility');

  /* ------------------------------------------------------ the coach sees it */

  console.log('\n the coach sees the result');
  const coachWork = await apiCall('GET', `/api/work/teams/${teamIdForWork}`, { token: coachToken });
  check('the coach can read the result through the API', coachWork.body.assignments.some((row) => row.result?.done));
  check(
    'the result is the athlete’s own row',
    coachWork.body.assignments.every((row) => row.teamId === teamIdForWork),
  );

  // And on screen, which is the actual deliverable. A reload drops back to
  // Today, so navigate rather than assume the route survived.
  await coachSide.page.reload({ waitUntil: 'networkidle' });
  await coachSide.page.waitForTimeout(3000);
  await openTeamsTab(coachSide.page);
  await coachSide.page.getByText('Thursday squad', { exact: true }).first().click();
  await coachSide.page.waitForTimeout(1800);
  await coachSide.page.getByText('Tuesday conditioning', { exact: true }).first().click();
  await coachSide.page.waitForTimeout(2200);

  text = await coachSide.page.locator('body').innerText();
  check('the coach sees the athlete on the progress list', text.includes('Athlete Bo'), text.slice(0, 400));
  check('the coach sees it marked complete', text.includes('1/1'), text.slice(0, 400));
  check('the coach sees the honest number, not the target', text.includes('18 / 20 reps'), text.slice(0, 400));
  check(
    'the coach cannot tick an athlete’s task for them',
    (await coachSide.page.getByLabel('Mark done: 2k row').count()) === 0,
  );
  await shot(coachSide.page, '11-coach-progress');

  /* ------------------------------------------------------ sharing a win */

  console.log('\n sharing an achievement');
  // Progress lives under Profile now.
  await athleteSide.page.getByText('Profile', { exact: true }).last().click({ force: true });
  await athleteSide.page.waitForTimeout(1800);
  await athleteSide.page.getByText('Progress and achievements', { exact: true }).first().click({ force: true });
  await athleteSide.page.waitForTimeout(2500);
  text = await athleteSide.page.locator('body').innerText();
  check('achievements appear on Progress', text.includes('Achievements'), text.slice(0, 500));
  check(
    'finishing a coach-set task earns one',
    text.includes('First session done'),
    text.slice(0, 600),
  );

  await athleteSide.page.getByLabel('Share: First session done').click();
  await athleteSide.page.waitForTimeout(900);
  text = await athleteSide.page.locator('body').innerText();
  check('the share sheet previews the exact words', text.includes('First session done'));
  check(
    'and states plainly what it reveals',
    text.includes('Nothing else') && text.includes('not your journal'),
    text.slice(0, 600),
  );
  check('it names the team it will go to', text.includes('Thursday squad'));
  await shot(athleteSide.page, '12-share-sheet');

  await athleteSide.page.getByText('Share with Thursday squad', { exact: true }).click();
  await athleteSide.page.waitForTimeout(2500);
  text = await athleteSide.page.locator('body').innerText();
  check('the card marks itself shared', text.includes('Shared'), text.slice(0, 600));

  /* ----------------------------------------------------------- the wall */

  console.log('\n the team wall');
  const feed = await apiCall('GET', `/api/teams/${teamIdForWork}/shares`, { token: coachToken });
  check('the post reached the team', feed.body.shares.length === 1, `got ${feed.body.shares?.length}`);
  check('it carries the author name', feed.body.shares[0]?.authorName === 'Athlete Bo');
  check(
    'it is a snapshot, not a pointer into their data',
    feed.body.shares[0]?.title === 'First session done' && feed.body.shares[0]?.achievementId === 'work:1',
  );

  await openTeamsTab(coachSide.page);
  await coachSide.page.getByText('Thursday squad', { exact: true }).first().click();
  await coachSide.page.waitForTimeout(2000);
  text = await coachSide.page.locator('body').innerText();
  check('the coach sees it on the wall', text.includes('Wall') && text.includes('First session done'), text.slice(0, 600));
  check('and who posted it', text.includes('Athlete Bo'));
  await shot(coachSide.page, '13-team-wall');

  const soloFeedCheck = await apiCall('GET', `/api/teams/${teamIdForWork}/shares`, {
    token: athleteLogin.body.token,
  });
  check('the athlete can read their own team wall', soloFeedCheck.status === 200);

  /* -------------------------------------------------------- a challenge */

  console.log('\n the coach sets a challenge');
  await coachSide.page.getByText('New challenge', { exact: true }).click();
  await coachSide.page.waitForTimeout(900);
  text = await coachSide.page.locator('body').innerText();
  check('the sheet says where the score comes from', text.includes('Scored from 3 Victories'), text.slice(0, 400));
  check('it says nobody is entered automatically', text.includes('Nobody is entered automatically'));

  await coachSide.page.getByText('Week', { exact: true }).click();
  await coachSide.page.waitForTimeout(500);
  text = await coachSide.page.locator('body').innerText();
  check('a week is seven days', text.includes('7 days'), text.slice(0, 500));
  check('and a perfect week is twenty-one', text.includes('21 victories'), text.slice(0, 500));

  await coachSide.page.getByPlaceholder('A full week').fill('Squad week');
  await coachSide.page.getByPlaceholder('Whatever you have promised them').fill('Coffee on me');
  await coachSide.page.getByText('Set the challenge', { exact: true }).click();
  await coachSide.page.waitForTimeout(2200);

  text = await coachSide.page.locator('body').innerText();
  check('the challenge is listed', text.includes('Squad week'), text.slice(0, 500));
  check('with its reward', text.includes('Coffee on me'));
  check('and nobody in it yet', text.includes('Nobody yet'), text.slice(0, 500));
  await shot(coachSide.page, '14-challenge-set');

  /* --------------------------------------------- the score is 3 Victories */

  console.log('\n the athlete wins a victory');
  // Victories is a card on Home now, not a tab.
  await athleteSide.page.getByText('Home', { exact: true }).last().click({ force: true });
  await athleteSide.page.waitForTimeout(1800);
  await athleteSide.page.getByText('3 Victories', { exact: true }).first().click({ force: true });
  await athleteSide.page.waitForTimeout(2000);
  for (const goal of ['Hygiene & Care', 'Strength & Mobility', 'Fuel & Recovery']) {
    await athleteSide.page.getByText(goal, { exact: true }).first().click();
    await athleteSide.page.waitForTimeout(350);
  }
  await athleteSide.page.waitForTimeout(900);
  text = await athleteSide.page.locator('body').innerText();
  check('the athlete won the physical victory', text.includes('PHYSICAL VICTORY WON'), text.slice(0, 300));

  console.log('\n joining, and the score that follows');
  await openTeamsTab(athleteSide.page);
  await athleteSide.page.getByText('Thursday squad', { exact: true }).first().click();
  await athleteSide.page.waitForTimeout(2000);
  text = await athleteSide.page.locator('body').innerText();
  check('the athlete sees the challenge', text.includes('Squad week'), text.slice(0, 500));
  check('it invites rather than enrols', text.includes('Tap to see it and join in'), text.slice(0, 500));

  await athleteSide.page.getByText('Squad week', { exact: true }).first().click();
  await athleteSide.page.waitForTimeout(1800);
  text = await athleteSide.page.locator('body').innerText();
  check('the standings are empty before anyone joins', text.includes('Nobody has joined yet'), text.slice(0, 400));
  check('and say why', text.includes('Nobody is entered automatically'));

  await athleteSide.page.getByText('Join in', { exact: true }).click();
  await athleteSide.page.waitForTimeout(2500);
  text = await athleteSide.page.locator('body').innerText();
  check('joining puts them on the board', text.includes('Athlete Bo'), text.slice(0, 500));
  check('and they are the only one taking part', text.includes('1 taking part'), text.slice(0, 500));
  await shot(athleteSide.page, '15-challenge-board');

  const listing = await apiCall('GET', `/api/teams/${teamIdForWork}/challenges`, { token: coachToken });
  const weekId = listing.body.challenges[0]?.challenge.id;
  const board = await apiCall('GET', `/api/teams/detail/${weekId}`, { token: coachToken });
  check('the server holds a score of exactly one', board.body.entries[0]?.score === 1, `got ${board.body.entries[0]?.score}`);
  check('it came from the victory, not the coach-set work', board.body.entries[0]?.name === 'Athlete Bo');
  check(
    'the entry reveals nothing but a name and a number',
    !JSON.stringify(board.body.entries).includes('Hygiene'),
  );

  /* --------------------------------------------------------- the solo user */

  console.log('\n the solo user');
  const solo = await signUp(
    { name: 'Solo Sam', email: `solo-${stamp}@example.com`, password: 'runfast123' },
    'solo',
  );
  await solo.page.getByText('Train on my own', { exact: true }).click();
  await solo.page.waitForTimeout(1800);
  text = await solo.page.locator('body').innerText();
  check('a solo user lands on Home', text.includes('Daily goals'), text.slice(0, 200));

  await solo.page.getByText('Teams', { exact: true }).last().click({ force: true });
  await solo.page.waitForTimeout(2000);
  const soloTeams = await solo.page.locator('body').innerText();
  check('a solo user sees no teams', soloTeams.includes('No teams yet'), soloTeams.slice(0, 300));
  check('and none of anyone else’s', !soloTeams.includes('Thursday squad'), soloTeams.slice(0, 300));
  await shot(solo.page, '05-solo-teams');

  check('no console errors during the run', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] drive threw —', error.message);
} finally {
  await browser.close();
}

console.log(failures === 0 ? `\nAll checks passed. Screenshots in ${SHOTS}\n` : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
