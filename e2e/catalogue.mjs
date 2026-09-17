/**
 * The seeded catalogues, in the screen that uses them.
 *
 *   node e2e/catalogue.mjs
 *
 * The movement list comes from the TotalFit workbook and is 223 entries. The
 * domain checks prove it loads; this proves it is searchable where a movement
 * name is actually needed — inside the workout builder.
 */

import { chromium } from 'playwright';
const APP='http://localhost:8081'; const stamp=Date.now();
const b = await chromium.launch({ channel:'chrome', headless:true });
const p = await b.newPage({ viewport:{width:412,height:900} });
const errs=[]; let fails=0;
p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
const check=(l,ok,d='')=>{if(!ok)fails++;console.log(`  [${ok?'PASS':'FAIL'}] ${l}${!ok&&d?` — ${d}`:''}`)};

await p.goto(APP,{waitUntil:'networkidle'});
await p.getByText('NOTenough').first().waitFor({timeout:30000});
await p.getByText('Create account',{exact:true}).first().click();
await p.waitForTimeout(400);
await p.getByPlaceholder('Alex Carter').fill('Cat Tester');
await p.getByPlaceholder('you@example.com').fill(`cat-${stamp}@t.local`);
await p.getByPlaceholder('At least 6 characters').fill('runfast123');
await p.getByText('Create account',{exact:true}).last().click();
await p.waitForTimeout(2500);
await p.getByText('Train on my own',{exact:true}).click({force:true});
await p.waitForTimeout(2200);

await p.getByText('Journey',{exact:true}).last().click({force:true});
await p.waitForTimeout(2500);
if ((await p.locator('body').innerText()).includes('One page a day')) {
  await p.getByText('Skip, take me to today',{exact:true}).first().click({force:true});
  await p.waitForTimeout(1400);
}

// The catalogue is reached through the workout builder, which is where a
// movement name is actually needed.
await p.getByText('Open the full page',{exact:true}).first().click({force:true});
await p.waitForTimeout(1200);
await p.getByText('Log a workout',{exact:true}).first().click({force:true});
await p.waitForTimeout(1000);
await p.getByText('Add a line',{exact:true}).first().click({force:true});
await p.waitForTimeout(800);
await p.getByLabel('Choose a movement').first().click({force:true});
await p.waitForTimeout(900);
let t = await p.locator('body').innerText();
check('movement picker opens', t.includes('Search movements') || t.includes('movement'), t.slice(0,200));

const search = p.getByPlaceholder('Search movements').first();
await search.fill('turkish');
await p.waitForTimeout(900);
t = await p.locator('body').innerText();
check('finds a workbook movement', t.includes('Turkish Get-Up'), t.slice(0,300));

await search.fill('t2b');
await p.waitForTimeout(900);
t = await p.locator('body').innerText();
check('alias search still works', t.toLowerCase().includes('toes to bar'), t.slice(0,300));

await search.fill('kettlebell');
await p.waitForTimeout(900);
t = await p.locator('body').innerText();
check('finds many kettlebell movements', (t.match(/Kettlebell/g)||[]).length > 4, String((t.match(/Kettlebell/g)||[]).length));

await search.fill('halting');
await p.waitForTimeout(900);
t = await p.locator('body').innerText();
check('finds complex barbell work', t.includes('Halting Clean Deadlift'), t.slice(0,300));

await search.fill('');
await p.waitForTimeout(900);
await p.screenshot({path:'e2e/screenshots/movements-library.png',timeout:8000}).catch(()=>{});
check('no console errors', errs.length===0, errs.slice(0,2).join(' | '));
await b.close();
console.log(fails===0?'\nAll checks passed.\n':`\n${fails} failed.\n`);
process.exit(fails===0?0:1);
