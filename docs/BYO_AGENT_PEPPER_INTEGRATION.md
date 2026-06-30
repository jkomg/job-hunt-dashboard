# Pepper BYO Agent Integration

This guide maps your external Pepper workflow to Job Hunt Dashboard's BYO ingest endpoint.

## 1) Configure in Dashboard
1. Log in as the target user (job seeker or staff account).
2. Go to `Settings -> Operations -> Bring Your Own AI Agent`.
3. Set provider/label, enable ingest, click `Save Agent Settings`.
4. Click `Generate Token` (or `Rotate Token`) and store the token in your agent secret store.

## 2) Endpoint and Auth
- Endpoint: `POST /api/agents/ingest`
- Header: `x-agent-token: <token>`
- Content-Type: `application/json`

## 3) Payload Shape
Send an `entries` array with up to 25 leads per request.

```json
{
  "entries": [
    {
      "company": "Acme Health",
      "role": "Senior Customer Success Manager",
      "jobUrl": "https://jobs.example.com/acme-csm",
      "source": "LinkedIn",
      "notes": "Strong fit for enterprise CS + regulated healthcare accounts",
      "stage": "🔍 Researching"
    }
  ]
}
```

Supported fields:
- `company` (required)
- `role` (optional)
- `jobUrl` (optional)
- `source` (optional)
- `notes` (optional)
- `stage` (optional; defaults to `🔍 Researching`)

## 4) Dedupe Behavior
The ingest endpoint skips duplicates using:
- exact `jobUrl` match (preferred)
- fallback `company + role` match

Response includes:
- `createdCount`
- `skippedDuplicates`
- `createdIds`

## 5) Pepper Mapping Notes
From your Pepper markdown workflow:
- Keep Firecrawl/site search, sheet write, and email report in Pepper.
- Add a final API call step to this ingest endpoint using the same filtered lead set.
- Reuse Pepper's "Why it fits" sentence for `notes`.
- Pass original posting URL as `jobUrl` for strongest dedupe.

## 6) Suggested Pepper Post-Run API Step
After dedupe against your Google Sheet, send only net-new leads to dashboard ingest.
If your run finds >25 new leads, batch into multiple requests.
