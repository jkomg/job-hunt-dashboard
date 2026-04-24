# Job Hunt Dashboard

A free, self-hostable job search dashboard designed to be simple enough for non-technical job seekers.

## What This App Does

- Daily briefing: yesterday's Top 3, overdue follow-ups, active pipeline, weekly activity
- Command-center Today Queue with reasoned priorities and one-click actions
- Pipeline tracking with stages and follow-up dates
- Networking tracker (contacts + follow-ups)
- Interview tracker
- Events tracker
- Outreach templates and company watchlist
- Daily check-in habit tracker
- Next Action + Next Action Date fields across pipeline, contacts, and interviews
- Optional Google Sheets bi-directional sync for team workflows

## Command Center Workflow (Recommended)

Use the app as a daily command center, not just a tracker.

### The 6 Priorities Engine

`Today Queue` is automatically ranked by these six priorities:

1. Interview Readiness
2. Follow-Ups Due
3. Pipeline Momentum
4. Networking Consistency
5. Application Throughput
6. Events & Market Presence

Each queue item includes:
- a clear reason (`Why now`)
- one-click action button
- mapped priority pillar

### Daily Routine (fast)

1. Open `Dashboard` and use `Focus Now` first (Interviews, Follow-ups, Stale items).
2. Use `Top 3 Actions` for direct record-level links (opens the specific card when available).
3. Open each item and set/update `Next Action` and `Next Action Date`.
4. End day in `Daily Check-in` and use `Auto-fill from Today Queue` for tomorrow’s top 3.

Tip:
- If `System Health` shows stalled items, clear those first. Stalled items are records missing next action/date.

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
- first login opens a quick setup wizard to set:
  - dashboard display name
  - username (local sign-in)
  - optional Google Sheets link + in-flow connection test

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
- first login opens a quick setup wizard to set:
  - dashboard display name
  - username (local sign-in)
  - optional Google Sheets link + in-flow connection test

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

Pipeline sync notes (Remote Rebellion template):
- `Date Applied` in app writes to sheet `App Date`.
- `Resume URL` and `Cover Letter` fields on pipeline cards sync to matching sheet columns.
- Column `O` formula is maintained as `=TODAY()-I{row}` during pipeline outbound sync.

## Sync Troubleshooting (In-App)

Use `Settings` in the app sidebar:
- `Save Settings` to update sheet ID/tab mappings.
- `Test Connection` to validate credentials, sharing, and tab names.
- `Run Sync Now` to force a sync and see immediate result.
- `Sync Health` now shows both `Last saved locally` and `Last synced to Google`.
- `Sync Details` shows per-entity outcomes (pipeline/networking/interviews/events), including conflict counts.
- `Download Sync Logs (CSV)` exports recent sync history for troubleshooting/support.
- `Repair Interviews from Pipeline` to backfill missing interview entries from cards already in interview stages.

Common errors and fixes:
- `MISSING_SHEET_ID`: add Sheet URL/ID in Settings and save.
- `MISSING_CREDENTIALS`: set `GOOGLE_SHEETS_CREDENTIALS_JSON`, restart app.
- `INVALID_CREDENTIALS`: regenerate service-account JSON key and update env.
- `SHEET_PERMISSION_DENIED`: share the sheet with service-account email as Editor.
- `TAB_NOT_FOUND`: fix tab names in Settings to match exact sheet tab titles.
- `GOOGLE_API_DISABLED`: enable Google Sheets API in Google Cloud project.
- `GOOGLE_TEMPORARY`: retry later (rate-limit/outage/timeout).

## Optional: Import Events from Gmail

This can pull interview/calendar invite emails into the `Events` section.

### Configure once

1. In Google Cloud Console, open `APIs & Services` -> `Credentials`.
2. Create OAuth Client ID as `Web application`.
3. Add authorized redirect URI:
   - local Docker: `http://localhost:8080/api/gmail/oauth/callback`
   - cloud domain: `https://hunt.jkomg.us/api/gmail/oauth/callback`
4. Add to `.env`:

```env
GMAIL_OAUTH_CLIENT_ID=...
GMAIL_OAUTH_CLIENT_SECRET=...
GMAIL_OAUTH_REDIRECT_URI=...
```

5. Restart app (`docker compose restart` or redeploy Cloud Run).

### Use it

In `Settings`:
- `Connect Gmail` (read-only scope)
- `Import Events from Gmail`

Notes:
- Current importer prioritizes `.ics`/calendar invite emails for accuracy.
- Imports are deduped, so reruns do not create duplicate events.

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
- Command center implementation roadmap: [docs/COMMAND_CENTER_ROADMAP.md](./docs/COMMAND_CENTER_ROADMAP.md)
- Deployment helpers: `deploy.sh`, `setup-secrets.sh`, `scripts/setup-iap-lb.sh`, `scripts/setup-daily-sheets-sync.sh`

## License

MIT
