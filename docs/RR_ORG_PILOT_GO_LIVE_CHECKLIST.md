# Remote Rebellion Org Pilot Go-Live Checklist

## Scope
- Pilot objective: run production-like multi-org controls with `organization_id` boundaries enforced.
- Current pilot org id: `remote-rebellion` (default).

## Preflight
1. Confirm PRs for Wave 1 and Wave 2 are merged to `main`.
2. Run local verification:
   - `npm run build`
   - `npm run smoke:test`
3. Confirm auth mode:
   - `/api/health` returns `authMode=session` (or intended mode for pilot).

## Bootstrap
1. Seed/verify pilot organization and memberships:
   - `npm run pilot:bootstrap:rr`
2. Optional targeted bootstrap:
   - `PILOT_USERNAMES=\"jkadmin,jason\" npm run pilot:bootstrap:rr`
3. Verify output JSON:
   - `ok=true`
   - expected `organizationId`
   - expected `membershipCount`

## Admin Setup in App
1. Open `User Management`:
   - verify org list includes pilot org
   - create any additional orgs needed for testing
2. Assign memberships:
   - assign staff/job seeker/admin roles per org
3. Open `Assignments`:
   - confirm staff-to-candidate mappings only within intended org

## Security/Isolation Checks
1. Login user without org membership -> expect `ORG_MEMBERSHIP_REQUIRED`.
2. Confirm `/api/me` contains expected `organizationId`.
3. Confirm sync status/logs only show org-scoped runs for current user org.
4. Confirm Gmail connection state is org-specific.

## Pilot UAT
1. Job seeker:
   - create/update pipeline, contacts, events
2. Staff:
   - assigned candidates only
   - thread and task access scoped
3. Admin:
   - user management, memberships, assignments
   - audit logs for membership/org actions

## Rollback
1. Revert to previous revision in Cloud Run if needed.
2. Pause pilot account onboarding.
3. Export backup before data surgery:
   - `Operations` -> `Backup & Restore` -> `Export Backup`
