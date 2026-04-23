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
Open a terminal (Applications/Utilities/Terminal)
If you don't have a Projects directory I recommend you make one; an open terminal will be sitting at /Users/[yourusername] - to organize it.

```bash
(if Projects doesn't exist): mkdir Projects
cd Projects
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

If you don't have `git` installed, use the ZIP install method below.

## Install (Windows PowerShell)
If you don't have a Projects directory I recommend you make one; an open terminal will be sitting at /Users/[yourusername] - to organize it.

```powershell
(if Projects doesn't exist): mkdir Projects
cd Projects
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-docker.ps1
```

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
