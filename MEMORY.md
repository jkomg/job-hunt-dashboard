# Memory

## Project Snapshot
- Name: `job-hunt-dashboard`
- Purpose: personal job-search tracker with React frontend, Express API, Turso-backed data, and Google Sheets bi-directional sync.
- Current operating mode: deployed directly on Cloud Run with built-in session auth; `hunt.jkomg.us` uses a Cloud Run domain mapping, not IAP/LB.

## Architecture
- Frontend: React 18 + Vite (`src/`)
- Backend: Express (`server/server.js`)
- Auth/session store: Turso/libSQL via `@libsql/client` (`server/db.js`) with local sqlite file fallback
- All app modules now in Turso: pipeline, contacts, interviews, events, templates, watchlist, daily logs
- Optional one-time legacy importer from Notion: `scripts/migrate-notion-to-turso.mjs`
- Google Sheets sync: `server/sheetsSync.js` (inbound row import + outbound status/notes/follow-up updates)
- Runtime composition:
  - Vite dev server on `:3000`
  - Express API on `:3001`
  - Vite proxy forwards `/api` -> `http://localhost:3001`

## Key Commands
- Install: `npm install`
- Dev (client + server): `npm run dev`
- API only: `npm run server`
- Client build: `npm run build`
- Docker: `docker compose up --build` (maps host `8080` -> container `3001`)

## Environment Expectations
- Runtime does not require Notion env vars.
- Required runtime vars: Turso (`DATABASE_URL`, `TURSO_AUTH_TOKEN`), Sheets creds/tabs, session/auth vars.
- Optional migration-only vars: `NOTION_TOKEN` + `NOTION_*_DB` used only by migration script.
- Auth supports modes via `AUTH_MODE`: `session`, `iap`, or `hybrid`; seeds local default user (`jason`) for session mode.
- Cloud Run deploy path uses Secret Manager via `setup-secrets.sh` + `deploy.sh`; default `AUTH_MODE` is `session`.
- IAP mode (`AUTH_MODE=iap`) remains available through `scripts/setup-iap-lb.sh` for advanced deployments, but it creates a fixed-cost HTTPS load balancer.

## Runtime Validation Done
- `npm run build` succeeds.
- Module import checks succeed (`server/db.js`, `server/sheetsSync.js`).
- Cloud Run revision `job-hunt-dashboard-00035-lkm` deployed at 100% traffic with `AUTH_MODE=session`.
- Removed job-hunt load balancer resources from GCP: global forwarding rules, backend service, NEG, SSL certs, and reserved global IP.
- Created Cloud Run domain mapping for `hunt.jkomg.us`; DNS must point `hunt` CNAME to `ghs.googlehosted.com.` for certificate provisioning.
- Scheduler remains enabled for daily sync and targets the direct Cloud Run URL.
- Applied GCP cost controls: Artifact Registry cleanup policy, static asset logging exclusion, and `$15/month` budget alerts.

## Notable Risks / Follow-up Areas
- Security hardening before exposing beyond localhost:
  - remove default credentials seeding
  - enforce secure cookie settings in production
  - add session expiration and cleanup in DB
  - add rate limiting + basic hardening middleware
  - validate/sanitize request payloads
- Efficiency scaling:
  - add indexes for high-frequency filters/sorts on large tables
  - monitor Sheets sync runtime as row count grows
- Codebase quality:
  - minimal tests and no API contract validation coverage
  - add integration tests for sync conflict behavior and auth-protected endpoints

## Suggested Next Implementation Order
1. Authentication/session hardening (security blockers)
2. Add API validation + centralized error handling
3. Add scheduled sync observability (alerts + run-failure notifications)
4. Add indexes and query tuning for larger datasets
5. Add integration tests for auth + daily/pipeline/sync API flows
