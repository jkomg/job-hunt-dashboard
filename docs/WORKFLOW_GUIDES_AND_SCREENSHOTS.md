# Workflow Guides + Screenshot Plan

Purpose: one place to capture role-based workflows and the exact screenshots needed for polished documentation.

## How to use this doc

1. Run each workflow step in a private browser tab.
2. Take screenshots at the marked points.
3. Save files to `docs/images/workflows/` using the exact filenames below.
4. After screenshots exist, link/embed them into `README.md` and `docs/REMOTE_REBELLION_HANDOUT.md`.

## Job Seeker Workflow

1. Sign in and complete forced password change (first login only).
2. Review `Briefing` and complete today’s top tasks.
3. Update a pipeline card (`Next Action`, `Next Action Date`, notes).
4. Review `Interviews` and `Events`.
5. Check `Inbox` for staff messages.
6. Complete daily check-in.

Screenshots:
- `jobseeker-briefing-queue.png` (Briefing with queue and top actions)
- `jobseeker-pipeline-card-edit.png` (open card editing next action/date/notes)
- `jobseeker-inbox-thread.png` (candidate-visible support thread)
- `jobseeker-checkin-save.png` (successful check-in save state)

## Staff Workflow

1. Sign in as staff.
2. Open `Operations` and filter candidate list by signal.
3. Pick candidate from “Working on”.
4. Add recommendation and post to pipeline (with notify enabled).
5. Add/update a task.
6. Reply in candidate thread.
7. In `Settings`, reset password for an assigned job-seeker.

Screenshots:
- `staff-operations-candidate-signals.png`
- `staff-recommendation-post.png`
- `staff-tasks-board.png`
- `staff-threads-visibility.png`
- `staff-settings-assigned-users-reset-password.png`

## Admin Workflow

1. Sign in as admin.
2. Open `Settings` quick-nav.
3. In `User Management`:
  - create user
  - change role for an existing user
  - force reset / reset password
4. Open `Staff Assignments` and assign a candidate.
5. Open `Admin Ops Status`:
  - verify scheduler coverage
  - verify deployment profile
6. Open sync and backup tools:
  - run sync now
  - export backup

Screenshots:
- `admin-settings-quick-nav.png`
- `admin-user-management-table-actions.png`
- `admin-staff-assignments.png`
- `admin-ops-scheduler-coverage.png`
- `admin-deployment-profile.png`
- `admin-sync-health.png`
- `admin-backup-tools.png`

## Sync Behavior Notes (must reflect in docs)

- App DB (Turso/libSQL) is source of truth.
- Google Sheets is integration/backup/reporting path.
- Interview sync now reuses placeholder/template rows first before appending.
- Conflict-safe behavior skips rows when sheet and app changed since last sync link.

## QA Capture Checklist

- Use one admin account, one staff account, one job-seeker account.
- Validate role-specific nav:
  - admin should not show staff operations nav pages.
  - staff should show operations/tasks/threads.
  - job-seeker should show personal workflow nav.
- For any failed state screenshot, also capture:
  - exact error text
  - Build Info (`frontend_bundle`, `server_deploy`, `auth_mode`)

