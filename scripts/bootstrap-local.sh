#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

python3 - <<'PY'
import pathlib, secrets

p = pathlib.Path(".env")
lines = p.read_text().splitlines()
out = []
found = False
for line in lines:
    if line.startswith("SESSION_SECRET="):
        found = True
        v = line.split("=", 1)[1].strip()
        if v in ("", "change-me-in-production"):
            out.append("SESSION_SECRET=" + secrets.token_urlsafe(48))
        else:
            out.append(line)
    else:
        out.append(line)
if not found:
    out.append("SESSION_SECRET=" + secrets.token_urlsafe(48))
p.write_text("\n".join(out) + "\n")
print("Ensured SESSION_SECRET in .env")
PY

npm install

echo
echo "Local bootstrap complete."
echo "Next:"
echo "  1) Review .env (Turso + optional Sheets values)"
echo "  2) Run: npm run dev"
