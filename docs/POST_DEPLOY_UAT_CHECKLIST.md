# Post-Deploy User Testing Checklist

Use this after any deploy that changes user-visible behavior.

## Goal
Catch regressions quickly in the live environment before users report them.

## When to run
- Any UI change
- Any auth/session/settings change
- Any sync/integration change
- Any pipeline/interview/briefing workflow change

## 1) Smoke and access
1. Open hosted URL in a private tab.
2. Login with an admin test account.
3. Confirm Settings loads without errors.
4. Confirm no stale bundle warning after refresh.

## 2) Core user journey (job seeker)
1. Login as a job seeker.
2. Create/update one pipeline entry.
3. Update one follow-up / next action.
4. Save one daily check-in.
5. Confirm Briefing reflects updates.

## 3) Staff/admin journey
1. Login as staff or admin.
2. Open Staff Ops.
3. Post one recommendation to pipeline.
4. Confirm candidate sees the update.
5. Confirm audit log entry exists.

## 4) Integrations and ops
1. Run Google Sheets sync once from Settings.
2. Confirm status updates without error.
3. Run Cost Snapshot Now (admin Settings).
4. Confirm latest cost snapshot appears.

## 5) Record result
- PASS/FAIL
- timestamp
- deploy revision
- failing step(s)
- screenshots for failures

## Stop-ship criteria
- Login/session failures
- Data save failures
- Cross-user data leakage
- Major sync failure with no recovery path

## Testing Cadence (start now)

- Per PR (before merge):
  1. `npm run build`
  2. `npm run smoke:test:tenant`
- Per merge to `main`:
  1. Deploy
  2. Run this checklist in hosted environment once
- Daily (while active development):
  1. One full admin pass
  2. One full job-seeker pass
- Weekly:
  1. Restore drill from latest backup JSON
  2. Validate scheduler jobs in Admin Ops Status
