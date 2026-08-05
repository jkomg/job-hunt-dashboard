# Job Hunt Mobile — Native iPhone Companion Blueprint

Status: discovery kickoff  
Owner: Job Hunt Dashboard  
Primary platform: iPhone, SwiftUI  
Backend: existing hosted Job Hunt Dashboard API  
Decision horizon: validate a focused prototype before committing to a broader native client

## 1. Product thesis

Build a native iPhone companion for the high-frequency job-search loop:

> capture a job → understand the opportunity → choose the next action → do it → receive a useful reminder

The iPhone app should feel fast, private, and useful in short sessions. It should not duplicate the staff/admin operating system already present in the hosted dashboard.

The native app is a companion, not an immediate rewrite. The hosted dashboard remains the source of truth for accounts, organizations, staff workflows, integrations, backups, reporting, and administrative controls.

## 2. Prototype success criteria

The first prototype is successful if a job seeker can:

1. Sign in using the existing hosted account.
2. See the Today Queue and due follow-ups.
3. Share a job posting from Safari into the app.
4. Extract a draft company, role, URL, location, skills, and notes locally.
5. Review and confirm the extracted fields before saving.
6. Save the job to the existing Pipeline API.
7. Receive one useful next-action suggestion.
8. Create a local reminder without sending anything externally.
9. Recover gracefully when the device is offline or Apple Intelligence is unavailable.

Do not start with a complete feature port, billing, Gmail replacement, or staff/admin mobile console.

## 3. Proposed architecture

```text
                         ┌────────────────────────────┐
                         │ Existing hosted dashboard  │
                         │ Express + Turso/libSQL     │
                         │ Auth, orgs, staff, backups  │
                         └──────────────┬─────────────┘
                                        │ HTTPS API
                         ┌──────────────▼─────────────┐
                         │ Native iPhone companion     │
                         │ SwiftUI + Swift concurrency │
                         │                             │
                         │ Today Queue                 │
                         │ Share Sheet capture         │
                         │ Local cache + sync queue    │
                         │ Foundation Models          │
                         │ App Intents / Shortcuts    │
                         │ Notifications               │
                         └──────────────┬─────────────┘
                                        │ Optional system APIs
                         ┌──────────────▼─────────────┐
                         │ Apple platform services     │
                         │ EventKit / Reminders       │
                         │ App Intents / Spotlight     │
                         │ Foundation Models           │
                         └────────────────────────────┘
```

### Source-of-truth rules

- Hosted API/database: canonical account, organization, pipeline, contacts, interviews, staff notes, assignments, and audit data.
- iPhone local store: cache, drafts, model outputs awaiting confirmation, pending mutations, and local reminder state.
- Apple Foundation Models: assistive inference only; never silently mutate canonical records.
- Google Sheets: organization continuity, reporting, migration, and backup while RR still depends on it; never a direct mobile write target.

## 4. Sub-agent operating model

Use narrowly scoped sub-agents with explicit artifacts. Each sub-agent owns a question or deliverable, not an entire product area.

### Workstream A — Product and interaction design

Deliverables:

- one-page user journey for capture → confirm → save → act;
- five-screen wireframe: Today, Capture, Review, Job Detail, Next Action;
- accessibility and interruption notes;
- decision log for what belongs native-only versus hosted.

Constraints:

- optimize for one-handed use and sessions under two minutes;
- every generated result must have an obvious edit, confirm, or discard action;
- do not hide the original job URL or source text.

### Workstream B — iOS technical spike

Deliverables:

- Xcode/SwiftUI project skeleton;
- deployment target and supported-device policy;
- navigation, dependency injection, networking, local persistence, and test strategy;
- a working mocked Today Queue screen;
- performance baseline on at least one supported and one unsupported device profile.

Constraints:

- Swift concurrency and structured cancellation;
- no API keys embedded in the app;
- no direct database access from the app;
- feature-gate Foundation Models and provide a non-AI fallback.

### Workstream C — Foundation Models prototype

Deliverables:

- structured extraction type for job postings;
- availability handling for unsupported device, disabled Apple Intelligence, and model-not-ready states;
- prompt/version registry;
- golden test set of representative job postings;
- accuracy, latency, and correction-rate report.

Constraints:

- generated fields are drafts, not facts;
- preserve source text and confidence/needs-review metadata;
- use guided/structured generation where possible;
- do not use the on-device model for web research, current labor-market facts, or high-confidence salary claims.

### Workstream D — Backend/API and sync

Deliverables:

- read-only Today Queue endpoint or documented reuse of existing endpoints;
- idempotent pipeline-create/update requests;
- sync cursor or mutation ID strategy;
- conflict behavior for offline edits;
- API contract tests.

Constraints:

- enforce organization, user, role, and assignment scope server-side;
- reject duplicate mutations safely;
- do not broaden staff access because a mobile client exists;
- log mobile-originated mutations in the existing audit model where applicable.

### Workstream E — Apple integration decision

Deliverables:

- ADR comparing EventKit/Reminders, App Intents, Spotlight, CloudKit, and local notifications;
- recommendation for each integration;
- permission copy and denial/fallback behavior;
- privacy review of data leaving the app.

Default hypothesis:

- use local notifications first;
- use App Intents/Shortcuts for high-value actions;
- use EventKit only if calendar placement is clearly better than a reminder;
- do not move the organization data source to CloudKit during the pilot;
- keep Sheets behind the hosted backend until a real migration benefit is demonstrated.

### Workstream F — Security and privacy

Deliverables:

- mobile threat model;
- authentication/session storage design;
- keychain policy;
- offline-data retention and wipe behavior;
- logging/redaction review;
- abuse and lost-device scenarios.

Release gates:

- tokens stored only in Keychain, never UserDefaults;
- no job-search content in analytics by default;
- no raw resume, contact, or staff-note content in crash logs;
- biometric unlock may protect local access but must not replace server authorization;
- local model prompts must be minimized and user-visible when they contain sensitive text;
- logout revokes/clears local credentials and pending sensitive drafts according to policy;
- staff/admin views remain assignment- and organization-scoped.

### Workstream G — Cost and pricing efficiency

Deliverables:

- cost model for App Store distribution, backend requests, storage, notifications, and optional server-model calls;
- device-versus-server inference matrix;
- usage caps and instrumentation plan;
- pricing implications memo kept separate from public pricing copy.

Rules:

- prefer on-device inference for extraction, summarization, and next-action drafting;
- avoid per-event server LLM calls in the daily loop;
- do not add a paid Apple service merely because it is available;
- keep the existing Cloud Run/Turso architecture for the pilot unless measured traffic shows a need to change;
- measure cost per active job seeker and cost per successful captured job;
- defer subscription and entitlements until the pilot demonstrates recurring value.

### Workstream H — QA, performance, and reliability

Deliverables:

- offline/online test matrix;
- device and OS compatibility matrix;
- latency and battery baseline;
- UI automation for capture and confirmation;
- sync retry and conflict tests;
- TestFlight acceptance checklist.

Stop conditions:

- app blocks normal use when Apple Intelligence is unavailable;
- a generated result can be saved without user confirmation;
- offline changes can silently overwrite newer server data;
- the daily loop is slower or more tedious than the current web experience.

## 5. Check-in cadence

Every sub-agent reports in the same format:

```markdown
## Check-in — YYYY-MM-DD HH:MM TZ

### Completed
-

### Evidence
- files, tests, screenshots, benchmarks, or links

### Decisions
-

### Risks / blockers
-

### Next smallest step
-
```

Cadence:

- kickoff: agree on scope, owner, artifact, and stop condition;
- every working session: one compact check-in after the first meaningful artifact;
- daily while parallel work is active: reconcile decisions and conflicts;
- end of phase: integration review with evidence, not optimism;
- no sub-agent may silently change API contracts, security policy, pricing, or source-of-truth rules.

## 6. Integration decision matrix

| Capability | Initial recommendation | Why |
| --- | --- | --- |
| Authentication and org membership | Existing hosted API | Already owns tenant and role policy; avoids a second identity system |
| Pipeline and Today Queue | Existing hosted API + local cache | Preserves cross-platform source of truth while enabling speed/offline use |
| Job capture | iOS Share Sheet | Strong native entry point and lower friction than copy/paste |
| Extraction and summarization | Foundation Models when available | Private, low marginal cost, fast, and suitable for structured extraction |
| Complex research/current data | Existing/server-side integrations | On-device model is not the right source for current external facts |
| Reminders | Local notifications first | Lowest operational cost and simplest permission surface |
| Calendar | EventKit only after user testing | Adds permission and UX complexity; validate demand first |
| Siri/Shortcuts | App Intents after core loop works | High leverage once actions and entities are stable |
| Search/discovery | Spotlight later | Useful after entities and deep links are reliable |
| Google Sheets | Keep behind backend during pilot | RR continuity, backup, and reporting already depend on it |
| CloudKit | Do not adopt initially | Would create a second multi-tenant data model and complicate staff/web access |
| Gmail | Keep server-side | OAuth, sync, audit, and organization policy belong in the hosted layer |

## 7. Proposed project layout

```text
job-hunt-mobile/
├── JobHuntMobile.xcodeproj
├── JobHuntMobile/
│   ├── App/
│   ├── Features/
│   │   ├── Today/
│   │   ├── Capture/
│   │   ├── Pipeline/
│   │   ├── NextAction/
│   │   └── Settings/
│   ├── Domain/
│   ├── API/
│   ├── Persistence/
│   ├── Intelligence/
│   ├── Integrations/
│   ├── Security/
│   └── Resources/
├── JobHuntMobileTests/
├── JobHuntMobileUITests/
├── docs/
│   ├── ADR-001-source-of-truth.md
│   ├── ADR-002-apple-integrations.md
│   ├── SECURITY.md
│   ├── COST_MODEL.md
│   └── CHECKINS/
└── README.md
```

The mobile project should be a separate repository or sibling project initially. Share API contracts and test fixtures deliberately; do not share server implementation code through a fragile cross-platform dependency.

## 8. Phase plan

### Phase 0 — Architecture and feasibility

- confirm Apple platform/device assumptions;
- inventory existing API endpoints and gaps;
- build mocked Today Queue;
- run Foundation Models extraction experiment;
- choose local persistence and sync strategy;
- complete threat model and cost model.

Exit: a clickable or runnable capture-to-next-action prototype and a written go/no-go decision.

### Phase 1 — Thin native companion

- authentication;
- Today Queue;
- Share Sheet capture;
- review/confirm flow;
- pipeline save;
- local notification;
- offline cache and retry.

Exit: five pilot users can complete the core loop without consulting the web app.

### Phase 2 — Native advantage

- App Intents and Shortcuts;
- richer local suggestions;
- deep links from notifications;
- Spotlight entities;
- optional EventKit integration;
- performance and battery tuning.

Exit: native app produces a measurable improvement in return frequency, capture completion, or time-to-next-action.

### Phase 3 — Organization companion features

- only after user value is proven;
- assigned-candidate staff views;
- privacy-reviewed inbox actions;
- organization-specific workflows;
- no expansion without explicit role and audit tests.

## 9. Decisions to avoid prematurely

- Do not rewrite the hosted dashboard in Swift.
- Do not move the database to CloudKit before proving the multi-tenant model on mobile.
- Do not make Apple Intelligence a hard dependency.
- Do not expose global backups or organization-wide data to the mobile client.
- Do not add server LLM spend to compensate for an unvalidated UX.
- Do not launch public pricing for the mobile app before the Remote Rebellion pilot.

## 10. Initial decision log

| Decision | Default | Revisit when |
| --- | --- | --- |
| Native app scope | Job-seeker companion | Pilot users demonstrate demand for mobile staff workflows |
| Backend | Existing hosted API | Measured API latency/reliability blocks the daily loop |
| AI execution | On-device first, server fallback only when justified | Accuracy or context needs exceed the device model |
| Sheets | Retain behind backend | RR no longer needs Sheets continuity or a migration proves safer |
| CloudKit | Defer | A separate Apple-only product becomes strategically important |
| Billing | Defer | Pilot produces measurable recurring value and entitlement requirements |
| Notifications | Local first | Users need cross-device or organization-managed reminders |

## 11. First three tickets

1. **Create native project spike** — SwiftUI shell, mocked Today Queue, supported-device policy, and test target.
2. **Prototype job capture intelligence** — Share Sheet input, Foundation Models structured extraction, review screen, unavailable-model fallback.
3. **Define mobile API contract** — Today Queue read, idempotent pipeline create, sync/version fields, error semantics, and tenant-scope tests.

## References

- [Apple Foundation Models framework](https://developer.apple.com/documentation/FoundationModels/)
- [Meet the Foundation Models framework — WWDC25](https://developer.apple.com/videos/play/wwdc2025/286/)
- [SystemLanguageModel availability](https://developer.apple.com/documentation/FoundationModels/SystemLanguageModel)
- [Apple Foundation Models sample project](https://developer.apple.com/documentation/foundationmodels/adding-intelligent-app-features-with-generative-models)
- Existing hosted product context: `MEMORY.md`, `docs/HOSTED_V2_RELEASE_PLAN.md`, `docs/RR_ORG_PILOT_GO_LIVE_CHECKLIST.md`
