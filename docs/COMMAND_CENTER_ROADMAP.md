# Command Center Roadmap

This roadmap tracks the platform-level priorities separately from daily queue priorities.
For staff/admin product separation and implementation details, see `docs/STAFF_OPS_MVP_SPEC.md`.

## Scope and sequencing

Work order:
1. Reliability First
2. Data Trust + Sync Confidence
3. Onboarding + UX
4. Security + Safety
5. Distribution for non-technical users
6. Product polish

## Open Issue Tracker (Phase Alignment)

| Issue | Title | Phase | Status | Notes |
| --- | --- | --- | --- | --- |
| #83 | Phase 0: Hosted v2 platform baseline (DB + tenancy guardrails) | Phase 0 | In Progress | Tenant guards + role boundaries shipped; continue baseline closure items. |
| #42 | Phase 2: Remote Rebellion staff workspace | Phase 2 | In Progress | Staff briefing/operations/tasks/threads and assignment flow shipped; continue UX refinements. |
| #43 | Phase 3: DB-first RR integration and Sheets backup | Phase 3 | In Progress | DB-first sync, conflict safety, source observability and cleanup flow shipped. |
| #44 | Phase 4: Hosted production hardening | Phase 4 | In Progress | Cost controls + ops visibility started; continue production controls. |
| #45 | Phase 5: Command center product polish | Phase 5 | In Progress | Saved views, source filters, bulk actions, and briefing improvements underway. |
| #90 | Production readiness: dev/prod split and controlled deployment model | Cross-phase | Open | Not started in this cycle; planned after current usability/ops slices. |
| #91 | Admin Ops Dashboard: run/schedule/monitor platform jobs from UI | Cross-phase | Open | Next major ops feature (UI scheduling/monitoring). |

## 1) Reliability First (must-have)

- [x] Automated local backup export (JSON)
- [x] Restore/import flow
- [x] Add optional scheduled backup export job for cloud deploys
- [x] Add database file export option (`.db`) in admin tools
- [x] Add end-to-end smoke tests: install, login, save check-in, sync
- [x] Add versioned DB migration tracking table and migration runner

## 2) Onboarding + UX (must-have)

- [x] First-run wizard exists
- [x] Expand first-run wizard: username, optional Sheets connect, test connection in-flow
- [x] Empty-state templates added across major pages
- [x] Improve mobile ergonomics on dense forms and table-heavy screens
- [x] In-app help text on key fields (stage, follow-up, outcomes)

## 3) Data Trust + Sync Confidence (must-have)

- [x] Show “last saved locally” and “last synced to Google” separately in Settings
- [x] Add per-entity sync results summary card in dashboard
- [x] Add conflict-safe sync behavior before overwrite (local + sheet changed rows are skipped)
- [x] Add downloadable sync logs for support and troubleshooting
- [x] Add source-level sync observability (updated/mismatch/blank counters)
- [x] Add one-click cleanup workflow from Settings warnings to Pipeline source filters

## 4) Security + Safety (must-have if public)

- [x] API rate limiting in place
- [x] CSRF protection in session mode in place
- [x] Force-change-password support exists
- [x] Enforce force-change-password by default for all session-mode first users
- [x] Add `docs/SECURITY_CHECKLIST.md` for self-hosters

## 5) Distribution for non-technical users (high value)

- [x] Docker-first guided setup scripts for macOS/Linux/Windows
- [x] No-Git/ZIP install path documented
- [x] Add launcher shortcuts for desktop start/stop flows
- [x] Add explicit guided modes: “No Google sync” vs “With Google sync” in installer copy
- [ ] Add screenshot-rich walkthrough + short install video links in docs

## 6) Product polish (next)

- [ ] Undo for destructive edits
- [ ] Global search/filter across entities
- [ ] Weekly review report (auto-generated)
- [ ] Notifications/reminders (email/calendar)

## Current command-center status

- [x] Unified Today Queue with reasoned actions
- [x] 6-priority queue engine live
- [x] Interview readiness ranked above follow-ups
- [x] Next Action + Next Action Date across pipeline/contacts/interviews
- [x] Daily check-in auto-fill from Today Queue
- [x] Source sync warnings now deep-link to Pipeline cleanup views (job-seeker context)

## Recently Shipped (Latest Merges)

- `#101` Pipeline source filter.
- `#102` Saved Pipeline views.
- `#103` Pipeline bulk date actions.
- `#104` Source performance metrics in Briefing.
- `#105` Source-level sync observability/warnings.
- `#106` One-click source warning cleanup flow from Settings to Pipeline.

## Screenshot Checklist (Usability Docs)

| Screenshot | Path | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Settings source warnings + action buttons | `docs/images/settings-source-warnings.png` | Jason | Pending | Show mismatch/blank counts and both cleanup actions. |
| Pipeline filtered: missing source | `docs/images/pipeline-filter-missing-source.png` | Jason | Pending | Show `Source = Missing source` state. |
| Pipeline filtered: custom source values | `docs/images/pipeline-filter-custom-source.png` | Jason | Pending | Show `Source = Custom source values` state. |
| Pipeline saved views + source filter | `docs/images/pipeline-saved-views-and-source-filter.png` | Jason | Pending | Highlight saved view chips and source selector. |
| Pipeline bulk action panel | `docs/images/pipeline-bulk-actions.png` | Jason | Pending | Show multi-select + bulk date apply. |
- [x] Pipeline source filter (`all`, missing source, custom source, specific source)
- [x] Saved pipeline views for filter state (stage/source)
- [x] Bulk date actions for selected pipeline cards
- [x] Source performance briefing metrics (active/response/interview/offers by source)

## Usability Workflow Notes (May 2026)

- Source sync warnings now include direct fix actions in Settings:
  - `Fix Missing Sources` opens Pipeline with `Source = Missing source`
  - `Review Custom Sources` opens Pipeline with `Source = Custom source values`
- Recommended post-merge UAT checks:
  1. Trigger a sync run with at least one blank source and one custom source.
  2. Verify warning counts appear in Settings > Sync Status.
  3. Use both quick actions and confirm Pipeline filters load correctly.
  4. Update/fix affected cards, rerun sync, confirm warning reduction.

### Screenshot Placeholders

- `docs/images/settings-source-warnings.png`
  - Capture: Settings sync status warning block with action buttons.
- `docs/images/pipeline-filter-missing-source.png`
  - Capture: Pipeline filtered to missing sources.
- `docs/images/pipeline-filter-custom-source.png`
  - Capture: Pipeline filtered to custom source values.
