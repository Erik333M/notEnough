/**
 * Runs every Success Journey browser drive in order.
 *
 * Each phase file is a self-contained Playwright session that registers its own
 * account, so they can be run individually while debugging one area:
 *
 *   node e2e/journey/phase4.mjs        # benchmarks only
 *   node e2e/journey/run.mjs           # all of them
 *
 * Needs the app and the API running:
 *   cd server && npm start
 *   npm run web
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, 'screenshots');
fs.mkdirSync(shots, { recursive: true });

const phases = [2, 3, 4, 5, 6, 7];

let failed = 0;
for (const phase of phases) {
  process.stdout.write(`\n── phase ${phase} ${'─'.repeat(40)}\n`);
  const result = spawnSync(process.execPath, [path.join(here, `phase${phase}.mjs`)], {
    stdio: 'inherit',
    env: { ...process.env, S: process.env.S ?? shots },
  });
  if (result.status !== 0) failed += 1;
}

console.log(
  failed === 0
    ? `\nAll ${phases.length} phases passed.\n`
    : `\n${failed} of ${phases.length} phases failed.\n`,
);
process.exit(failed === 0 ? 0 : 1);
