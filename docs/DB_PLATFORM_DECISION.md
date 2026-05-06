# Database Platform Decision (Hosted v2)

Date: 2026-05-06
Status: Proposed (default for v2)
Owner: Platform

## Decision

For v2 hosted rollout, keep **Turso/libSQL** as the primary production database.

Re-evaluate moving to Cloud SQL (Postgres) when one or more of these is true:

- sustained write volume regularly triggers Turso overages that exceed Cloud SQL TCO
- tenant-count and analytics/reporting complexity outgrow current query model
- compliance/security requirements require controls that are materially easier on Cloud SQL + VPC stack

## Why this is the right default now

- Lowest early-stage operational overhead for a small team.
- Fast to iterate while product and data model are still changing.
- Works with existing app and migration path already in this repo.
- Cost profile is generally favorable at low-to-moderate scale.

## Turso vs Cloud SQL (pragmatic comparison)

### Cost

- Turso:
  - Usually lower idle/minimum cost.
  - Usage-based costs can spike with high write rates/sync-heavy workflows.
- Cloud SQL:
  - Higher baseline cost even at low traffic.
  - More predictable for heavier steady workloads.

### Security and isolation

- Turso:
  - Strong default security posture and managed operations.
  - Isolation is still primarily enforced at app layer (as with Cloud SQL unless you add DB-level tenancy controls).
- Cloud SQL:
  - Easier to layer GCP-native controls (private IP, VPC, IAM patterns) in orgs already deep in GCP.
  - More knobs, but more operational burden.

### Reliability and operations

- Turso:
  - Simpler day-1 operations and lower maintenance overhead.
  - Less infra surface area to manage while the product is still finding fit.
- Cloud SQL:
  - Mature operational model for relational workloads.
  - More moving pieces: networking, backups, failover configs, connection management.

### Product velocity

- Turso:
  - Faster iteration now; minimal platform friction.
- Cloud SQL:
  - Better long-term fit if advanced analytics/joins/reporting and complex org-level controls dominate roadmap.

## Guardrails required regardless of platform

- Strict tenant scoping in every query (`organization_id` required in data access layer).
- Role-based authorization checks on every mutation/read.
- Audit logging for staff/admin actions.
- Backups + restore drills on schedule.
- Rate limiting and CSRF/session hardening in hosted mode.

## Decision triggers to move off Turso

Switch planning should start when any trigger persists for 2-4 weeks:

1. Cost trigger:
   - Turso monthly DB + sync cost crosses planned budget band and is materially above modeled Cloud SQL TCO.
2. Performance trigger:
   - repeated write-throttle or latency incidents after batching/retry improvements.
3. Compliance trigger:
   - org/customer requirements demand controls not practical in current setup.
4. Data/analytics trigger:
   - roadmap requires heavier relational reporting and cross-entity analytics that strain current architecture.

## Migration strategy (if/when needed)

- Keep SQL and repository patterns portable.
- Add dual-write shadow phase for critical entities.
- Validate parity with tenant-scoped reconciliation checks.
- Cut over org-by-org with rollback path.

## Pricing references

- Turso pricing: https://turso.tech/pricing
- Turso docs: https://docs.turso.tech/
- Cloud SQL pricing (GCP): https://cloud.google.com/sql/pricing
