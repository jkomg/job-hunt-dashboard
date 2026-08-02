# Competitive pricing analysis

Status: beta pricing recommendation, August 2026

## Market read

The basic job tracker is now a low-cost or free feature. Paid solo plans mostly monetize AI resume tailoring, cover letters, application autofill, and other speed improvements:

| Product | Public solo offer | What the paid plan emphasizes | Organization motion |
| --- | --- | --- | --- |
| [Teal](https://www.tealhq.com/pricing) | Free core tracker; Teal+ is $29/month or $79/90 days | Resume builder, keyword matching, AI writing, templates | Not the main public pricing path |
| [Huntr](https://huntr.co/pricing) | Free up to 100 tracked jobs; Pro $40/month, discounted to $30/month quarterly or $26.66/month biannually | AI resume/cover-letter generation, unlimited tracking and insights | Huntr Advisor is demo-led for bootcamps, coaches, workforce programs, and outplacement |
| [Simplify](https://help.simplify.jobs/en/help/articles/5623502-whats-included-in-simplify-features-and-pricing) | Simplify+ $19.99/week, $39.99/month, or $89.99/3 months | AI tailoring, application writing, networking, outreach, and analytics | Employer product is separate from the job-seeker offer |
| [Careerflow](https://help.careerflow.ai/en/articles/10605570-free-vs-premium-access) | Free tracker and limited AI; Premium pricing is not consistently exposed in the public comparison | AI resume, LinkedIn optimization, mock interviews, and cover letters | Organization plans are tailored/demo-led |

## Implication for Job Hunt

Do not compete on “another application tracker.” Keep the solo daily loop usable for free and charge for convenience or depth. The defensible product is the shared operating layer for organizations helping people get employed:

- staff assignments and candidate visibility;
- goals, check-ins, reminders, and next-best-action workflows;
- role-aware privacy and communication;
- aggregate activity and placement reporting;
- backup, support, and organization controls.

The existing roles (`job_seeker`, `accelerator_user`, `premium_user`, `vip_user`, `staff`, and `admin`) should remain permission/service roles. They should not become six public pricing tiers.

## Recommended beta packaging

### Solo — free

Keep the core promise free: Pipeline, Outreach, Interviews, Briefing, Check-in, follow-ups, export/backup, and the basic daily queue. This removes the strongest adoption barrier and lets solo users become a referral channel.

### Solo Plus — $8/month or $72/year

An optional convenience tier after the free daily loop is proven. Candidate features: opt-in email digest, calendar export, advanced personal analytics, saved views, and expanded integrations. Do not add AI costs until there is a clear paid use case.

### Program Starter — $149/month, up to 15 active job seekers

For a small coach or pilot program. Include staff workspace, assignments, candidate-level queue, basic organization reporting, and email support. This is a deliberately accessible beta price, not a claim that the long-term value is only $149.

### Program Growth — $399/month, up to 50 active job seekers

For Remote Rebellion-sized programs. Include everything in Starter plus organization-level metrics, workflow templates, reminders, exports, and priority support. Charge $6–$8 per additional active job seeker rather than per staff seat.

### Custom — 100+ active job seekers

Quote based on active participants, implementation/support requirements, data retention, branding, and integrations. Avoid publishing enterprise features before they exist.

## Pricing model

Use a hybrid model:

`monthly program price = base platform fee + active job-seeker allowance + optional integration/support costs`

The billable unit should be an **active job seeker**, defined as a participant with an enabled account during the billing period. Do not price per event, reminder, or staff click; those units discourage healthy usage and create unpredictable bills.

## Validation plan

Before hardening these prices, test three offers with actual programs:

1. $149/month pilot for up to 15 active job seekers.
2. $399/month pilot for up to 50 active job seekers.
3. Custom quote for a larger cohort with reporting and support requirements.

Track activation, weekly returning users, follow-up resolution, staff time saved, placement outcomes, support hours, and gross infrastructure cost per active job seeker. Raise or lower pricing after two complete cohorts, not from competitor pricing alone.

## Decision

Proceed with free solo core plus organization pricing based on active job seekers. Keep the public pricing page simple: Solo Free, Solo Plus, Program Starter, Program Growth, and Contact Sales. Launch pricing only after the first program can demonstrate recurring value through queue usage, staff workflow adoption, and measurable outcomes.
