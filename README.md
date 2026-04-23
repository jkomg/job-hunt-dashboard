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
git clone <your-repo-url>
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

Then open [http://localhost:8080](http://localhost:8080)

Default login (session mode):

- username: `jason`
- password: `jobhunt2026`

### Install + Run (Windows PowerShell)

```powershell
git clone <your-repo-url>
cd job-hunt-dashboard
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

Then open [http://localhost:8080](http://localhost:8080)

Default login (session mode):

- username: `jason`
- password: `jobhunt2026`

### Local Data Storage

- Data is stored locally in `./data/app.db`
- This persists across container restarts and machine reboots
- No Turso or cloud account is required for this mode

## Optional: Google Sheets Sync

If you want to sync with a shared sheet (for example, Remote Rebellion workflows):

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

## Docs

- Additional scripts and usage notes: [scripts/README.md](./scripts/README.md)
- Deployment helpers: `deploy.sh`, `setup-secrets.sh`, `scripts/setup-iap-lb.sh`, `scripts/setup-daily-sheets-sync.sh`

## License

MIT
