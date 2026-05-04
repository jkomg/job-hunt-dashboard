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
  - **Candidate overview table**: scan all candidates; signal badges (`Interview`, `Stale`, `Inactive 7d`, `RR 72h`) surface urgent cases; use the signal filter dropdown to focus
  - **"Working on" context bar**: select a candidate to scope all cards below
  - **Candidate summary**: verify check-in recency, queue size, stale totals, and signals
  - **Tasks** card: complete overdue/high-priority items first (default filter: open tasks)
  - **Threads** card: reply or triage open conversations (default filter: open threads)
  - **Research & Recommend** card: draft then post vetted recommendations to candidate pipelines
    - keep `Notify candidate in Inbox when posting` enabled unless you intentionally do silent posting
3. Close completed threads and mark tasks done.

## Daily Admin Workflow
1. Check `Settings`:
   - Team Access
   - Staff Assignments
   - Audit Log
   - Google Sheets Sync (health + entity status in one card)
2. Rebalance caseload:
   - use Staff Ops task reassignment
   - verify assignment coverage for all active candidates
3. Review stale queue:
   - stale tasks
   - stale threads (48h+)

## User + Access Management

### Admin path (Settings)
1. `Settings` -> `Team Access`: create users with role (`job_seeker`, `staff`, `admin`) and set temporary password
2. `Settings` -> `Staff Assignments`: assign each job seeker to a staff/admin owner
3. Verify with `Assigned Users` view under staff accounts.

### Staff path (Staff Ops)
- Staff can create new `job_seeker` accounts directly from Staff Ops; the account is auto-assigned to them.
- Staff can self-assign to existing unassigned candidates via the Staff Ops unassigned picker.

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
- If posting succeeds but candidate was not messaged:
  - verify `Notify candidate in Inbox when posting` was enabled
  - check candidate threads for the auto-created post thread

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
