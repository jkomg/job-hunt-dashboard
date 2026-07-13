# Job Seeker UX Audit And Testing Plan

This document is a refreshed, common-sense audit of the current Job Hunt app from the perspective of a job seeker who has never used it before.

It is meant to help with:

- writing clearer instructions
- running a step-by-step usability walkthrough
- building repeatable testing personas
- identifying where the product is strong vs. where first-time users may get stuck

## Scope

This audit is based on the current hosted job seeker experience as represented in the app structure and components:

- `Briefing`
- `Check-in`
- `Pipeline`
- `Outreach`
- `Interviews`
- `Events`
- `Watchlist`
- `Inbox`
- `Templates`
- `Guides`
- `Settings`
- initial `SetupWizard`

## Executive Summary

The app already has the bones of a very usable job-search operating system.

The strongest parts are:

- a clear high-level navigation model for desktop job seekers
- a useful distinction between roles, people, interviews, and watchlist companies
- a strong daily habit loop between `Briefing` and `Check-in`
- support for more mature workflows like templates, staff support, and Google Sheets sync

The biggest first-time-user risks are:

- the app can feel "big" before the user understands what to do first
- some screens ask for many fields before users know which ones actually matter
- onboarding exposes optional complexity early
- a few terms and flows assume product familiarity
- some useful destinations may be harder to discover on smaller screens

The core product promise should be:

> "Open the app, know what matters today, update your search in one place, and avoid dropping follow-ups."

If instructions, onboarding, and testing all reinforce that promise, the product will feel simpler without losing capability.

## What A New User Is Trying To Accomplish

A first-time job seeker is usually trying to answer a short list of practical questions:

- Where do I start?
- What belongs in this app versus my email, notes, or spreadsheet?
- What should I update every day?
- Which screen do I use for jobs versus people?
- How do I know if I am "using it right"?

The product works best when those answers become obvious quickly:

- `Briefing` = what needs attention now
- `Check-in` = what I did today and what I will do tomorrow
- `Pipeline` = jobs and applications
- `Outreach` = people and follow-ups
- `Interviews` / `Events` / `Watchlist` = supporting systems
- `Inbox` = staff or program communication
- `Templates` = reusable outreach messages

## Usability Findings

## Strengths

### 1. The app has a clear mental model once the user understands the sections

The information architecture is pretty solid for desktop job seekers:

- `TODAY` for focus
- `SEARCH` for execution
- `COMMS` for support and reusable messages

That is a better structure than many job-search tools, which often blur jobs, networking, and daily habits together.

### 2. `Briefing` and `Check-in` create a real daily rhythm

This is one of the most valuable product ideas in the app.

- `Briefing` gives the user a reason to open the app
- `Check-in` gives the user a reason to come back and close the loop

That creates a helpful behavior pattern instead of turning the product into a passive database.

### 3. `Pipeline` and `Outreach` are separated correctly

That distinction matters:

- roles belong in `Pipeline`
- people belong in `Outreach`

This is a strong foundation and should stay central in all instructions.

### 4. The system supports both simple and advanced users

Users can stay light:

- company
- role
- stage
- next action
- follow-up date

Or go deeper:

- contacts
- resume versions
- research notes
- interview notes
- templates
- watchlist
- BYO agent
- Sheets sync

That range is a real strength as long as onboarding does not push advanced setup too early.

## Friction Points

### 1. First-time users may not know what "minimum viable usage" looks like

The app is capable, but users need a plain rule like:

- add your current jobs to `Pipeline`
- add your important people to `Outreach`
- open `Briefing` every morning
- do `Check-in` every evening

Without that, the product can feel like "a lot of fields" rather than "a daily system."

### 2. Setup includes optional Google Sheets complexity too early

The setup wizard is short overall, but the optional Sheets configuration introduces a lot of detail during the first-run experience:

- sheet ID
- multiple tab mappings
- connection testing
- service-account caveat

For many first-time job seekers, that is not a day-one task. It is useful, but it is not the first thing they need to succeed.

### 3. Some terminology is slightly out of sync

Example:

- setup guidance references `Today Queue`
- the product now centers the `Briefing` experience more explicitly

This is a small issue, but it creates micro-confusion during onboarding because it makes users wonder whether they missed something.

### 4. `Pipeline` is powerful, but the form is dense

This is likely the most important tradeoff in the product.

The screen is good for serious tracking, but a new user may not know:

- which fields are required
- which fields are optional
- which fields matter immediately
- which fields only matter later

If we test this with new users, I expect many people will hesitate before entering their first role.

### 5. `Outreach` is conceptually strong, but still asks users to classify too much upfront

Warmth, status, relationship source, next follow-up, next action, and resume used are all useful, but a new user may not have enough confidence to fill them cleanly on day one.

This does not mean the fields are wrong. It means our instructions should explicitly say:

- fill the basics first
- refine contacts after real conversations happen

### 6. Mobile discoverability is likely weaker than desktop discoverability

The mobile bottom nav only exposes:

- `Briefing`
- `Pipeline`
- `Outreach`
- `Inbox`
- `Settings`

That means a mobile-first user may not naturally discover:

- `Check-in`
- `Interviews`
- `Events`
- `Watchlist`
- `Templates`
- `Guides`

This is an important usability testing target because it could make the app feel smaller or more confusing on phones.

### 7. Some "helper" patterns may feel incomplete to a first-time user

Examples:

- `Quick jump` appears in the shell but does not currently feel like an active feature
- `Inbox` shows thread count, but unread emphasis is limited
- some powerful automation or support features are present, but their value only appears after the user has data in the system

None of these are deal-breakers, but they raise the importance of guided first-use instructions.

## Instruction Strategy

If we write user-facing instructions, they should not try to explain every feature first.

They should teach a progression:

### Stage 1: Start using the app

- finish setup
- add active jobs
- add important contacts
- learn the daily routine

### Stage 2: Use the app consistently

- update stages
- add follow-up dates
- track interviews
- save reusable templates

### Stage 3: Power-user features

- watchlist
- advanced notes
- Sheets sync
- BYO agent
- staff-supported workflows

That structure will reduce first-day overwhelm without hiding the long-term value.

## Recommended First-Time Walkthrough

This is the version I would use for instructions, demos, and manual testing.

### Step 1. Sign in and finish setup

Success looks like:

- user can log in
- user can set display name and username
- user understands that Sheets sync is optional

Watch for:

- confusion about whether Sheets is required
- hesitation around username rules
- uncertainty about what happens after setup

### Step 2. Land on `Briefing`

Ask the user:

- What do you think this page is for?
- If you had to start your day from here, what would you click first?

Success looks like:

- user understands this is the daily command center
- user can identify follow-ups, interviews, or other urgent items

Watch for:

- blank-state confusion
- uncertainty about where to go if nothing is populated yet

### Step 3. Add one job in `Pipeline`

Give the user a realistic scenario:

- "You found a Customer Success role at Acme and want to track it."

Success looks like:

- user can add a role without needing every field
- user understands stage, next action, and dates

Watch for:

- field overload
- uncertainty about the difference between `Follow-Up Date` and `Next Action Date`
- uncertainty about when to use `Researching` vs `Applied`

### Step 4. Add one person in `Outreach`

Scenario:

- "You connected with a recruiter or alum related to that role."

Success looks like:

- user understands this is for people, not applications
- user can set a realistic follow-up

Watch for:

- confusion between `Status`, `Warmth`, and `How We Know Each Other`
- uncertainty about how much to record after a first touchpoint

### Step 5. Log one interview or event

Success looks like:

- user can distinguish `Interviews` from `Events`
- user sees that follow-through, not just scheduling, is the point

Watch for:

- using `Events` for one-on-one conversations
- failing to add next actions after the event or interview

### Step 6. Complete `Check-in`

Ask the user to log the day and set tomorrow's Top 3.

Success looks like:

- user understands this is a daily habit, not just a mood tracker
- user writes specific Top 3 items

Watch for:

- vague entries like "job search"
- skipping reflection because the purpose is not obvious

### Step 7. Return to `Briefing`

Success looks like:

- user sees how prior actions feed the dashboard
- user understands the app is designed to get smarter as they update it

This is where the product story should click.

## Testing Personas

Use these personas for manual walkthroughs, UAT, script writing, and future onboarding work.

## Persona 1: The Overwhelmed Generalist

### Summary

A mid-career job seeker juggling many leads, too many browser tabs, and inconsistent follow-up habits.

### Profile

- 8 to 20 active opportunities
- some direct applications, some networking-led
- using spreadsheets, notes, email, and LinkedIn at the same time
- loses track of next steps

### Primary goals

- reduce mental clutter
- know what needs follow-up today
- avoid dropping warm leads

### Likely friction

- may feel overloaded by fields in `Pipeline`
- may avoid updating data unless instructions are very practical
- benefits most from `Briefing` plus `Check-in`

### Good test tasks

- add three active roles
- mark one as stale
- set next actions and due dates
- complete end-of-day check-in

## Persona 2: The Disciplined Spreadsheet User

### Summary

A structured user who already tracks everything somewhere else and wants to know whether this app is better than their existing system.

### Profile

- comfortable with data entry
- likely to care about consistency and reports
- may be curious about Sheets sync

### Primary goals

- decide whether the app is worth maintaining daily
- confirm that statuses and fields are useful
- preserve clean records

### Likely friction

- may compare every screen to a spreadsheet
- may want clearer definitions for fields and statuses
- may get distracted by optional integrations too early

### Good test tasks

- import or recreate five existing roles
- use `Watchlist`, `Templates`, and `Outreach`
- evaluate whether daily review is faster than their spreadsheet workflow

## Persona 3: The Networking-Heavy Career Switcher

### Summary

A user whose progress depends more on relationships and informational conversations than on cold applications.

### Profile

- fewer direct applications
- more alumni, referrals, and exploratory conversations
- still learning how to structure outreach follow-up

### Primary goals

- keep conversations organized
- remember who to follow up with and when
- connect people activity to role activity

### Likely friction

- may not know whether to start in `Pipeline` or `Outreach`
- may underuse `Watchlist`
- may treat `Pipeline` as only for formal applications

### Good test tasks

- add four networking contacts
- add two watchlist companies
- convert one watchlist company into a real pipeline role

## Persona 4: The Mobile-First User

### Summary

A user who checks the app from a phone between networking, interviews, and job-search sessions.

### Profile

- likely to use the app reactively
- wants quick updates more than deep setup
- may only discover what is visible in bottom nav

### Primary goals

- glance at priorities quickly
- log outreach or check messages on the go
- avoid missing follow-ups

### Likely friction

- may not discover `Check-in`, `Guides`, `Interviews`, `Events`, `Templates`, or `Watchlist`
- may postpone deeper data entry until they are back on desktop

### Good test tasks

- open `Briefing` from mobile
- respond to an inbox thread
- update a follow-up
- try to find `Check-in` and `Guides` without help

## Manual Test Script

Use this script in user testing, internal review, or self-audit.

### Task 1. Onboarding clarity

Prompt:

- "You just received access to this app. Please set yourself up."

Questions:

- What feels required versus optional?
- What do you expect to happen after setup?

### Task 2. First active job

Prompt:

- "Add a role you want to track from today."

Questions:

- Which fields felt necessary?
- Which ones felt confusing or premature?

### Task 3. First networking contact

Prompt:

- "Add someone you want to follow up with next week."

Questions:

- Did you know where to put them?
- Did the status and warmth choices make sense?

### Task 4. Plan tomorrow

Prompt:

- "End your day in the app."

Questions:

- Did `Check-in` feel useful or like extra work?
- Were the Top 3 prompts specific enough?

### Task 5. Start the next day

Prompt:

- "Open the app tomorrow morning and decide what to do first."

Questions:

- Did `Briefing` help you choose?
- What still felt hidden or unclear?

## Suggested Success Metrics For Usability Testing

- User can explain the difference between `Pipeline` and `Outreach`
- User can add one role without facilitator help
- User can add one follow-up date that later surfaces in `Briefing`
- User can write three specific Top 3 items in `Check-in`
- User can identify where to go for interviews, events, and messages
- User can explain the app's daily loop in their own words

## Recommendations To Prioritize

### High priority

- Make the minimum-viable workflow more explicit in onboarding and guides
- Reduce first-day emphasis on optional integrations
- Clarify the most important fields in `Pipeline` and `Outreach`
- Test mobile discoverability for pages not shown in bottom nav

### Medium priority

- Align wording like `Today Queue` vs `Briefing`
- Add more blank-state guidance on what to do first
- Reinforce how `Check-in` improves the next day's experience

### Lower priority

- Polish helper affordances like quick-jump expectations and inbox read-state nuance
- Expand advanced documentation after the basic job seeker workflow feels airtight

## Proposed Next Deliverables

If we keep going, the most useful follow-on artifacts would be:

1. A polished customer-facing "Start Here" guide for job seekers
2. A facilitator script for live usability sessions
3. A UAT checklist by persona
4. A short list of onboarding copy changes based on the audit above
