# Memory

## Project Snapshot
- Name: `job-hunt-dashboard`
- Purpose: multi-role job-search command center — job seekers track their hunt, staff support assigned candidates, admins manage the org. Hosted first; self-host via Docker as secondary.
- Current operating mode: deployed on Cloud Run with built-in session auth; `hunt.jkomg.us` uses a Cloud Run domain mapping.
- Latest deployed revision: `job-hunt-dashboard-00062-h27`

## Roles
- `job_seeker`: Briefing, Pipeline, Outreach, Interviews, Events, Check-in, Templates, Watchlist, Settings
- `staff`: Briefing + Staff Ops (candidate overview, Research & Recommend, Tasks, Threads); can create candidates and self-assign
- `admin`: all staff capabilities + Team Access, Staff Assignments, Audit Log in Settings

## Architecture
- Frontend: React 18 + Vite (`src/`)
- Backend: Express (`server/server.js`)
- Auth/session store: Turso/libSQL via `@libsql/client` (`server/db.js`) with local sqlite file fallback
- All app modules in Turso: pipeline, contacts, interviews, events, templates, watchlist, daily logs, recommendations, threads, messages, tasks, sheet_sync_links
- Google Sheets sync: `server/sheetsSync.js` (bidirectional; inbound import + outbound status/notes/field updates)
- Docker: multi-stage build (builder stage runs `npm ci` + `vite build`; runtime stage runs `npm ci --omit=dev` + copies dist/ + server/)
- Runtime composition (dev):
  - Vite dev server on `:3000`
  - Express API on `:3001`
  - Vite proxy forwards `/api` -> `http://localhost:3001`

## Key Commands
- Install: `npm install`
- Dev (client + server): `npm run dev`
- API only: `npm run server`
- Client build: `npm run build`
- Docker: `docker compose up --build` (maps host `8080` -> container `3001`)
- Deploy to Cloud Run: `bash deploy.sh`

## Environment Expectations
- Required runtime vars: Turso (`DATABASE_URL`, `TURSO_AUTH_TOKEN`), Sheets creds/tabs, session/auth vars.
- Auth supports modes via `AUTH_MODE`: `session`, `iap`, or `hybrid`; seeds local default user for session mode.
- Cloud Run deploy path uses Secret Manager via `setup-secrets.sh` + `deploy.sh`; default `AUTH_MODE` is `session`.
- git remote is SSH: `git@github.com:jkomg/job-hunt-dashboard.git`

## Google Sheets Sync Notes
- Outbound writes: Company, Role, Job URL, Job Source, Found By, Stage, Follow-Up, Notes, Research Notes, Date Applied, Resume URL, Cover Letter
- Closed entries (`❌ Closed`) are excluded from outbound export
- `sheet_sync_links` table tracks (sheet_id, tab_name, row_number) → pipeline_page_id with inbound/outbound hashes
- `upsertSheetSyncLink` deletes stale links for the same `pipeline_page_id` at a different row before inserting (prevents UNIQUE constraint failures)
- Bounds check: links where row_number > sheetMaxRow are deleted and items re-appended

## Staff Ops UI (current)
- Candidate overview table with signal badges (Interview, Stale, Inactive 7d, RR 72h)
- Signal filter dropdown scopes table
- "Working on: [Name]" context bar with dropdown switcher
- Research & Recommend card (draft + post in one; formerly separate Job Research + Distribution)
- New Task card (separate from task list); New Thread card (separate from thread list)
- Default filters: taskStatusFilter='open', threadStatusFilter='open'
- Staff can create candidates (POST /api/staff/candidates → auto-assigns to self)
- Staff can self-assign to unassigned candidates (POST /api/staff/self-assign)

## Settings UI (current)
- Google Sheets Sync: merged card (health + per-entity status + config + actions + collapsible recent runs)
- Gmail card is user-scoped, not admin-gated
- Admin-only: Team Access, Staff Assignments, Audit Log, Backup & Restore

## GCP / Deployment
- Cloud Run revision `job-hunt-dashboard-00062-h27` at 100% traffic
- Domain mapping: `hunt.jkomg.us` → CNAME `ghs.googlehosted.com.`
- Scheduler enabled for daily sync, targets direct Cloud Run URL
- GCP cost controls: Artifact Registry cleanup policy, static asset logging exclusion, $15/month budget alert

## Notable Risks / Follow-up Areas
- Security hardening:
  - remove default credentials seeding
  - enforce secure cookie settings in production
  - add session expiration and cleanup
  - add rate limiting + hardening middleware
- Codebase quality:
  - minimal tests; no integration test coverage for sync conflict behavior or auth-protected endpoints
