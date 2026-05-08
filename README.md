# Job Hunt Dashboard

A hosted, multi-role job search command center for job seekers, staff, and admins.

![spec](https://img.shields.io/badge/spec-v0.1-4c4c4c)
![license](https://img.shields.io/badge/license-Apache%202.0-84b819)
![status](https://img.shields.io/badge/status-v2.0%20live-2dbd18)
![release](https://img.shields.io/badge/release-v2.0.0-e57235)


## Primary Usage Model (Hosted)

This project is now documented as a **server/client app** first:

- users do **not** install locally
- users receive an account from an admin
- users sign in to the hosted URL
- access and features are role-based (`job_seeker`, `staff`, `admin`)

## Core Capabilities

- Daily briefing + priority queue
- Pipeline, contacts, interviews, events, templates, watchlist
- Daily check-in and Top 3 planning
- Staff Ops workspace for assigned-candidate support
- Candidate messaging threads (`shared_with_candidate` / `internal_staff`)
- Staff tasks + one-click flags (`follow_up`, `interview_prep`)
- Optional Google Sheets sync and backup workflows

## Roles

### Job Seeker

- Uses Briefing, Pipeline, Outreach, Interviews, Events, Check-in
- Receives staff support via Inbox threads
- Maintains application status, notes, follow-ups, resume URL, cover letter

### Staff

- Works assigned candidates in `Staff Ops`
- Adds recommendations and posts them to candidate pipelines
- Optionally notifies candidate automatically in Inbox when posting
- Manages candidate threads and support tasks

### Admin

- Can do all staff actions
- Creates users and role assignments
- Manages staff assignments
- Reviews audit logs, sync health, and backups

## Hosted Onboarding

### 1) Admin bootstraps organization

1. Deploy app (Cloud Run or equivalent)
2. Sign in with admin account
3. Open `Settings` and create users
4. Assign each job seeker to a staff/admin owner

### 2) User onboarding

1. User opens hosted URL
2. Logs in with temporary credentials
3. Changes password on first login
4. Completes setup wizard (display name, username, optional sheet settings)

### 3) Staff onboarding

1. Staff opens hosted URL
2. Logs in and changes temporary password
3. Uses `Staff Ops` to work candidate queues

## Staff Ops Workflow

1. Use the candidate overview table to scan all assigned candidates at a glance
   - Signal badges: `Interview`, `Stale`, `Inactive 7d`, `RR 72h`
   - Use the signal filter dropdown to focus (`interview_active`, `stale_followups`, `no_recent_activity`, `rr_posted_recently`)
2. Select a candidate from the "Working on" context bar or the table
3. Review the candidate support summary (check-in recency, queue/stale counts, signals)
4. Draft and post recommendations in **Research & Recommend** (unified card)
   - Keep `Notify candidate in Inbox when posting` enabled for normal workflow
5. Use the separate **Tasks** and **Threads** cards to close support loops

### Creating candidates (staff)

Staff can create new `job_seeker` accounts directly from Staff Ops without going through Settings — the new account is automatically assigned to them. Staff can also self-assign to existing unassigned candidates.

## Google Sheets Sync (Optional)

Sheets are integration/backup, not source of truth.

All sync controls live in the **Google Sheets Sync** card in `Settings`:

- Save sheet ID + tab mapping
- Test connection, run sync now, check sheet mapping
- Health status + per-entity status (Pipeline, Networking, Interviews, Events) in one place
- Recent runs log (collapsible, with CSV download)

Pipeline sync writes: Company, Role, Job URL, Job Source, Found By, Stage, Follow-Up, Notes, Research Notes, Date Applied, Resume URL, Cover Letter. Closed entries are excluded from outbound export.

## Admin Operations

From `Settings`:

- Team access (create users/roles)
- Staff assignments
- Audit log
- Google Sheets Sync (health, details, config, recent runs — all one card)
- Backup export/restore

## Docs Index

- Staff + admin operations: `docs/STAFF_ADMIN_RUNBOOK.md`
- Staff product scope/spec: `docs/STAFF_OPS_MVP_SPEC.md`
- Hosted rollout plan: `docs/RR_PLATFORM_RELEASE_PLAN.md`
- Hosted user handout: `docs/REMOTE_REBELLION_HANDOUT.md`
- Security checklist: `docs/SECURITY_CHECKLIST.md`

## Local Reinstall / Self-Host (Secondary)

Use this only when you need local recovery, dev, or standalone mode.

### Mac/Linux Docker install

```bash
git clone https://github.com/jkomg/job-hunt-dashboard.git
cd job-hunt-dashboard
./scripts/start-local-docker.sh
```

Then open `http://localhost:8080`.

Local persistence:

- data is stored in `./data/app.db`
- survives restarts/reboots

## Optional Gmail Event Import

Configure OAuth env vars and use `Settings`:

- `Connect Gmail`
- `Import Events from Gmail`

## Screenshots

Screenshot capture checklist is in:

- `docs/images/install/SHOT_LIST.md`
