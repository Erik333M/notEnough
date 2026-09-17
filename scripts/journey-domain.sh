#!/usr/bin/env bash
#
# Domain checks for the Success Journey state layer.
#
#   npm run test:journey
#
# The layer is TypeScript and imports two Expo modules with no Node build, so
# it is compiled to CommonJS and those two are stubbed. This used to live only
# in a comment at the top of the test, which is how the test came to sit
# broken for nine days without anyone noticing.

set -euo pipefail
cd "$(dirname "$0")/.."

BUILD="${TMPDIR:-/tmp}/journey-build"
rm -rf "$BUILD"

npx tsc --ignoreConfig src/state/journey/*.ts \
  --outDir "$BUILD" --rootDir src --module commonjs --target es2020 \
  --resolveJsonModule --esModuleInterop --skipLibCheck --strict

mkdir -p "$BUILD/lib"
echo "const {randomUUID}=require('node:crypto');exports.makeId=()=>randomUUID();" \
  > "$BUILD/lib/crypto.js"
printf "const m=new Map();exports.secureGet=async(k,f)=>m.has(k)?m.get(k):f;\
exports.secureSet=async(k,v)=>void m.set(k,v);\
exports.secureDelete=async k=>void m.delete(k);" > "$BUILD/lib/secure.js"

B="$BUILD" node e2e/journey/domain-smoke.js
