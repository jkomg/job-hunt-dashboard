# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Public customer pitch page with interactive solo job-hunter and partner-program demos.
- Sanitized, reusable demo dataset shared by the landing preview and interactive demo.
- Real sanitized portfolio screenshot and branded social sharing card.
- Local QA personas for platform admin, organization manager, coach/staff, and job hunters.
- Pre-deploy production backup artifact and Cloud Run rollback-revision gate.

### Changed

- Admin navigation now separates candidate Portfolio work from technical System operations.
- Admin and staff onboarding, briefings, and operations copy are role-aware.
- Candidate operations show display names instead of QA usernames where available.
- Public demo role changes are shareable and work with browser Back/Forward navigation.

### Fixed

- Admin briefing actions now route into candidate operations instead of returning to the briefing.
- Demo actions now explain their read-only behavior instead of appearing broken.
- Sign-in dialog now supports Escape, focus containment, focus restoration, and background scroll locking.
- Restored missing navigation and guide icons.

## [1.0.0] - 2026-04-22

### Added

- Full Turso-backed data model for:
  - pipeline
  - contacts
  - interviews
  - events
  - templates
  - watchlist
  - daily logs
- Bi-directional Google Sheets sync support for:
  - pipeline tabs
  - contacts tabs
  - interviews tabs
  - events tabs
- Cloud Scheduler + IAP-safe internal sync endpoint for daily automated sync
- One-time migration script from legacy Notion data to Turso: `scripts/migrate-notion-to-turso.mjs`
- Local onboarding scripts:
  - `scripts/bootstrap-local.sh` (dev setup)
  - `scripts/start-local-docker.sh` (easy end-user Docker setup)

### Changed

- Runtime API now uses DB/Turso-backed operations for all app modules.
- Removed runtime requirement for Notion configuration and Notion secrets.
- Documentation rewritten for easy local Docker-first onboarding.
- Secret/deploy scripts updated for Turso/Sheets-first runtime.

### Fixed

- Dashboard yesterday Top 3 handling and daily-log date lookup reliability.
- Cache-control for API responses to reduce stale browser behavior.

---

Suggested tag: `v1.0.0`
