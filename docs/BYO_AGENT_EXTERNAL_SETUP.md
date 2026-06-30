# BYO Agent External Setup (Claude + ChatGPT)

This guide explains how a customer can configure their own AI agent and connect it to Job Hunt Dashboard.

## What Job Hunt Dashboard Does

The dashboard does **not** host or run the agent. It only provides a secure ingest endpoint for job leads.

- You run your own agent (Claude, ChatGPT, Zapier, Make, script, etc.).
- The agent sends job leads to your dashboard account via API.

## Step 1: Prepare Dashboard Credentials

In Job Hunt Dashboard:
1. Go to `Settings -> Operations -> Bring Your Own AI Agent`.
2. Turn on `Enable ingest for this account`.
3. Click `Save Agent Settings`.
4. Click `Generate Token` and copy it immediately.

You will use:
- Ingest URL: `https://<your-dashboard-host>/api/agents/ingest`
- Header: `x-agent-token: <generated-token>`

## Step 2: Use This Request Format

Your external agent should send:

```http
POST /api/agents/ingest
x-agent-token: <YOUR_TOKEN>
Content-Type: application/json
```

```json
{
  "entries": [
    {
      "company": "Acme Health",
      "role": "Senior Customer Success Manager",
      "jobUrl": "https://jobs.example.com/acme-csm",
      "source": "LinkedIn",
      "notes": "Strong fit for enterprise CS + regulated accounts",
      "stage": "🔍 Researching"
    }
  ]
}
```

Notes:
- `company` is required.
- Max 25 entries per request.
- Dedupe is automatic (`jobUrl`, then `company+role`).

## Step 3A: Claude Setup (Prompt-Driven Agent)

In Claude, create or update your recurring job-search agent instructions and include:

1. Search and rank leads as desired.
2. Build a JSON array of new leads (`entries`).
3. Final step: call the ingest endpoint above with `x-agent-token`.
4. Store token as a secret; never hardcode in shared prompts.

Practical pattern:
- Keep your existing sheet/email workflow.
- After your own dedupe, send only net-new entries to dashboard ingest.

## Step 3B: ChatGPT Setup (Actions/Automation/Script)

Use any ChatGPT-compatible automation path that can make authenticated HTTP requests.

Required behavior:
1. Generate leads matching your criteria.
2. Map each lead to `company`, `role`, `jobUrl`, `source`, `notes`, optional `stage`.
3. POST to `/api/agents/ingest` with `x-agent-token`.
4. If more than 25 leads, split into batches.

## Step 4: Verify It Worked

Success response example:

```json
{
  "ok": true,
  "createdCount": 8,
  "skippedDuplicates": 3,
  "createdIds": ["..."]
}
```

Then confirm in the dashboard:
- Open `Pipeline` for that same user account.
- Confirm newly created rows are present.

## Troubleshooting

- `401 Missing agent token`: request header not set.
- `401 Invalid agent token`: token mismatch; rotate token and retry.
- `400 entries[] is required`: payload shape incorrect.
- `403 Agent user has no organization membership`: user/account setup issue.

## Security Rules

- Treat `x-agent-token` like a password.
- Rotate token immediately if exposed.
- Use one token per user account (already enforced by per-user settings).
