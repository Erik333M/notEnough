#!/usr/bin/env bash
#
# One command to test on a real phone.
#
#   npm run dev
#
# Starts the API, then Metro in LAN mode in the foreground so the QR code
# renders in your terminal where you can actually scan it. Ctrl+C stops both.
#
# No Expo account is needed for this — Expo Go loads the bundle straight off
# your LAN. Signing in only matters for EAS builds and updates.

set -euo pipefail

cd "$(dirname "$0")/.."

API_PORT="${PORT:-4137}"

say() { printf '\033[1;35m›\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }

# The phone reaches this machine by LAN address, never by localhost.
lan_ip() {
  ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}'
}

IP="$(lan_ip || true)"
if [ -z "${IP:-}" ]; then
  warn "No LAN address found. Are you on Wi-Fi? Expo Go needs one to reach this machine."
fi

if [ ! -d node_modules ]; then
  say "Installing app dependencies…"
  npm install --silent
fi
if [ ! -d server/node_modules ]; then
  say "Installing server dependencies…"
  (cd server && npm install --silent)
fi

# Refuse to start a second API rather than silently talking to whatever else
# already holds the port — that failure looks like a CORS error, not a clash.
if lsof -ti:"$API_PORT" >/dev/null 2>&1; then
  warn "Port $API_PORT is already in use."
  warn "Something else is on it. Stop that, or run: PORT=4138 npm run dev"
  exit 1
fi

say "Starting the API on :$API_PORT"
node server/src/index.js &
API_PID=$!

# Metro runs in the foreground so its QR code lands in your terminal; the API
# is a child that has to go down with it, however it exits.
#
# Note the absence of `exec` on the Metro line below. Replacing this shell
# would take the trap with it, and an API that outlives Metro then holds the
# port against the next `npm run dev`.
cleanup() {
  if kill -0 "$API_PID" 2>/dev/null; then
    say "Stopping the API"
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Give the API a moment, then confirm it is actually answering before Metro
# takes over the terminal and buries any error it printed.
for _ in $(seq 1 20); do
  if curl -fsS --max-time 1 "http://localhost:$API_PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -fsS --max-time 1 "http://localhost:$API_PORT/api/health" >/dev/null 2>&1; then
  warn "The API did not come up. Scroll up for its error."
  exit 1
fi

if [ -n "${IP:-}" ]; then
  say "API ready at http://$IP:$API_PORT — your phone will use this automatically"
fi
say "Starting Metro. Scan the QR below with Expo Go, on the same Wi-Fi."
echo

npx expo start --lan
