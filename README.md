# Job Hunt Dashboard

A free, self-hostable job search dashboard designed to be simple enough for non-technical job seekers.

## What This App Does

- Daily briefing: yesterday's Top 3, overdue follow-ups, active pipeline, weekly activity
- Pipeline tracking with stages and follow-up dates
- Networking tracker (contacts + follow-ups)
- Interview tracker
- Events tracker
- Outreach templates and company watchlist
- Daily check-in habit tracker
- Optional Google Sheets bi-directional sync for team workflows

## Start Here: Easy Local Install (Recommended)

This path is intended to feel as close to "install app and use it" as possible.

### Prerequisites

- Docker Desktop installed and running

### Install + Run (macOS/Linux)

```bash
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

What this does:
- downloads the app
- asks you for a username
- optionally links your Google Sheet for sync
- starts the app locally in Docker

Then open [http://localhost:8080](http://localhost:8080).

Default login (session mode):

- username: whatever you chose during setup (default is `jason`)
- password: `jobhunt2026`
- first login opens a quick setup wizard to choose dashboard display name

### Install + Run (Windows PowerShell)

```powershell
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

What this does:
- downloads the app
- asks you for a username
- optionally links your Google Sheet for sync
- starts the app locally in Docker

Then open [http://localhost:8080](http://localhost:8080).

Default login (session mode):

- username: whatever you chose during setup (default is `jason`)
- password: `jobhunt2026`
- first login opens a quick setup wizard to choose dashboard display name

### Local Data Storage

- Data is stored locally in `./data/app.db`
- This persists across container restarts and machine reboots
- No Turso or cloud account is required for this mode

## Optional: Google Sheets Sync

If you want to sync with a shared sheet (for example, Remote Rebellion workflows):

### Non-Technical Setup (Service Account + Sharing)

1. Open [Google Cloud Console](https://console.cloud.google.com/), then create or select a project.
2. Enable `Google Sheets API`.
3. Go to `APIs & Services` -> `Credentials` -> `Create Credentials` -> `Service account`.
4. Open the new service account, then `Keys` -> `Add key` -> `Create new key` -> `JSON`.
5. Save the downloaded JSON file on your machine.
6. Open your Google Sheet, click `Share`, and add the service-account email as `Editor`.
7. Copy your sheet URL (or sheet ID).

Notes:
- Service-account email looks like `name@project-id.iam.gserviceaccount.com`.
- If the sheet is not shared with that email, sync will fail.

1. Put these values in `.env`:

```env
GOOGLE_SHEETS_ID=your_google_sheet_id
GOOGLE_SHEETS_SYNC_TABS=Jobs & Applications,Found
GOOGLE_SHEETS_CONTACTS_SYNC_TABS=Networking Tracker
GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS=Interview Tracker
GOOGLE_SHEETS_EVENTS_SYNC_TABS=Events
GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account",...}
```

2. Restart app:

```bash
docker compose restart
```

3. Run sync manually from app/API (`POST /api/sheets/sync`) or configure daily scheduler in cloud mode.

## Sync Troubleshooting (In-App)

Use `Settings` in the app sidebar:
- `Save Settings` to update sheet ID/tab mappings.
- `Test Connection` to validate credentials, sharing, and tab names.
- `Run Sync Now` to force a sync and see immediate result.

Common errors and fixes:
- `MISSING_SHEET_ID`: add Sheet URL/ID in Settings and save.
- `MISSING_CREDENTIALS`: set `GOOGLE_SHEETS_CREDENTIALS_JSON`, restart app.
- `INVALID_CREDENTIALS`: regenerate service-account JSON key and update env.
- `SHEET_PERMISSION_DENIED`: share the sheet with service-account email as Editor.
- `TAB_NOT_FOUND`: fix tab names in Settings to match exact sheet tab titles.
- `GOOGLE_API_DISABLED`: enable Google Sheets API in Google Cloud project.
- `GOOGLE_TEMPORARY`: retry later (rate-limit/outage/timeout).

## Screenshot Plan

Store install screenshots in `docs/images/install/` and keep both this README and the handout pointing to the same image files.

Recommended filenames:
- `mac-terminal-run-script.png`
- `windows-powershell-run-script.png`
- `installer-username-prompt.png`
- `installer-google-sync-prompts.png`
- `google-cloud-create-service-account.png`
- `google-cloud-download-json-key.png`
- `google-sheet-share-service-account.png`
- `first-login-screen.png`

## Backup & Restore

Admin users can use in-app `Settings`:
- `Export Backup` downloads a full JSON snapshot of app data/settings
- `Restore Backup` imports a previously exported JSON snapshot

Recommended:
- export a backup before major upgrades
- keep at least one weekly backup copy

## Alternative Install Paths

### Local Dev (for contributors)

```bash
./scripts/bootstrap-local.sh
npm run dev
```

- UI: `http://localhost:3000`
- API: `http://localhost:3001`

### Cloud Run + IAP (advanced)

```bash
./setup-secrets.sh
AUTH_MODE=iap ADMIN_EMAILS=you@example.com ./deploy.sh
```

### One-time Legacy Notion Import (optional)

Only if you are migrating old data from Notion into Turso:

```bash
npm run migrate:notion
```

Requires optional `NOTION_*` vars in `.env`.

## Runtime Model

- Runtime data store: Turso/libSQL interface
- Easy local mode: SQLite file (`DATABASE_URL=file:./data/app.db`) via Docker volume mount (`./data:/app/data`)
- Auth modes:
  - `session` (default local)
  - `iap` (cloud)
  - `hybrid`
- Session mode now includes:
  - CSRF protection for mutating API calls
  - built-in API/login rate limiting

## Docs

- Additional scripts and usage notes: [scripts/README.md](./scripts/README.md)
- Shareable one-page beginner guide: [docs/REMOTE_REBELLION_HANDOUT.md](./docs/REMOTE_REBELLION_HANDOUT.md)
- Deployment helpers: `deploy.sh`, `setup-secrets.sh`, `scripts/setup-iap-lb.sh`, `scripts/setup-daily-sheets-sync.sh`

## License

MIT
