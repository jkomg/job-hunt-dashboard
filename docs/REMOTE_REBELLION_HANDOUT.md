# Remote Rebellion Job Hunt Dashboard

Free personal job-hunt tracker (no paid tools required for local use).

## What It Helps You Track

- jobs you want and jobs you applied to
- networking contacts and follow-up dates
- interviews and events
- daily progress and tomorrow's Top 3

## Before You Start

- Install Docker Desktop [get it here](https://docs.docker.com/get-started/introduction/get-docker-desktop/)
- Make sure Docker Desktop is running
- No GitHub account is required

## Install (Mac/Linux)
Open Terminal (`Applications` -> `Utilities` -> `Terminal`)

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

What this does:
- creates a `Projects` folder if needed
- downloads the app
- starts guided setup:
  - choose username
  - choose install mode (`No Google sync` or `With Google sync`)
- starts the app in Docker

If you don't have `git` installed, use the ZIP install method below.

## Install (Windows PowerShell)
Open PowerShell.

```powershell
mkdir "$HOME\Projects" -Force
cd "$HOME\Projects"
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

What this does:
- creates a `Projects` folder if needed
- downloads the app
- starts guided setup:
  - choose username
  - choose install mode (`No Google sync` or `With Google sync`)
- starts the app in Docker

If you don't have `git` installed, use the ZIP install method below.

## Install (No Git / No GitHub Account Needed)

1. Open: [https://github.com/jkomg/job-hunt-dashboard](https://github.com/jkomg/job-hunt-dashboard)
2. Click **Code** -> **Download ZIP**
3. Unzip the folder
4. Open Terminal (Mac/Linux) or PowerShell (Windows) in that folder
5. Run:

- Mac/Linux:
```bash
./scripts/start-local-docker.sh
```

- Windows PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

## Open the App

- Go to: `http://localhost:8080`
- First login runs a quick setup wizard:
  - choose display name
  - set username for local sign-in
  - optionally connect/test Google Sheets during setup
- Sign in:
  - username: the one you chose in setup (default `jason`)
  - password: `jobhunt2026`
- On first sign-in, you must change the default password before using the app.

## Where Your Data Lives

- Your data is stored on your machine in `./data/app.db`
- It stays after restart/reboot
- No cloud DB is required for local mode

## Daily Use (5-Minute Routine)

1. Open `Dashboard` and start with `Today Queue` (top item first).
   - Use `Focus Now` for quick jumps to Interviews, Follow-ups, and Stale items.
   - Use `Top 3 Actions` to open the exact record directly when available.
2. Work through urgent items in this order:
   - Interview Readiness
   - Follow-Ups Due
   - Pipeline Momentum
   - Networking Consistency
   - Application Throughput
   - Events & Market Presence
3. When updating any job/contact/interview, always set:
   - `Next Action`
   - `Next Action Date`
4. End day with `Daily Check-in` and click `Auto-fill from Today Queue` for tomorrow’s Top 3.

What “stalled” means:
- A record is stalled when it has no `Next Action` or no `Next Action Date`.
- Keep stalled count low in Dashboard `System Health`.

## Team Staff Workflow (Remote Rebellion)

If you are a staff/admin user (not a job seeker), use `Staff Ops`:

1. Select candidate using focus filters:
   - interview active
   - stale follow-ups
   - no recent activity (7d+)
   - new RR jobs (72h)
2. Add recommendations in `Job Research`.
3. Post recommendations in `Distribution`:
   - leave `Notify candidate in Inbox when posting` enabled for normal use.
4. Use `Candidate Threads` for support communication:
   - `shared_with_candidate` for candidate-visible messages
   - `internal_staff` for internal-only discussion
5. Use tasks and quick flags:
   - `Flag Follow-up`
   - `Flag Interview Prep`

## Optional: Sync With Shared Google Sheet

This is optional for team workflows.

### Step-by-step (first time only)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. Enable `Google Sheets API`.
3. Go to `APIs & Services` -> `Credentials` -> `Create Credentials` -> `Service account`.
4. Open that service account and create a JSON key:
   - `Keys` -> `Add key` -> `Create new key` -> `JSON`
5. Save the downloaded `.json` file somewhere easy to find.
6. Open your Google Sheet and click `Share`.
7. Add the service-account email as `Editor`.
8. Re-run install script and choose Google Sheets sync when prompted.

Notes:
- Service-account email usually looks like `name@project-id.iam.gserviceaccount.com`.
- If you skip sharing the sheet with this email, sync will fail.
- Pipeline sync includes `App Date`, `Resume URL`, and `Cover Letter` updates.

### Manual `.env` setup (optional)

1. Add Google Sheets values in `.env`.
2. Restart app:

```bash
docker compose restart
```

3. Trigger sync (from app/API route `/api/sheets/sync`) when needed.

## Stop / Start Later

- Stop:

```bash
docker compose down
```

- Start again:

```bash
docker compose up -d
```

## Optional Desktop Launchers

For non-technical users, create clickable Desktop start/stop shortcuts:

- macOS:
```bash
chmod +x ./scripts/create-launchers-mac.sh
./scripts/create-launchers-mac.sh
```

- Windows:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-launchers-windows.ps1
```

## Need Help?

- Check the main project guide: `README.md`
- Check scripts usage: `scripts/README.md`
- In the app, open `Settings` to:
  - update sheet ID/tabs
  - run `Test Connection`
  - run `Run Sync Now`
  - confirm `Last saved locally` vs `Last synced to Google`
  - review per-entity sync results (pipeline/networking/interviews/events)
  - download `Sync Logs (CSV)` if something fails
  - run `Repair Interviews from Pipeline` if interview cards are missing from Interview Tracker
  - optionally connect Gmail and run `Import Events from Gmail`
  - export/restore JSON backups (admin users)
  - export raw `.db` file backups in local mode (admin users)

## Screenshot Placeholders

Put screenshots in `docs/images/install/`:
See detailed capture checklist: `docs/images/install/SHOT_LIST.md`.
- `mac-terminal-run-script.png`
- `windows-powershell-run-script.png`
- `installer-install-mode-choice.png`
- `installer-username-prompt.png`
- `installer-google-sync-prompts.png`
- `desktop-launchers-mac.png`
- `desktop-launchers-windows.png`
- `google-cloud-create-service-account.png`
- `google-cloud-download-json-key.png`
- `google-sheet-share-service-account.png`
- `first-login-screen.png`
