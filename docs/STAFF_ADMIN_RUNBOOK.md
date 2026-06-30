# Staff + Admin Runbook

## Purpose
Operational guide for staff and admins using hosted Job Hunt Dashboard environments.

## Roles
- `accelerator_user`: candidate workflow; baseline weekly posting target.
- `premium_user`: candidate workflow; elevated weekly posting target.
- `vip_user`: candidate workflow; highest weekly posting target.
- `job_seeker` (legacy): supported for backward compatibility.
- `staff`: assigned-candidate support workflows.
- `admin`: all staff workflows plus user/assignment/audit administration.

## Daily Staff Workflow
1. Open `Today` and choose a focus action:
  - review queue
  - post jobs
  - clear tasks/threads
2. Open `Operations` and process in order:
  - `Queue` tab:
  - **Candidate overview table**: scan all candidates; signal badges (`Interview`, `Stale`, `Inactive 7d`, `RR 72h`) surface urgent cases; use the signal filter dropdown to focus
  - **"Working on" context bar**: select a candidate to scope all cards below
  - **Candidate summary**: verify check-in recency, queue size, stale totals, and signals
  - `Jobs` tab:
  - **Research & Recommend** card: draft then post vetted recommendations to candidate pipelines
    - keep `Notify candidate in Inbox when posting` enabled unless you intentionally do silent posting
  - `Support` tab:
  - **Tasks** card: complete overdue/high-priority items first (default filter: open tasks)
  - **Threads** card: reply or triage open conversations (default filter: open threads)
3. Close completed threads and mark tasks done.

## Daily Admin Workflow
1. Check top-level admin nav:
   - `User Management`
   - `Assignments`
   - `Operations` (audit, sync health, scheduler/cost, backups)
2. Rebalance caseload:
   - use Staff Ops task reassignment
   - verify assignment coverage for all active candidates
3. Review stale queue:
   - stale tasks
   - stale threads (48h+)

## Weekly Cost Review (Admin/Platform)
1. Run:
   - `npm run ops:cost:snapshot`
2. Confirm:
   - Cloud Run min/max instances are still in expected range
   - Scheduler job count matches intended automation set
   - Artifact Registry image count is not growing unexpectedly
   - Logging exclusions are still present
3. If cost spikes:
   - run `scripts/setup-cloud-cost-controls.sh` again
   - verify release/deploy frequency and image cleanup policy
   - review recent automation additions and Cloud Run scaling settings

## User + Access Management

### Admin path (Settings)
1. `User Management`: create users with role (`accelerator_user`, `premium_user`, `vip_user`, `staff`, `admin`; `job_seeker` legacy) and set temporary password
2. `Assignments`: assign each candidate to a staff/admin owner
3. `User Management`: enable/disable BYO agent access per user (`Enable BYO Agent` / `Disable BYO Agent`)
4. Verify with `Assigned Users` view under staff accounts.

### Staff path (Operations)
- Staff can create new candidate accounts directly from Operations; the account is auto-assigned to them (defaults to `accelerator_user`).
- Staff can self-assign to existing unassigned candidates via the unassigned picker.

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
- Confirm candidate role is one of `accelerator_user`, `premium_user`, `vip_user` (or legacy `job_seeker`).

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
