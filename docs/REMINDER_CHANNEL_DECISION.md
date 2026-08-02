# Reminder channel decision

Status: proposed for v2 planning

## Decision

Start with an opt-in, user-configured daily email digest for due follow-ups and upcoming interviews. Keep calendar export as the next channel. Defer push notifications and automatic Gmail sending until measured usage shows they are needed.

## Why this fits the product

- Email reaches solo job seekers without requiring a mobile app or browser permission.
- A digest preserves the daily command-center habit instead of creating noisy per-item alerts.
- Opt-in delivery and a quiet-hours preference make consent explicit.
- Calendar export is useful for interviews and has low ongoing platform cost once generated.
- Push and Gmail automation add permission, deliverability, token, and support complexity before we know demand.

## Guardrails

- No outbound reminder is sent unless the user enables it and confirms a destination.
- Store the user's timezone, delivery window, channel, and last-send status.
- Send at most one digest per user per configured day; skip empty digests.
- Keep reminder content to links, dates, company/role or contact names, and the user's own next action. Do not include private notes or message bodies.
- Record delivery attempts and failures without blocking the core app.
- Organization staff must not receive a candidate's reminders unless the candidate has opted in or the organization policy explicitly permits it.

## Cost and rollout

Use the existing scheduler only when the reminder profile is enabled. Begin with a low-volume provider or platform SMTP option and set a monthly send cap. Measure opt-in rate, delivery failures, click-through to Briefing, and follow-up resolution before adding per-event notifications.

This decision intentionally does not enable email sending in this change. The implementation issue must first add preferences, consent UX, timezone handling, an idempotent send log, and a dry-run preview.
