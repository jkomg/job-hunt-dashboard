# Memory

## Project Snapshot
- Name: `job-hunt-dashboard`
- Purpose: personal job-search tracker with React frontend, Express API, Turso-backed data, and Google Sheets bi-directional sync.
- Current operating mode: deployed on Cloud Run with Google IAP at `hunt.jkomg.us` and local dev support (`npm run dev`).

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
- Cloud Run deploy path uses Secret Manager via `setup-secrets.sh` + `deploy.sh`.
- IAP mode (`AUTH_MODE=iap`) trusts `x-goog-authenticated-user-email`; `ADMIN_EMAILS` controls admin users.

## Runtime Validation Done
- `npm run build` succeeds.
- Module import checks succeed (`server/db.js`, `server/sheetsSync.js`).
- Cloud Run revision `job-hunt-dashboard-00019-w2x` deployed at 100% traffic.
- `hunt.jkomg.us` remains behind IAP and scheduler remains enabled for daily sync.

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
