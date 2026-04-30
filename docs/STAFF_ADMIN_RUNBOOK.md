# Staff + Admin Runbook

## Purpose
Operational guide for staff and admins using hosted Job Hunt Dashboard environments.

## Roles
- `job_seeker`: personal dashboard and pipeline workflows.
- `staff`: assigned-candidate support workflows.
- `admin`: all staff workflows plus user/assignment/audit administration.

## Daily Staff Workflow
1. Open `Briefing` and review:
   - tasks todo / in progress
   - open candidate threads
   - stale thread counts (48h+)
2. Open `Staff Ops` and process in order:
   - `Tasks`: complete overdue/high-priority items first
   - `Candidate Threads`: reply or triage open conversations
   - `Distribution`: post vetted recommendations to candidate pipelines
3. Close completed threads and mark tasks done.

## Daily Admin Workflow
1. Check `Settings`:
   - Team Access
   - Staff Assignments
   - Audit Log
   - Sync Health / Sync Details
2. Rebalance caseload:
   - use Staff Ops task reassignment
   - verify assignment coverage for all active candidates
3. Review stale queue:
   - stale tasks
   - stale threads (48h+)

## User + Access Management
1. `Settings` -> `Team Access`:
   - create users with role (`job_seeker`, `staff`, `admin`)
   - set temporary password
2. `Settings` -> `Staff Assignments`:
   - assign each job seeker to a staff/admin owner
3. Verify with `Assigned Users` view under staff accounts.

## Staff Ops: Thread Rules
- `shared_with_candidate`: content safe for candidate visibility.
- `internal_staff`: internal operational discussion only.
- Close threads when resolved.
- Reopen threads when follow-up is required.

## Staff Ops: Task Rules
- Prefer task types:
  - `interview_prep`
  - `follow_up`
  - `research`
  - `admin`
- Use priority consistently:
  - `urgent`, `high`, `normal`, `low`
- Always set due dates for candidate-impacting tasks.

## Common Operational Issues

### Staff cannot see a candidate
- Confirm assignment exists in `Settings` -> `Staff Assignments`.
- Confirm candidate role is `job_seeker`.

### Staff cannot update a task
- Staff can edit only their assigned tasks.
- Admin can reassign and edit all staff tasks.

### Recommendation cannot post to pipeline
- If already posted, API blocks duplicate post intentionally.
- Check recommendation status in `Distribution`.

### Thread/message actions fail
- Verify staff assignment still exists for that candidate.
- Verify session is valid and role is `staff` or `admin`.

## Incident Checklist
1. Capture error message text and timestamp.
2. Export sync logs (if sync-related).
3. Check `Audit Log` for actor/action sequence.
4. Reproduce once in a private browser session.
5. Escalate with:
   - username
   - candidate username
   - action attempted
   - exact error text
