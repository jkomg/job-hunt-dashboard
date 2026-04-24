# Security Checklist (Self-Hosters)

Use this before exposing Job Hunt Dashboard beyond local-only use.

## Required before public access

- Use `AUTH_MODE=iap` for Cloud Run deployments.
- Restrict IAP access to approved Google accounts/groups only.
- Set strong secrets in environment:
  - `SESSION_SECRET` (long random value)
  - `SHEETS_SYNC_CRON_TOKEN` (if scheduler is enabled)
  - `BACKUP_EXPORT_CRON_TOKEN` (if backup scheduler is enabled)
  - OAuth client secrets (if Gmail import is enabled)
- Keep default login temporary only:
  - first sign-in is forced to change password
  - remove shared default credentials from team docs after onboarding
- Use HTTPS only on all public endpoints/domains.

## Access control

- Keep `ADMIN_EMAILS` minimal and explicit.
- Review admin users periodically.
- Remove access immediately for offboarded users.

## Data protection

- Run regular backups:
  - in-app `Export Backup` (JSON)
  - optional daily Cloud Scheduler export to GCS
  - keep at least one offline copy
- Never commit `.env`, credential JSON files, or exported backups.
- Rotate service-account/OAuth credentials if exposed.

## Google integrations

- Share Google Sheet only with required service-account email.
- Keep Google APIs limited to what is needed:
  - Google Sheets API
  - Gmail API only if Gmail import is used
- Use least-privilege OAuth scopes (current Gmail scope is read-only).

## Runtime hardening

- Keep dependencies patched (`npm audit`, dependency updates).
- Monitor logs for repeated auth/sync failures.
- Keep Cloud Run services private behind IAP; avoid unauthenticated access.
- Set sensible Cloud Run resource limits and min/max instances.

## Incident response

- If compromise is suspected:
  - rotate secrets (`SESSION_SECRET`, OAuth, service-account keys)
  - disable suspect accounts in IAP/admin list
  - restore from a known-good backup if data integrity is uncertain
  - review recent sync logs and Cloud logs for timeline
