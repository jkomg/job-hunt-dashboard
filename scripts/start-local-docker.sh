#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

default_username="${DEFAULT_USERNAME:-jason}"
if [[ -t 0 ]]; then
  read -r -p "Choose app username [${default_username}]: " input_username
  if [[ -n "${input_username:-}" ]]; then
    default_username="$input_username"
  fi
fi
default_username="$(printf '%s' "$default_username" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if [[ -z "$default_username" ]]; then
  default_username="jason"
fi
export DEFAULT_USERNAME_CHOSEN="$default_username"

install_mode="$(printf '%s' "${INSTALL_MODE:-guided}" | tr '[:upper:]' '[:lower:]')"
if [[ "$install_mode" != "guided" && "$install_mode" != "no-google" && "$install_mode" != "with-google" ]]; then
  install_mode="guided"
fi

enable_sheets_sync="$(printf '%s' "${ENABLE_SHEETS_SYNC:-}" | tr '[:upper:]' '[:lower:]')"
if [[ -z "$enable_sheets_sync" ]]; then
  if [[ "$install_mode" == "with-google" ]]; then
    enable_sheets_sync="y"
  elif [[ "$install_mode" == "no-google" ]]; then
    enable_sheets_sync="n"
  else
    enable_sheets_sync="n"
  fi
fi

sheet_input="${SHEET_INPUT:-${GOOGLE_SHEETS_SOURCE:-}}"
sheet_creds_path="${SHEET_CREDS_PATH:-${GOOGLE_SHEETS_CREDENTIALS_FILE:-}}"
if [[ -t 0 ]]; then
  if [[ "$install_mode" == "guided" ]]; then
    echo
    echo "Choose install mode:"
    echo "  1) No Google sync (Recommended for easiest setup)"
    echo "  2) With Google sync (for shared spreadsheet workflows)"
    read -r -p "Enter 1 or 2 [1]: " mode_choice
    if [[ "${mode_choice:-1}" == "2" ]]; then
      enable_sheets_sync="y"
      install_mode="with-google"
    else
      enable_sheets_sync="n"
      install_mode="no-google"
    fi
  fi

  if [[ "$enable_sheets_sync" == "y" || "$enable_sheets_sync" == "yes" || "$enable_sheets_sync" == "true" || "$enable_sheets_sync" == "1" ]]; then
    enable_sheets_sync="y"
    echo
    echo "Google Sheets setup (one-time):"
    echo "1) Open https://console.cloud.google.com/ and create/select a project."
    echo "2) Enable API: 'Google Sheets API'."
    echo "3) Go to APIs & Services -> Credentials -> Create Credentials -> Service account."
    echo "4) Open that service account -> Keys -> Add key -> Create new key -> JSON."
    echo "5) Save the downloaded JSON file somewhere safe on this computer."
    echo "6) In your Google Sheet, click Share and add the service-account email as Editor."
    echo "   The email usually looks like: name@project-id.iam.gserviceaccount.com"
    echo
    if [[ -z "${sheet_input:-}" ]]; then
      read -r -p "Paste Google Sheet URL (or ID): " sheet_input
    fi
    if [[ -z "${sheet_creds_path:-}" ]]; then
      read -r -p "Paste full path to downloaded service-account JSON file: " sheet_creds_path
    fi
  else
    enable_sheets_sync="n"
  fi
fi
export ENABLE_SHEETS_SYNC="$enable_sheets_sync"
export SHEET_INPUT="${sheet_input:-}"
export SHEET_CREDS_PATH="${sheet_creds_path:-}"

python3 - <<'PY'
import os
import re
import pathlib
import secrets
import base64
import json

p = pathlib.Path(".env")
lines = p.read_text().splitlines()
seed_username = os.environ.get("DEFAULT_USERNAME_CHOSEN", "jason").strip().lower() or "jason"
enable_sheets_sync = os.environ.get("ENABLE_SHEETS_SYNC", "n").strip().lower() in {"y", "yes", "true", "1"}
sheet_input = os.environ.get("SHEET_INPUT", "").strip()
sheet_creds_path = os.environ.get("SHEET_CREDS_PATH", "").strip()

DEFAULT_PIPELINE_TABS = "Jobs & Applications,Found"
DEFAULT_CONTACTS_TABS = "Networking Tracker"
DEFAULT_INTERVIEWS_TABS = "Interview Tracker"
DEFAULT_EVENTS_TABS = "Events"

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
upsert("DEFAULT_USERNAME", seed_username, only_if_empty=False)

def extract_sheet_id(value):
    if not value:
        return None
    value = value.strip()
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", value)
    if m:
        return m.group(1)
    if re.fullmatch(r"[a-zA-Z0-9-_]{20,}", value):
        return value
    return None

if enable_sheets_sync:
    sheet_id = extract_sheet_id(sheet_input)
    creds_error = None
    creds_b64 = None

    if not sheet_id:
        creds_error = "Google Sheets sync skipped: invalid sheet URL/ID."
    else:
        creds_file = pathlib.Path(sheet_creds_path).expanduser()
        if not sheet_creds_path:
            creds_error = "Google Sheets sync skipped: no service-account JSON path provided."
        elif not creds_file.exists():
            creds_error = f"Google Sheets sync skipped: file not found: {creds_file}"
        else:
            try:
                raw = creds_file.read_text(encoding="utf-8")
                json.loads(raw)
                creds_b64 = base64.b64encode(raw.encode("utf-8")).decode("utf-8")
            except Exception as exc:
                creds_error = f"Google Sheets sync skipped: invalid credentials JSON ({exc})."

    if creds_error:
        print(creds_error)
    else:
        upsert("GOOGLE_SHEETS_ID", sheet_id, only_if_empty=False)
        upsert("GOOGLE_SHEETS_SYNC_TABS", DEFAULT_PIPELINE_TABS, only_if_empty=False)
        upsert("GOOGLE_SHEETS_CONTACTS_SYNC_TABS", DEFAULT_CONTACTS_TABS, only_if_empty=False)
        upsert("GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS", DEFAULT_INTERVIEWS_TABS, only_if_empty=False)
        upsert("GOOGLE_SHEETS_EVENTS_SYNC_TABS", DEFAULT_EVENTS_TABS, only_if_empty=False)
        upsert("GOOGLE_SHEETS_CREDENTIALS_JSON", creds_b64, only_if_empty=False)
        print("Google Sheets sync configured for all supported Remote Rebellion tabs.")

p.write_text("\n".join(lines) + "\n")
print("Prepared .env for local Docker mode")
PY

mkdir -p data
docker compose up --build -d

echo
echo "Job Hunt Dashboard is starting in Docker mode."
echo "Open: http://localhost:8080"
if [[ "$enable_sheets_sync" == "y" ]]; then
  echo "Install mode: With Google sync"
else
  echo "Install mode: No Google sync"
fi
echo "Default login (session mode): ${default_username} / jobhunt2026"
echo "First sign-in will force a password change."
echo "Data persists in: ./data/app.db"
