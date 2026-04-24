#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="${HOME}/Desktop"
START_LAUNCHER="${DESKTOP_DIR}/Start Job Hunt.command"
STOP_LAUNCHER="${DESKTOP_DIR}/Stop Job Hunt.command"

mkdir -p "$DESKTOP_DIR"

cat > "$START_LAUNCHER" <<EOF
#!/bin/bash
cd "${ROOT_DIR}"
./scripts/start-job-hunt.sh
EOF

cat > "$STOP_LAUNCHER" <<EOF
#!/bin/bash
cd "${ROOT_DIR}"
./scripts/stop-job-hunt.sh
EOF

chmod +x "$START_LAUNCHER" "$STOP_LAUNCHER"

echo "Created launchers:"
echo "  $START_LAUNCHER"
echo "  $STOP_LAUNCHER"
