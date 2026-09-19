#!/usr/bin/env bash
#
# Total the automated checks.
#
#   npm run count
#
# The README carries a number. It went stale twice, because suites get added
# and nobody recounts by hand — so this exists to make recounting a command
# rather than an afternoon.
#
# Needs the API on :4137 and Metro on :8081 for the browser drives, the same
# as running them individually. Takes about fifteen minutes; most of that is
# Playwright.

set -uo pipefail
cd "$(dirname "$0")/.."

total=0

# Every suite prints one "[PASS] …" line per check, except the journey domain
# tests, which print a count. Both are handled rather than one being ignored.
count() {
  local label="$1" cmd="$2" n
  n="$(eval "$cmd" 2>&1 | grep -c '\[PASS\]')"
  printf '%-26s %4s\n' "$label" "$n"
  total=$((total + n))
}

count_summary() {
  local label="$1" cmd="$2" n
  n="$(eval "$cmd" 2>&1 | grep -oE '[0-9]+ checks passed' | grep -oE '^[0-9]+' | tail -1)"
  n="${n:-0}"
  printf '%-26s %4s\n' "$label" "$n"
  total=$((total + n))
}

echo
count         'server smoke'        'cd server && npm run --silent smoke'
count         'server npm test'     'cd server && npm test'
count         'e2e (main drive)'    'npm run --silent e2e'
count         'e2e:shell'           'npm run --silent e2e:shell'
count         'e2e:teams'           'npm run --silent e2e:teams'
count         'e2e:friends'         'npm run --silent e2e:friends'
count         'e2e:muscles'         'npm run --silent e2e:muscles'
count         'e2e:catalogue'       'npm run --silent e2e:catalogue'
count         'test:level'          'npm run --silent test:level'
count         'test:reminders'      'npm run --silent test:reminders'
count         'test:achievements'   'npm run --silent test:achievements'
count         'test:period'         'npm run --silent test:period'
count_summary 'test:journey'        'npm run --silent test:journey'
count         'e2e:journey'         'npm run --silent e2e:journey'

printf '%-26s %4s\n\n' 'TOTAL' "$total"
echo "Update the badge and the closing line in README.md to $total."
echo
