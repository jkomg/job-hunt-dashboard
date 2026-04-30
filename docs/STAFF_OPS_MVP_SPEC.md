# Staff Ops MVP Spec

## Goal
Define a clear staff/admin operating model that is distinct from the job-seeker experience while keeping wellness hooks for all users.

## Product Split
- Member Workspace (`job_seeker`): personal job hunt command center.
- Staff Ops Console (`staff` and `admin`): candidate support, job distribution, operations.

## Core Principles
- Staff workflows are queue-based and assignment-based.
- Admins can do staff actions plus org/user management.
- Job seeker data visibility is scoped to assignment or explicit org-level policy.
- Auditability is mandatory for actions that affect candidates.

## Role UX

### Job Seeker
- Keep current sections: Briefing, Check-in, Pipeline, Outreach, Interviews, Events, Templates, Watchlist, Settings.
- Keep wellness and reflection features.

### Staff
- Primary nav:
  - Briefing (staff queue summary)
  - Candidates
  - Job Research
  - Distribution
  - Messages
  - Settings
- No personal job-seeker pipeline workflow by default.

### Admin
- All staff capabilities plus:
  - Team Access
  - Staff Assignments
  - Audit Log
  - Integrations/Sync Health

## Staff MVP Jobs-To-Be-Done
1. Research jobs for candidates.
2. Post jobs to applicable users.
3. Respond to candidate comments/questions.
4. Track and resolve support/admin tasks.

## Staff Data Model Additions

### `job_recommendations`
- `id`
- `organization_id`
- `staff_user_id`
- `job_seeker_user_id`
- `company`
- `role`
- `job_url`
- `source`
- `fit_note`
- `status` (`draft`, `posted`, `applied`, `dismissed`)
- `created_at`, `updated_at`

### `candidate_threads`
- `id`
- `organization_id`
- `job_seeker_user_id`
- `created_by_user_id`
- `topic`
- `status` (`open`, `closed`)
- `created_at`, `updated_at`

### `candidate_messages`
- `id`
- `thread_id`
- `organization_id`
- `author_user_id`
- `visibility` (`shared_with_candidate`, `internal_staff`)
- `body`
- `created_at`

### `staff_tasks`
- `id`
- `organization_id`
- `assignee_user_id`
- `related_user_id` (candidate)
- `type` (`research`, `follow_up`, `interview_prep`, `admin`)
- `priority` (`low`, `normal`, `high`, `urgent`)
- `status` (`todo`, `in_progress`, `done`)
- `due_at`
- `notes`
- `created_by_user_id`
- `created_at`, `updated_at`

## API Surface (Phase 1)
- `GET /api/staff/queue`
- `GET /api/staff/candidates`
- `GET /api/staff/candidates/:id/recommendations`
- `POST /api/staff/candidates/:id/recommendations`
- `PATCH /api/staff/recommendations/:id`
- `POST /api/staff/recommendations/:id/post-to-pipeline`
- `GET /api/staff/candidates/:id/threads`
- `POST /api/staff/candidates/:id/threads`
- `POST /api/staff/threads/:id/messages`
- `GET /api/staff/tasks`
- `POST /api/staff/tasks`
- `PATCH /api/staff/tasks/:id`

All staff endpoints require staff/admin role and assignment/org scope checks.

## Candidate Briefing Synergy Rules
- Interview-prep tasks rank above follow-up tasks.
- Due/overdue interview prep appears in both candidate and staff briefing queues.
- Posted recommendations that are untouched after N days are escalated in staff queue.

## Circle.so Integration Stance
- Phase 1: no direct Circle integration.
- Phase 2: optional connector for:
  - ingesting staff prompts/comments into `candidate_threads`
  - writing back status markers

Fallback in all phases: use in-app messages as source of truth and optionally mirror to external systems.

## Google Sheet Interaction Stance
- App DB remains source of truth.
- Sheet sync is integration/backup/reporting path, not primary state engine.
- Staff actions always write DB first; sync layer propagates outward.

## Additional Admin Tasks (Suggested)
1. Caseload balancing (staff-to-candidate distribution).
2. SLA tracking (time to staff response).
3. Sync failure triage queue.
4. User lifecycle controls (reset password, disable account, role changes).
5. Monthly outcomes reporting (applications, interviews, offers).

## Phase Plan

### Phase A (1-2 sprints): Staff Ops Foundation
- Add `job_recommendations`, `candidate_threads`, `candidate_messages`, `staff_tasks`.
- Build staff queue + candidate list + recommendation posting.
- Add audit events for all new staff/admin actions.

### Phase B (1 sprint): Messaging + Visibility
- Add in-app candidate/staff threads.
- Add admin oversight for unresolved high-priority threads/tasks.
- Add “last contact” and SLA metrics.

### Phase C (1 sprint): Integrations
- Add optional Circle import/export adapter.
- Extend Google sync mappings for recommendation and status mirror fields.

## Interview Script For Staff Discovery
1. What actions do you take daily for candidates?
2. Which actions are highest urgency?
3. What currently falls through cracks?
4. What information do you need before recommending a job?
5. Which alerts would prevent misses?
6. What should never be visible to candidates?
7. What should always be visible to candidates?
8. Which tasks should be automated first?

## Definition Of Done For MVP
- Staff can research and post jobs to assigned candidates in-app.
- Staff can communicate with candidates in-app.
- Admin can manage assignments and observe actions in audit logs.
- Candidate and staff queue priorities reflect interview-prep-first scoring.
- No cross-candidate data leakage across assignment boundaries.
