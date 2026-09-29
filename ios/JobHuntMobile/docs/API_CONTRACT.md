# Mobile API Contract — Spike

The mobile companion uses the hosted dashboard as its source of truth.

## Existing endpoints used by the prototype

### `POST /api/login`

The app sends `{ "username": "...", "password": "..." }` and stores only the returned `session` and `csrf_token` cookie values in Keychain. It sends both in a `Cookie` header for subsequent requests and echoes `csrf_token` as `X-CSRF-Token` on mutating requests.

### `POST /api/logout`

The app sends the session cookie and CSRF header, then clears all locally stored credentials whether the request succeeds or fails.

### `GET /api/dashboard`

The app reads the `todayQueue` array. Each item may include `id`, `entityId`, `title`, `subtitle`, `reason`, `type`, `dueDate`, `route`, and `actionLabel`. The mobile decoder tolerates missing optional fields and keeps the queue usable when the hosted response evolves.

### `GET /api/pipeline`

The app reads the existing pipeline array. Current field names are preserved (`Company`, `Role`, `Stage`, `Follow-Up`) and decoded into native properties.

### `POST /api/pipeline`

The prototype sends the existing pipeline field names plus `Location`, `Notes`, and `Skills`. It also sends an `X-Mobile-Mutation-ID` header. The backend does not yet persist or deduplicate this header; that is the next server ticket before offline retry is enabled.

## Required before pilot

- Validate login and logout against a deployed hosted account before TestFlight; no credentials belong in fixtures or source control.
- Persist `X-Mobile-Mutation-ID` with the created entity and return the original result for retries.
- Add a version or updated-at value to mutable records and reject stale offline writes rather than silently overwriting newer data.
- Add a mobile-origin audit marker to canonical mutations.
- Keep `JobHuntAPIBaseURL` in build configuration per environment, never source code changes per environment.
