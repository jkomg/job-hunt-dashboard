# Memory

## Project Snapshot
- Name: `job-hunt-dashboard`
- Purpose: multi-role job-search command center — job seekers track their hunt, staff support assigned candidates, admins manage the org. Hosted first; self-host via Docker as secondary.
- Current operating mode: deployed on Cloud Run with built-in session auth; `hunt.jkomg.us` uses a Cloud Run domain mapping.
- Latest deployed revision: `job-hunt-dashboard-00062-h27`

## Roles
- `job_seeker`: Briefing, Pipeline, Outreach, Interviews, Events, Check-in, Templates, Watchlist, Settings
- `staff`: Briefing + Staff Ops (candidate overview, Research & Recommend, Tasks, Threads); can create candidates and self-assign
- `org_admin`: organization administration (users, invites, roles, assignments, audit log) plus staff capabilities
- `admin`: platform administration; also has organization-admin capabilities where applicable
- `accelerator_user`, `premium_user`, `vip_user`: organization-sponsored candidate roles; currently permission/service roles, not billing tiers

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
- Organization-admin-only: Team Access, Staff Assignments, Audit Log, invite/user lifecycle controls
- Platform-admin-only: global Backup & Restore, cost snapshots, and platform-level organization/membership operations

## Open-issue cross-reference (verified August 2026)
- #42 Remote Rebellion staff workspace: substantially shipped. Staff queue, assignments, candidate creation/self-assignment, recommendations, tasks, threads, support summaries, and audit logging exist. Remaining work is UAT/UX refinement, not the original MVP foundation.
- #43 DB-first RR integration and Sheets backup: substantially shipped. DB-first sync, scheduled Sheets sync/export, conflict-safe behavior, source observability, cleanup actions, and backup retention controls exist. Remaining proof is an operational daily backup plus a documented restore drill and failure-path verification.
- #44 Hosted production hardening: partially shipped. Invite/forced-password onboarding, reset flows, smoke coverage, backup endpoints, cost controls, concurrency measurement, and admin operational visibility exist. Remaining pilot gates include production error tracking/health review, restore drill, non-developer onboarding UAT, and any real email delivery path.
- #83 Hosted v2 platform baseline: largely shipped in code. Tenant schema/migrations, org membership, role helpers, assignment scope, org-scoped sync records, and cross-user isolation smoke tests exist. Reconcile the remaining release-gate documentation and deployed verification before closing.
- #90 Dev/prod split and controlled deployment: partially shipped as deployment-profile controls. `deploy.sh` has explicit feature flags, conditional secrets, beta `MAX_INSTANCES=2`, and documented promotion/runbook guidance. A fully separate dev/prod service/database/secrets promotion process is not evidenced by the repository.
- #91 Admin Ops Dashboard: partially shipped. Admin UI exposes cost snapshots, sync health, scheduler/cost status, and backup/restore actions. Scheduler mutation and complete platform-job management remain open.
- #114 In-app Action Guide: not implemented as a dedicated DB-backed module; existing Guides/templates are not equivalent to the proposed staff-reviewed Action Guide workflow.
- #121 User AI credential obfuscation: not implemented; defer unless users will enter provider/API secrets in the pilot.
- #130 Pricing tiers: intentionally deferred until after the Remote Rebellion pilot; pricing analysis is documented but no billing or entitlement system should be built yet.

## Verification baseline
- `npm run build` passes.
- `npm run smoke:test` passes, including health-profile verification, forced-password-change/onboarding, backup export/restore drill, org-admin permission matrix, cross-user isolation reads/writes, staff assignment/audit, member inbox access, and expected sync configuration failure handling.
- `scripts/release-gate-v2.sh` is the intended hosted release gate; it checks release docs, tenant markers, build, and smoke tests.

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
- Pilot operations:
  - local backup restore is now covered by smoke tests; hosted Cloud Storage export and Cloud Run restore still need an operator-recorded drill
  - no repository evidence of a production error-tracking provider or a complete dev/prod promotion boundary
  - reminder foundation exists, but outbound email delivery is intentionally not enabled
