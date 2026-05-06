#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[v2 gate] checking hosted release docs..."
test -f docs/HOSTED_V2_RELEASE_PLAN.md
test -f docs/DB_PLATFORM_DECISION.md
test -f docs/RELEASE.md

echo "[v2 gate] checking tenant schema markers..."
if command -v rg >/dev/null 2>&1; then
  rg -n "organization_id" server/db.js >/dev/null
  rg -n "Cross-user isolation" scripts/smoke-test-local.mjs >/dev/null
else
  grep -n "organization_id" server/db.js >/dev/null
  grep -n "Cross-user isolation" scripts/smoke-test-local.mjs >/dev/null
fi

echo "[v2 gate] running build..."
npm run build >/dev/null

echo "[v2 gate] running smoke test..."
npm run smoke:test >/dev/null

echo "[v2 gate] PASS"
