## Release Guide

## Goal

Ship a stable **hosted** release where end users sign in to a running service and do not perform local installation.

## Active Release Target

- Version: `v2.0.0`
- Primary model: hosted server/client app
- User onboarding: admin-created/invited accounts
- Local Docker path: legacy/dev/recovery only

## v2 planning docs

- Hosted release plan: [HOSTED_V2_RELEASE_PLAN.md](./HOSTED_V2_RELEASE_PLAN.md)
- Platform shift context: [RR_PLATFORM_RELEASE_PLAN.md](./RR_PLATFORM_RELEASE_PLAN.md)
- DB platform decision (Turso vs Cloud SQL): [DB_PLATFORM_DECISION.md](./DB_PLATFORM_DECISION.md)

## Current Product State

Shipped and active:

- Multi-user role model (`job_seeker`, `staff`, `admin`)
- Assignment-scoped staff access
- Staff Ops workspace:
  - recommendations + post-to-pipeline
  - optional inbox notification on recommendation post
  - candidate threads/messages
  - candidate support summary signals
  - staff tasks and quick attention flags
- Member Inbox view for candidate-visible staff support threads
- Audit log coverage for staff/admin actions

Recently shipped (May 2026):

- Pipeline source filtering (including missing/custom source cleanup modes)
- Saved Pipeline views
- Bulk Pipeline date updates
- Briefing source performance metrics
- Source-level Sheets sync observability + warning counters
- Settings quick-actions to jump directly into Pipeline source cleanup

## Pre-Release Checklist (v2)

1. Validate tenant isolation and role scoping in API + UI.
2. Validate hosted account lifecycle:
   - admin creates/invites user
   - user logs in and changes password
3. Validate core API flows (pipeline, contacts, interviews, events, templates, watchlist, daily).
4. Validate hosted docs:
   - README hosted onboarding
   - staff/admin runbook
   - security checklist
   - README badge row (status/release values)
5. Validate sync and backup operational paths.
6. Confirm changelog is updated.
7. Confirm roadmap issue tracker is updated:
   - `docs/COMMAND_CENTER_ROADMAP.md` open issue table
   - screenshot checklist status

## Cut Release (v2)

```bash
git tag -a v2.0.0 -m "Hosted multi-tenant release"
git push origin v2.0.0
```

Create a GitHub Release with:

- Title: `v2.0.0`
- Notes summary:
  - hosted server/client onboarding model
  - multi-tenant org/user role boundaries
  - DB-first operations with optional Sheets integration
  - Turso as v2 default DB platform

## Recommended User-Facing Release Notes

- “Your org gets accounts and role-based access.”
- “No local install required for end users.”
- “Data is managed in-app as source of truth.”
- “Google Sheets is optional integration/backup.”
