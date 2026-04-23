# Changelog

All notable changes to this project are documented in this file.

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
