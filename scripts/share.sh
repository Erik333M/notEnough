#!/usr/bin/env bash
#
# Let somebody else open the app, from anywhere.
#
#   npm run share
#
# `npm run dev` puts the app on your LAN, which is enough for a phone in the
# same room. This is for the other case: somebody on the far end of a call who
# needs to actually use it.
#
# Two tunnels, because two separate things have to be reachable — Metro, which
# serves the JavaScript to Expo Go, and the API, which holds the data and the
# chat socket. Expo tunnels Metro itself; cloudflared handles the API.
#
# ── Read this before you run it ─────────────────────────────────────────────
#
# The API tunnel is a public address on the internet. While it is up, anybody
# who has the URL can reach your server and create an account on it. The URL is
# long and random, so it will not be found by accident, but it is not a secret
# once you have sent it to anyone. Stop the script when the demo is over, and
# do not leave it running overnight.

set -euo pipefail
cd "$(dirname "$0")/.."

API_PORT="${PORT:-4137}"

say() { printf '\033[1;35m›\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$1"; exit 1; }

if ! command -v cloudflared >/dev/null 2>&1; then
  warn "This needs cloudflared to put the API on a public address."
  warn "Install it once:  brew install cloudflared"
  die  "Then run this again."
fi

# The dev default signs tokens that anybody reading this repository can forge.
# That does not matter on a LAN; on a public address it very much does.
if [ -z "${JWT_SECRET:-}" ]; then
  warn "JWT_SECRET is not set, so the server will sign sessions with its"
  warn "publicly known dev key. Fine for a demo with people you trust."
  warn "For anything else:  export JWT_SECRET=\"\$(openssl rand -hex 32)\""
  echo
fi

API_PID=""
TUNNEL_PID=""
TUNNEL_LOG="$(mktemp -t notenough-tunnel)"

cleanup() {
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    say "Stopping the API"
    kill "$API_PID" 2>/dev/null || true
  fi
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT INT TERM

# Same reasoning as dev.sh: reuse our own API, refuse a stranger's.
if lsof -ti:"$API_PORT" >/dev/null 2>&1; then
  if curl -fsS --max-time 2 "http://localhost:$API_PORT/api/health" 2>/dev/null \
      | grep -q 'notenough-api'; then
    say "Reusing the API already running on :$API_PORT"
  else
    die "Port $API_PORT is held by something that is not this project's API."
  fi
else
  say "Starting the API on :$API_PORT"
  node server/src/index.js &
  API_PID=$!
fi

for _ in $(seq 1 20); do
  curl -fsS --max-time 1 "http://localhost:$API_PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.25
done
curl -fsS --max-time 1 "http://localhost:$API_PORT/api/health" >/dev/null 2>&1 \
  || die "The API did not come up. Scroll up for its error."

say "Opening a public address for the API…"
cloudflared tunnel --url "http://localhost:$API_PORT" --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# cloudflared prints the address a second or two after it starts, and there is
# no flag that makes it tell you any sooner.
API_URL=""
for _ in $(seq 1 60); do
  API_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
  [ -n "$API_URL" ] && break
  sleep 0.5
done
[ -n "$API_URL" ] || { cat "$TUNNEL_LOG"; die "cloudflared did not give us an address."; }

# Prove it end to end before Metro takes over the terminal. A tunnel that is
# up but not routing looks exactly like a working one until somebody signs in.
curl -fsS --max-time 8 "$API_URL/api/health" | grep -q 'notenough-api' \
  || die "The tunnel is up but not reaching the API. Try again."

say "API is public at $API_URL"
say "Sessions and chat will go through it."
echo

warn "Expo will ask to install @expo/ngrok the first time — that is how it"
warn "tunnels Metro. Say yes; it is a dev tool, not part of the app."
echo
say "Scan the QR code below with Expo Go. It works from any network."
echo

# The app resolves its API from this at launch; see src/api/client.ts.
EXPO_PUBLIC_API_URL="$API_URL" npx expo start --tunnel
