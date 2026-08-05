# Mobile API Contract — Spike

The mobile companion uses the hosted dashboard as its source of truth.

## Existing endpoints used by the prototype

### `GET /api/dashboard`

The app reads the `todayQueue` array. Each item may include `id`, `entityId`, `title`, `subtitle`, `reason`, `type`, `dueDate`, `route`, and `actionLabel`. The mobile decoder tolerates missing optional fields and keeps the queue usable when the hosted response evolves.

### `GET /api/pipeline`

The app reads the existing pipeline array. Current field names are preserved (`Company`, `Role`, `Stage`, `Follow-Up`) and decoded into native properties.

### `POST /api/pipeline`

The prototype sends the existing pipeline field names plus `Location`, `Notes`, and `Skills`. It also sends an `X-Mobile-Mutation-ID` header. The backend does not yet persist or deduplicate this header; that is the next server ticket before offline retry is enabled.

## Required before pilot

- Add a mobile authentication boundary that can safely store a revocable credential in Keychain. Do not put long-lived credentials in UserDefaults.
- Persist `X-Mobile-Mutation-ID` with the created entity and return the original result for retries.
- Add a version or updated-at value to mutable records and reject stale offline writes rather than silently overwriting newer data.
- Add a mobile-origin audit marker to canonical mutations.
- Replace the placeholder `JobHuntAPI.live` base URL through build configuration, never source code changes per environment.
