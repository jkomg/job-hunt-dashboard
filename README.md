# Job Hunt Dashboard

A personal job search command center built with React, Node/Express, and Notion as the database. Tracks your pipeline, networking contacts, and daily activity — all synced to Notion so your data lives somewhere useful.

## Features

- **Morning Dashboard** — yesterday's Top 3 priorities, overdue follow-ups, active pipeline items, and weekly activity stats
- **Job Pipeline** — kanban board with drag-and-drop stage management across 8 stages (Researching → Offer/Closed)
- **Outreach & Contacts** — follow-up queue with overdue alerts, warmth tracking, and one-click mark-as-contacted
- **Daily Check-in** — EOD form tracking mindset, energy, activity numbers, exercise, cert progress, and tomorrow's Top 3
- Docker-ready for self-hosting

## Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **Database**: Notion (via official API) — all real data lives there
- **Auth**: SQLite + bcrypt sessions (httpOnly cookies)

## Setup

### 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the **Internal Integration Token**
3. Create three Notion databases (or duplicate the templates below) and share each with your integration

### 2. Notion Database Schemas

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
SESSION_SECRET=some-long-random-string
PORT=3001
```

To find a database ID: open the database in Notion, copy the URL — the ID is the 32-character string before the `?`.

### 4. Run

**Development:**
```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`. Default login: `jason` / `jobhunt2026` — change your password after first login.

**Production (Docker):**
```bash
docker compose up --build
```

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
