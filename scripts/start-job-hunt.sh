#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

docker compose up -d
echo "Job Hunt Dashboard started."
echo "Open: http://localhost:8080"
