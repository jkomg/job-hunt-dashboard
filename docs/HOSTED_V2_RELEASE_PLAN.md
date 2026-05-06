# Hosted v2 Release Plan

Date: 2026-05-06
Target: `v2.0.0`
Model: Hosted server/client app (no end-user local install path)

## Product positioning shift

v2 is a hosted product:

- admins provision users/orgs
- users sign in to a hosted URL
- role-based workflows for `job_seeker`, `staff`, `org_admin`, `platform_admin`

Local Docker/self-host docs move to legacy/internal recovery docs and are not primary onboarding.

## Scope for v2.0.0

### In scope

- Hard multi-tenant boundaries at DB + API layer
- Org/user lifecycle (create org, invite user, role assignment)
- Staff scoping limited to same org and assigned candidates
- Hosted-first docs and runbooks
- Security hardening checklist for public hosted runtime
- DB source-of-truth with optional RR sheets integration/backup

### Out of scope for v2.0.0

- Paid billing/subscription
- Self-serve public signup
- Enterprise SSO
- Cross-org tenant switching UI for end users

## Release tracks

### Track A: Tenant safety (must ship)

1. Enforce `organization_id` on all business tables and queries.
2. Add regression tests for cross-org data access denial.
3. Add admin tools to verify staff/user org assignments.

Exit criteria:

- No cross-org read/write possible via API.
- Staff cannot access out-of-org users even with guessed IDs.

### Track B: Auth and account lifecycle (must ship)

1. Hosted onboarding flow: invite/create account, forced password change, reset path.
2. Session hardening defaults for hosted mode.
3. Role model finalized: `job_seeker`, `staff`, `org_admin`, `platform_admin`.

Exit criteria:

- Non-technical org admin can onboard a user end-to-end.

### Track C: Data integration model (must ship)

1. DB-first operations (app is source of truth).
2. Sheets is optional import/export/backup per org.
3. Conflict-safe sync and clear status visibility.

Exit criteria:

- Org can run without daily operational dependency on Sheets.

### Track D: Hosted operations (must ship)

1. Backup/restore drill and runbook.
2. Error reporting + health surface for admins.
3. Budget/alerts/logging controls.

Exit criteria:

- Restore tested from a recent backup.
- Operational failure path is visible/actionable.

## Database platform decision for v2

- Default: **Turso/libSQL**
- See: [DB_PLATFORM_DECISION.md](./DB_PLATFORM_DECISION.md)

## Documentation changes required for v2 cut

1. README:
   - hosted-first onboarding only
   - local install moved to legacy section or separate doc
2. STAFF/ADMIN runbook:
   - explicit org lifecycle steps
3. Security checklist:
   - hosted runtime defaults and verification steps
4. RR handout:
   - user-only onboarding (no install steps)

## Release checklist (`v2.0.0`)

1. All Track A-D exit criteria met.
2. Smoke tests pass for:
   - org creation
   - user login/change-password
   - staff assignment and staff-posted job visibility
   - sync and backup flows
3. Docs updated and reviewed.
4. Tag release:
   - `git tag -a v2.0.0 -m "Hosted multi-tenant release"`
   - `git push origin v2.0.0`

## Post-v2 priorities

- OAuth/SSO expansion
- richer org analytics/reporting
- billing and subscription controls
