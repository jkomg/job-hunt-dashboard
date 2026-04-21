# Job Hunt Dashboard

A personal job search command center built with React, Node/Express, Notion, and Turso-ready app persistence. Tracks your pipeline, networking contacts, and daily activity, with optional bi-directional Google Sheets sync.

## Features

- **Morning Dashboard** — yesterday's Top 3 priorities, overdue follow-ups, active pipeline items, and weekly activity stats
- **Job Pipeline** — kanban board with drag-and-drop stage management across 8 stages (Researching → Offer/Closed)
- **Outreach & Contacts** — follow-up queue with overdue alerts, warmth tracking, and one-click mark-as-contacted
- **Daily Check-in** — EOD form tracking mindset, energy, activity numbers, exercise, cert progress, and tomorrow's Top 3
- **Google Sheets Sync (bi-directional)** — pull opportunities from shared tabs and push app-owned status/follow-up/notes updates back
- Docker-ready for self-hosting

## Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **App Persistence**: Turso/libSQL (`DATABASE_URL`) with local file fallback for dev
- **Business Data Store**: Notion (via official API)
- **Auth**: DB-backed bcrypt sessions (httpOnly cookies) or Google IAP identity headers (`AUTH_MODE=iap`)

## Setup

### 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the **Internal Integration Token**
3. Create three Notion databases (or duplicate the templates below) and share each with your integration

### 2. Notion Database Schemas

Create four databases and share each with your integration.

**Job Pipeline** — Properties:
- `Company` (Title), `Role` (Text), `Stage` (Select), `Priority` (Select), `Sector` (Select)
- `Salary Range` (Text), `Job URL` (URL), `Date Applied` (Date), `Follow-Up Date` (Date)
- `Contact Name` (Text), `Contact Title` (Text), `Outreach Method` (Select), `Resume Version` (Select)
- `Company Address` (Text), `Company Phone` (Phone), `Notes` (Text), `Research Notes` (Text)
- `Filed for Unemployment` (Checkbox)

**Networking & Contacts** — Properties:
- `Name` (Title), `Title` (Text), `Company` (Text), `Email` (Email), `Phone` (Phone)
- `Warmth` (Select), `Status` (Select), `How We Know Each Other` (Select)
- `LinkedIn URL` (URL), `Next Follow-Up` (Date), `Last Contact` (Date)
- `Resume Used` (Text), `Notes` (Text)

**Interview Tracker** — Properties:
- `Company` (Title), `Job Title` (Text), `Date` (Date), `Round` (Select), `Format` (Select), `Outcome` (Select)
- `Interviewer` (Text), `Questions Asked` (Text), `Feedback Received` (Text), `Follow-Up Sent` (Checkbox), `Notes` (Text)

**Daily Action Log** — Properties:
- `Date` (Title), `Mindset (1-10)` (Number), `Energy (1-10)` (Number)
- `Outreach Sent` (Number), `Responses Received` (Number), `Applications Submitted` (Number), `Conversations / Calls` (Number)
- `LinkedIn Posts` (Checkbox), `Volunteer Activity` (Checkbox)
- `Exercise` (Select), `Cert Progress` (Select)
- `Win of the Day` (Text), `Gratitude / Reflection` (Text), `Tomorrow's Top 3` (Text)

### 3. Configure Environment

```bash
cp .env.example .env
```

Fill in your values:

```env
NOTION_TOKEN=your_notion_integration_token
NOTION_PIPELINE_DB=your_pipeline_database_id
NOTION_CONTACTS_DB=your_contacts_database_id
NOTION_DAILY_LOG_DB=your_daily_log_database_id
NOTION_INTERVIEWS_DB=your_interviews_database_id
NOTION_EVENTS_DB=your_events_database_id
NOTION_TEMPLATES_DB=your_templates_database_id
NOTION_WATCHLIST_DB=your_watchlist_database_id

DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token

GOOGLE_SHEETS_ID=your_google_sheet_id
GOOGLE_SHEETS_SYNC_TABS=Jobs & Applications,Found
GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account",...}

SESSION_SECRET=some-long-random-string
PORT=3001
AUTH_MODE=session
ADMIN_EMAILS=kennjason@gmail.com
```

To find a database ID: open the database in Notion, copy the URL — the ID is the 32-character string before the `?`.

### 4. Run

**Development:**
```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`. Default login: `jason` / `jobhunt2026` — change your password after first login.

Auth modes:
- `AUTH_MODE=session` (default): local username/password login form.
- `AUTH_MODE=iap`: trust Google IAP headers and auto-provision users by email.
- `AUTH_MODE=hybrid`: allow IAP first, fallback to local session login.

Admins:
- `ADMIN_EMAILS` is a comma-separated list of emails treated as app admins when logging in through IAP.

**Production (Docker):**
```bash
docker compose up --build
```

### 5. Run Sheets Sync

Manual sync endpoint (requires login cookie):

```bash
curl -X POST http://localhost:3001/api/sheets/sync \
  --cookie "session=YOUR_SESSION_COOKIE"
```

Recent run history:

```bash
curl http://localhost:3001/api/sheets/sync/runs \
  --cookie "session=YOUR_SESSION_COOKIE"
```

### 6. Cloud Run Deploy (Secrets-First)

```bash
# 1) sync .env values into Secret Manager
./setup-secrets.sh

# 2) build + push + deploy Cloud Run
./deploy.sh
```

To deploy with IAP mode and a specific admin email:

```bash
AUTH_MODE=iap ADMIN_EMAILS=kennjason@gmail.com ./deploy.sh
```

To configure HTTPS Load Balancer + IAP for `hunt.jkomg.us`:

```bash
chmod +x ./scripts/setup-iap-lb.sh
PROJECT_ID=job-hunt-dashboard-494012 \
DOMAIN=hunt.jkomg.us \
IAP_USER_EMAIL=kennjason@gmail.com \
./scripts/setup-iap-lb.sh
```

After script output, update DNS:
- remove CNAME for `hunt.jkomg.us`
- add `A` record pointing to the script's printed global LB IP

## Select Field Values

These must match exactly in your Notion database:

**Pipeline — Stage:** `🔍 Researching`, `📨 Applied`, `🤝 Warm Outreach Sent`, `💬 In Conversation`, `📞 Interview Scheduled`, `🎯 Interviewing`, `📋 Offer`, `❌ Closed`

**Pipeline — Priority:** `🔥 Top Target`, `⭐ Strong Fit`, `📌 Worth a Shot`

**Pipeline — Sector:** `Healthcare Tech`, `Climate / Clean Energy`, `AI/ML Platform`, `EdTech`, `Social Impact`, `Other`

**Pipeline — Outreach Method:** `LinkedIn DM`, `Email`, `Referral`, `Cold Application`, `Recruiter`

**Pipeline — Resume Version:** `CS General`, `Tailored`

**Contacts — Warmth:** `🔥 Hot — active convo`, `☀️ Warm — responded`, `❄️ Cold — no contact yet`

**Contacts — Status:** `Need to reach out`, `Waiting on response`, `In conversation`, `Referred me`, `Gone cold`

**Contacts — How We Know Each Other:** `Former IBM colleague`, `Former Blue Box`, `YearUp / Nonprofit`, `LinkedIn cold outreach`, `Event / Meetup`, `Referral`, `Recruiter`

**Daily — Exercise:** `🏃 Cardio/Run`, `🏋️ Weights/Strength`, `🧘 Yoga/Stretch`, `🚶 Walk`, `🏀 Sport/Activity`, `❌ Rest Day`

**Daily — Cert Progress:** `Gainsight`, `HubSpot Inbound`, `HubSpot CRM`, `SuccessHACKER`, `LinkedIn Learning`, `None today`

## License

MIT
