# Command Center Roadmap

This roadmap tracks the platform-level priorities separately from daily queue priorities.

## Scope and sequencing

Work order:
1. Reliability First
2. Data Trust + Sync Confidence
3. Onboarding + UX
4. Security + Safety
5. Distribution for non-technical users
6. Product polish

## 1) Reliability First (must-have)

- [x] Automated local backup export (JSON)
- [x] Restore/import flow
- [x] Add optional scheduled backup export job for cloud deploys
- [x] Add database file export option (`.db`) in admin tools
- [ ] Add end-to-end smoke tests: install, login, save check-in, sync
- [x] Add versioned DB migration tracking table and migration runner

## 2) Onboarding + UX (must-have)

- [x] First-run wizard exists
- [x] Expand first-run wizard: username, optional Sheets connect, test connection in-flow
- [x] Empty-state templates added across major pages
- [ ] Improve mobile ergonomics on dense forms and table-heavy screens
- [x] In-app help text on key fields (stage, follow-up, outcomes)

## 3) Data Trust + Sync Confidence (must-have)

- [x] Show “last saved locally” and “last synced to Google” separately in Settings
- [ ] Add per-entity sync results summary card in dashboard
- [x] Add conflict-safe sync behavior before overwrite (local + sheet changed rows are skipped)
- [x] Add downloadable sync logs for support and troubleshooting

## 4) Security + Safety (must-have if public)

- [x] API rate limiting in place
- [x] CSRF protection in session mode in place
- [x] Force-change-password support exists
- [x] Enforce force-change-password by default for all session-mode first users
- [x] Add `docs/SECURITY_CHECKLIST.md` for self-hosters

## 5) Distribution for non-technical users (high value)

- [x] Docker-first guided setup scripts for macOS/Linux/Windows
- [x] No-Git/ZIP install path documented
- [ ] Add launcher shortcuts for desktop start/stop flows
- [ ] Add explicit guided modes: “No Google sync” vs “With Google sync” in installer copy
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
