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

def upsert(key, value, only_if_empty=False):
    global lines
    for i, line in enumerate(lines):
        if line.startswith(key + "="):
            current = line.split("=", 1)[1].strip()
            if only_if_empty and current:
                return
            lines[i] = f"{key}={value}"
            return
    lines.append(f"{key}={value}")

session_secret = None
for line in lines:
    if line.startswith("SESSION_SECRET="):
        v = line.split("=", 1)[1].strip()
        if v and v != "change-me-in-production":
            session_secret = v
        break

if not session_secret:
    upsert("SESSION_SECRET", secrets.token_urlsafe(48))

upsert("DATABASE_URL", "file:./data/app.db", only_if_empty=True)
upsert("AUTH_MODE", "session", only_if_empty=True)

p.write_text("\n".join(lines) + "\n")
print("Prepared .env for local Docker mode")
PY

mkdir -p data
docker compose up --build -d

echo
echo "Job Hunt Dashboard is starting in Docker mode."
echo "Open: http://localhost:8080"
echo "Default login (session mode): jason / jobhunt2026"
echo "Data persists in: ./data/app.db"
