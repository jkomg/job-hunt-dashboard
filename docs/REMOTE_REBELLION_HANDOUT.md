# Remote Rebellion Job Hunt Dashboard

Free personal job-hunt tracker (no paid tools required for local use).

## What It Helps You Track

- jobs you want and jobs you applied to
- networking contacts and follow-up dates
- interviews and events
- daily progress and tomorrow's Top 3

## Before You Start

- Install Docker Desktop
- Make sure Docker Desktop is running

## Install (Mac/Linux)

```bash
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

## Install (Windows PowerShell)

```powershell
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

## Open the App

- Go to: `http://localhost:8080`
- Sign in:
  - username: `jason`
  - password: `jobhunt2026`

## Where Your Data Lives

- Your data is stored on your machine in `./data/app.db`
- It stays after restart/reboot
- No cloud DB is required for local mode

## Daily Use (5-Minute Routine)

1. Open Dashboard and check overdue follow-ups.
2. Update pipeline stages.
3. Log outreach and interviews.
4. End day with Daily Check-in and tomorrow's Top 3.

## Optional: Sync With Shared Google Sheet

This is optional for team workflows.

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

## Need Help?

- Check the main project guide: `README.md`
- Check scripts usage: `scripts/README.md`
