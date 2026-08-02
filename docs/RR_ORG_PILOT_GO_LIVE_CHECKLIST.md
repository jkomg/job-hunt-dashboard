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
   - Confirm the feature profile matches the deployment: Sheets, Gmail, and backup are enabled only when their secrets and schedulers are configured.

## Evidence from local verification
- `npm run build` passes.
- `npm run smoke:test` passes health-profile, forced-password-change, onboarding completion, org-admin permissions, cross-user isolation, staff assignment/audit, sync error visibility, and backup export/restore checks.
- The local restore drill proves a post-backup record is removed while a pre-backup record is preserved.
- This does not substitute for the hosted drill below; Cloud Storage export and Cloud Run restore still require pilot-environment credentials and an operator.

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

## Hosted backup/restore drill (required before pilot users)
1. Confirm `ENABLE_BACKUP_EXPORT=true` on the intended Cloud Run revision.
2. Confirm the backup bucket, lifecycle policy, Secret Manager bindings, and `job-hunt-daily-backup-export` scheduler job.
3. Run the scheduler job once and verify a new JSON object appears in the expected bucket/prefix.
4. Download the JSON into a non-production operator workspace.
5. Restore it through `Operations` -> `Backup & Restore` in a disposable/non-production database or revision.
6. Verify a known pre-backup pipeline record exists and a post-backup test record does not.
7. Record timestamp, revision, bucket object, operator, and result in the pilot runbook.
