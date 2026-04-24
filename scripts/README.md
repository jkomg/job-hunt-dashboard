# Scripts

One-off utility scripts for the Job Hunt Dashboard. These are not part of the app — run them locally as needed.

## start-local-docker.sh

Recommended end-user setup script (non-technical friendly).

### What it does

- Creates `.env` from `.env.example` if missing
- Ensures `SESSION_SECRET` is set
- Ensures local DB mode (`DATABASE_URL=file:./data/app.db`)
- Prompts for app username and writes `DEFAULT_USERNAME`
- Optionally prompts for Google Sheets linkage and writes:
  - `GOOGLE_SHEETS_ID`
  - `GOOGLE_SHEETS_SYNC_TABS`
  - `GOOGLE_SHEETS_CONTACTS_SYNC_TABS`
  - `GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS`
  - `GOOGLE_SHEETS_EVENTS_SYNC_TABS`
  - `GOOGLE_SHEETS_CREDENTIALS_JSON` (base64 from service-account JSON file)
- Starts Docker stack with build (`docker compose up --build -d`)
- Default seed account is created with forced password change on first sign-in

### Running

```bash
./scripts/start-local-docker.sh
```

Optional non-interactive presets:
- `DEFAULT_USERNAME`
- `ENABLE_SHEETS_SYNC` (`y/yes/true/1`)
- `SHEET_INPUT` (sheet URL or ID)
- `SHEET_CREDS_PATH` (path to service-account JSON)

## start-local-docker.ps1

Windows PowerShell equivalent of `start-local-docker.sh`.

### Running

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

Optional non-interactive presets:
- `DEFAULT_USERNAME`
- `ENABLE_SHEETS_SYNC` (`y/yes/true/1`)
- `SHEET_INPUT` (sheet URL or ID)
- `SHEET_CREDS_PATH` (path to service-account JSON)

## bootstrap-local.sh

Local onboarding helper for new users/contributors.

### What it does

- Creates `.env` from `.env.example` if missing
- Ensures `SESSION_SECRET` is set to a secure random value
- Installs dependencies (`npm install`)

### Running

```bash
./scripts/bootstrap-local.sh
```

## smoke-test-local.mjs

End-to-end local smoke test for reliability checks.

### What it validates

- app boot with a fresh local SQLite DB
- local login flow
- forced password change flow
- save/read daily check-in
- Sheets sync endpoint path (success or expected structured config error)

### Running

```bash
npm run smoke:test
```

## import-legacy-jobs.js (legacy)

Bulk-imports a legacy Notion page of job applications into the pipeline database.

### What it does

- Reads a Notion page that contains a numbered list of job applications
- Parses each entry for: company, role, job URL, date applied, and outcome
- Strikethrough text → `Ghosted`; entries containing "rejected" → `Rejected — No Interview`
- Creates a `❌ Closed` pipeline card for each entry

### Setup

```bash
cp .env.example .env   # ensure NOTION_TOKEN and NOTION_PIPELINE_DB are set
```

### Running

```bash
node scripts/import-legacy-jobs.js
```

Safe to inspect before running — it only creates records, never deletes.

### Adapting for your own list

1. Change `SOURCE_PAGE_ID` at the top of the script to your Notion page ID
   - Find it in the page URL: `notion.so/Your-Page-Title-{PAGE_ID}`
2. The parser expects a **numbered list** where each item is roughly:
   `Company — Role — URL — Date (M/D)`
3. Strikethrough items are treated as closed. Adjust the `outcome` logic in `parseEntry()` if your list uses different conventions.
4. Date inference assumes months after the current month belong to last year. If your list spans a different period, override with `IMPORT_YEAR=2024 node scripts/import-legacy-jobs.js`.

### Limitations

- Role extraction is best-effort on free-form text — some entries may need manual cleanup after import
- Does not deduplicate: running twice will create duplicate entries
- Only processes top-level numbered list items (not sub-pages or nested lists)

## migrate-notion-to-turso.mjs

One-time migration helper to copy legacy Notion data into Turso tables.

### Running

```bash
node scripts/migrate-notion-to-turso.mjs
```

### Notes

- Requires `NOTION_TOKEN` and the relevant `NOTION_*_DB` values in `.env`.
- Skips each entity if the destination Turso table already contains rows.
- Intended for cutover; runtime app no longer depends on Notion.

## setup-daily-sheets-sync.sh

Creates/updates a Cloud Scheduler HTTP job that runs Sheets sync once per day.

### What it does

- Creates a dedicated scheduler service account (`jobhunt-scheduler-invoker`)
- Grants it `roles/run.invoker` on the Cloud Run service
- Creates or updates job `job-hunt-daily-sheets-sync`
- Calls `/api/internal/sheets/sync` with:
  - OIDC auth to Cloud Run
  - `x-sync-token` header (must match `SHEETS_SYNC_CRON_TOKEN`)

### Running

```bash
chmod +x ./scripts/setup-daily-sheets-sync.sh
CRON_TOKEN="$(grep '^SHEETS_SYNC_CRON_TOKEN=' .env | cut -d'=' -f2-)" \
DOMAIN="hunt.jkomg.us" \
./scripts/setup-daily-sheets-sync.sh
```

## setup-daily-backup-export.sh

Creates/updates a Cloud Scheduler HTTP job that exports a JSON backup to Cloud Storage once per day.

### What it does

- Creates/reuses scheduler service account (`jobhunt-scheduler-invoker`)
- Grants `roles/run.invoker` on the Cloud Run service
- Creates or updates job `job-hunt-daily-backup-export`
- Calls `/api/internal/backup/export` with:
  - OIDC auth to Cloud Run
  - `x-backup-token` header (must match `BACKUP_EXPORT_CRON_TOKEN`)

### Prerequisites

- `BACKUP_EXPORT_CRON_TOKEN` configured in app env/secrets
- `BACKUP_GCS_BUCKET` configured in app env/secrets
- Cloud Run runtime service account has bucket write access:
  - `roles/storage.objectCreator` (minimum)

### Running

```bash
chmod +x ./scripts/setup-daily-backup-export.sh
CRON_TOKEN="$(grep '^BACKUP_EXPORT_CRON_TOKEN=' .env | cut -d'=' -f2-)" \
DOMAIN="hunt.jkomg.us" \
./scripts/setup-daily-backup-export.sh
```
