# Job Seeker UX Cleanup Checklist

This checklist turns the current job seeker UX audit into concrete cleanup work.

The goal is not to redesign everything. The goal is to make the app easier to start, easier to understand, and easier to use consistently without removing the deeper power-user workflows.

## How To Use This Checklist

Each item is written as a specific improvement target.

Use the priority labels this way:

- `P0` = likely to block or seriously confuse first-time users
- `P1` = important quality-of-use improvement
- `P2` = useful polish or follow-through improvement

## P0: First-Time User Clarity

### 1. Make the minimum-viable workflow explicit in onboarding

- Priority: `P0`
- Area: `SetupWizard`, `Guides`, `Briefing`
- Problem: a new user may not know what "using the app correctly" looks like
- Desired outcome: user can explain the daily loop in under 30 seconds
- Cleanup:
- add a plain-language "Start with these 4 things" block in onboarding
- reinforce the same model in `Guides`
- make sure the first landing experience points users toward `Pipeline`, `Outreach`, `Briefing`, and `Check-in`
- Success check: a first-time user can say "jobs in Pipeline, people in Outreach, Briefing in the morning, Check-in at night"

### 2. Reduce the day-one weight of optional Google Sheets setup

- Priority: `P0`
- Area: `SetupWizard`
- Problem: Sheets sync adds complexity before the user knows the core workflow
- Desired outcome: users understand Sheets is optional and safe to skip
- Cleanup:
- visually de-emphasize the Sheets card during setup
- shorten the explanatory copy
- move advanced details behind a reveal, secondary step, or "set up later in Settings" path
- remove any wording that makes the sync feel required for success
- Success check: users skip or configure Sheets intentionally, not anxiously

### 3. Fix terminology drift between onboarding and the current product

- Priority: `P0`
- Area: `SetupWizard`, in-app instructions, future help copy
- Problem: terms like `Today Queue` do not match the current `Briefing` mental model
- Desired outcome: every major instruction uses the same surface names users see in the app
- Cleanup:
- replace outdated terms with current nav labels
- audit `Briefing`, `Check-in`, `Pipeline`, `Outreach`, and `Guides` references for consistency
- align instructional copy with the actual navigation labels shown in the UI
- Success check: users never wonder whether they are looking for an old screen name

## P0: Core Form Simplification

### 4. Clarify the "must fill now" versus "optional later" fields in `Pipeline`

- Priority: `P0`
- Area: `Pipeline`
- Problem: the add/edit form is powerful but dense for first-time users
- Desired outcome: users can add a role quickly without feeling forced to complete every field
- Cleanup:
- visually identify the essential fields for a first role
- group optional/advanced fields more clearly
- add short helper text for the most important decisions
- consider a progressive disclosure pattern for advanced fields
- Success check: a first-time user can add one role without facilitator help or hesitation

### 5. Clarify the difference between `Follow-Up Date` and `Next Action Date`

- Priority: `P0`
- Area: `Pipeline`, `Outreach`, instructions
- Problem: these two fields are both useful, but easy to confuse
- Desired outcome: users know exactly when to use each date
- Cleanup:
- add consistent helper copy to both concepts
- use examples in one or both forms
- align the wording across `Pipeline`, `Outreach`, and user guidance
- Success check: test users can explain the difference back in their own words

### 6. Reduce classification pressure in `Outreach`

- Priority: `P0`
- Area: `Outreach`
- Problem: users may not know how to set warmth, status, and relationship source on first entry
- Desired outcome: users can log a contact quickly and refine later
- Cleanup:
- add copy that says "fill the basics first"
- make the most important contact fields visually primary
- consider treating some fields as advanced or optional on first add
- add one example of a realistic contact entry
- Success check: users add a contact without stopping to decode every dropdown

## P1: Navigation And Discoverability

### 7. Improve mobile discoverability for non-bottom-nav sections

- Priority: `P1`
- Area: mobile navigation, `Guides`, `Check-in`, `Interviews`, `Events`, `Watchlist`, `Templates`
- Problem: mobile users may never naturally find several important pages
- Desired outcome: mobile users can reach key secondary destinations without guesswork
- Cleanup:
- review whether the mobile nav should expose one more core workflow
- consider a "More" destination or mobile section launcher
- add more explicit pathways from `Briefing` into hidden-but-important screens
- Success check: mobile-first testers can find `Check-in` and `Guides` without help

### 8. Make `Guides` feel more discoverable from core workflows

- Priority: `P1`
- Area: `Guides`, `Briefing`, onboarding
- Problem: useful instructions exist, but users may not know to look there
- Desired outcome: first-time users encounter help at the moment they need it
- Cleanup:
- add a contextual "New here?" entry point from `Briefing` or onboarding completion
- link relevant guide sections from blank states when appropriate
- ensure the first-time job seeker guide remains the default guide
- Success check: users encounter the guide before they feel lost, not after

### 9. Decide what `Quick jump` should be

- Priority: `P1`
- Area: shell navigation
- Problem: the control appears present but may not behave like a real feature yet
- Desired outcome: users either get a working quick-jump experience or no misleading affordance
- Cleanup:
- implement it, hide it, or relabel it until it works
- avoid leaving a visible "search/jump" pattern that implies functionality that is not there
- Success check: no tester clicks it and gets confused or disappointed

## P1: Briefing And Daily Loop

### 10. Improve blank-state guidance in `Briefing`

- Priority: `P1`
- Area: `Briefing`
- Problem: early users may land on a sparse dashboard and not know how to make it useful
- Desired outcome: blank or low-data states guide the next action clearly
- Cleanup:
- add first-use guidance when there is not enough data yet
- point users toward adding roles, contacts, or a check-in
- explain briefly why `Briefing` becomes more useful over time
- Success check: a blank `Briefing` still tells the user what to do next

### 11. Reinforce why `Check-in` matters

- Priority: `P1`
- Area: `Check-in`, `Briefing`, in-app copy
- Problem: some users may see it as extra work rather than the engine for tomorrow's focus
- Desired outcome: users understand the payoff of doing `Check-in`
- Cleanup:
- emphasize that `Check-in` shapes tomorrow's `Briefing`
- keep the Top 3 guidance concrete and behavior-oriented
- consider a short callout the first few times a user visits the page
- Success check: users can explain why they would return to `Check-in` daily

### 12. Make the Top 3 quality bar more obvious

- Priority: `P1`
- Area: `Check-in`, `Guides`
- Problem: users may enter vague priorities that do not help the next day
- Desired outcome: most Top 3 entries are specific and actionable
- Cleanup:
- include one or two strong example items inline
- explicitly contrast specific tasks with vague entries
- keep the examples short and realistic
- Success check: test users write concrete next actions instead of generic intentions

## P1: Supporting Screens

### 13. Strengthen the distinction between `Interviews` and `Events`

- Priority: `P1`
- Area: `Interviews`, `Events`, guides
- Problem: some users may not know where networking sessions versus one-on-one conversations belong
- Desired outcome: users can place scheduled items in the right screen
- Cleanup:
- add clearer description copy or examples in both areas
- explain the distinction in the first-time guide
- use empty-state text to reinforce the intended use
- Success check: users consistently categorize mock scenarios correctly

### 14. Help users understand when to use `Watchlist`

- Priority: `P1`
- Area: `Watchlist`, `Pipeline`, guides
- Problem: some users may overlook `Watchlist` or treat `Pipeline` as the only place for company tracking
- Desired outcome: users know that `Watchlist` is for pre-application company tracking
- Cleanup:
- add more explicit empty-state guidance
- explain when a watchlist item should become a pipeline role
- reinforce the concept in customer-facing instructions
- Success check: networking-heavy testers naturally use both `Watchlist` and `Pipeline`

### 15. Make `Templates` feel like a workflow tool, not a storage page

- Priority: `P1`
- Area: `Templates`, `Outreach`, instructions
- Problem: new users may not realize why this matters until much later
- Desired outcome: users understand templates as time-savers for repeated outreach
- Cleanup:
- improve empty-state guidance around when to create the first template
- add references from outreach guidance
- consider showing a lightweight "save this pattern later" framing
- Success check: users understand template value without needing a full training session

## P2: Communication And Trust

### 16. Improve Inbox read/attention cues

- Priority: `P2`
- Area: `Inbox`, nav badges
- Problem: users can see thread counts, but urgency and unread state may feel muted
- Desired outcome: users can quickly tell whether something needs attention
- Cleanup:
- review whether unread, recently updated, or open-thread state should be more visible
- improve priority signaling without making the page noisy
- Success check: users can spot which thread to open first

### 17. Audit helper text for tone and confidence

- Priority: `P2`
- Area: forms, onboarding, guides
- Problem: a helpful product can still feel intimidating if copy assumes too much confidence
- Desired outcome: the interface feels supportive, specific, and low-pressure
- Cleanup:
- prefer plain language over internal shorthand
- keep helper text short and practical
- avoid implying that optional fields are required for success
- Success check: first-time users feel guided rather than evaluated

### 18. Align blank states across the app

- Priority: `P2`
- Area: `Briefing`, `Pipeline`, `Outreach`, `Templates`, `Inbox`, `Watchlist`
- Problem: some blank states are clear, while others may only state that nothing exists yet
- Desired outcome: every blank state answers "what should I do next?"
- Cleanup:
- review all major empty states
- add one next-step instruction where missing
- link to the most relevant action or guide
- Success check: empty screens feel like guidance, not dead ends

## Validation Checklist

Use this after cleanup work ships.

- A first-time user can describe the app's daily loop correctly
- A first-time user can add one job without feeling forced to fill everything
- A first-time user can add one contact without confusion about where it belongs
- A user can explain `Follow-Up Date` versus `Next Action Date`
- A mobile tester can find `Check-in` and `Guides`
- A user understands that Sheets sync is optional
- A blank or low-data `Briefing` still points the user toward the next useful action

## Suggested Delivery Order

If we tackle this in phases, the order should be:

1. Onboarding clarity and terminology cleanup
2. `Pipeline` and `Outreach` simplification
3. `Briefing` and `Check-in` reinforcement
4. Mobile discoverability improvements
5. Supporting-screen and polish improvements

## What Comes Next

After this checklist, the next document to build should be a short, customer-facing `Start Here` guide that reflects whatever cleanup work we actually keep.
