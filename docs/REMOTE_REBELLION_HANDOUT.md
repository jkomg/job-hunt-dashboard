# Remote Rebellion Job Hunt Dashboard

Hosted usage guide for job seekers, staff, and admins.

## What Changed

This guide now assumes a hosted deployment where:

- users are given accounts by admin
- users sign in to a shared URL
- roles control what each person can do

Local install is now fallback/recovery only.

## Access Model

- `job_seeker`: manages own job search workflow
- `staff`: supports assigned candidates in Staff Ops
- `admin`: admin workspace for user/access/integration/ops controls

## First-Time Admin Setup

1. Sign in as admin at hosted URL.
2. Open `Settings` -> `User Management` and create users.
3. Assign roles (`job_seeker`, `staff`, `admin`).
4. Set/reset temporary passwords as needed and force reset where appropriate.
5. Open `Settings` -> `Staff Assignments` and map job seekers to staff owners.
6. Confirm staff can see assigned candidates in `Staff Ops`.

## First-Time User Setup (Job Seeker)

1. Open hosted URL.
2. Sign in with temporary credentials.
3. Change password when prompted.
4. Complete setup wizard (display name, username, optional sync settings).
5. Start from `Briefing` each day.

## First-Time Staff Setup

1. Open hosted URL.
2. Sign in with temporary credentials.
3. Change password when prompted.
4. Open `Staff Ops` and verify candidate list.
5. In `Settings` -> `Assigned Users`, verify you can reset password for assigned job-seekers.

## Daily Job Seeker Workflow

1. Open `Briefing` and work top queue items.
2. Update pipeline/contact/interview records with:
   - `Next Action`
   - `Next Action Date`
3. Check `Inbox` for staff support threads.
4. End day in `Daily Check-in`.

## Daily Staff Workflow

1. Open `Staff Ops` and filter candidates by need:
   - interview active
   - stale follow-ups
   - no recent activity (7d+)
   - new RR jobs (72h)
2. Review candidate support summary.
3. Add recommendations in `Job Research`.
4. Post in `Distribution`.
5. Leave `Notify candidate in Inbox when posting` enabled unless intentionally silent.
6. Use tasks and quick flags:
   - `Flag Follow-up`
   - `Flag Interview Prep`
7. Manage candidate threads:
   - `shared_with_candidate` for candidate-visible content
   - `internal_staff` for internal operations

## Optional Google Sheets Integration

Use when RR wants backup/reporting or transitional import/export.

In app `Settings`:

- set sheet ID and tab mappings
- run `Test Connection`
- run `Run Sync Now`
- monitor sync health/details
- download sync logs CSV on errors

Common errors:

- `MISSING_SHEET_ID`: add sheet ID
- `MISSING_CREDENTIALS`: provide service account JSON
- `SHEET_PERMISSION_DENIED`: share sheet with service account as Editor
- `TAB_NOT_FOUND`: fix tab names

## Local Reinstall (Mac/Linux Only, Fallback)

Use this if you need a local recovery/testing environment.

```bash
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

App URL: `http://localhost:8080`

## Where To Get Help

- Main guide: `README.md`
- Staff/admin runbook: `docs/STAFF_ADMIN_RUNBOOK.md`
- Security checklist: `docs/SECURITY_CHECKLIST.md`

## Screenshot Checklist

Use `docs/images/install/SHOT_LIST.md` for required captures.
Use `docs/WORKFLOW_GUIDES_AND_SCREENSHOTS.md` for role-based workflow capture order.
