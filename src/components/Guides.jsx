import { useMemo, useState } from 'react'
import { Icon } from '../ui-icons.jsx'

const START_HERE_GUIDE = {
  id: 'start-here',
  title: 'Start Here',
  subtitle: 'The shortest useful way to start using Job Hunt well.',
  badge: 'Best first read',
  icon: 'sparkles',
  accent: 'oklch(0.64 0.15 170)',
  audience: 'New users',
  sections: [
    {
      title: 'The 4 Things To Start With',
      text: 'You do not need to fill every field or set up every feature on day one. Start with the smallest routine that makes the app useful.',
      bullets: [
        'Open Briefing to see what needs attention today.',
        'Add your active jobs to Pipeline.',
        'Add your important people to Outreach.',
        'Use Check-in at the end of the day.',
      ],
    },
    {
      title: 'What To Put In Pipeline',
      text: 'For a strong first role, keep it simple.',
      bullets: [
        'Company',
        'Role',
        'Stage',
        'Next Action',
        'Next Action Date or Follow-Up Date',
      ],
      tip: 'Use Next Action Date when you already know what you plan to do. Use Follow-Up Date when you are waiting on them and want a reminder if nothing happens.',
    },
    {
      title: 'What To Put In Outreach',
      text: 'Use Outreach for recruiters, hiring managers, alumni, referrals, and anyone you want to remember to follow up with.',
      bullets: [
        'Name',
        'Company',
        'Next Follow-Up',
        'Next Action',
      ],
      tip: 'If you are not sure how to classify someone yet, save the contact first and refine warmth or status later.',
    },
    {
      title: 'What To Ignore On Day One',
      bullets: [
        'Google Sheets sync',
        'Advanced role details',
        'Relationship classification details',
        'Templates',
        'Watchlist',
        'BYO agent setup',
      ],
      text: 'Those features are useful later, but they are not required to get value from the app right away.',
    },
    {
      title: 'The Daily Rhythm',
      bullets: [
        'Morning: open Briefing.',
        'During the day: update Pipeline and Outreach.',
        'End of day: complete Check-in.',
      ],
      text: 'That simple loop is the core workflow.',
    },
    {
      title: 'If You Forget Where Something Goes',
      bullets: [
        'Pipeline = jobs',
        'Outreach = people',
        'Interviews = scheduled interview conversations',
        'Events = networking events, meetups, webinars, and job fairs',
        'Watchlist = companies you care about before they become active applications',
        'Inbox = staff or program messages',
      ],
    },
  ],
}

const JOB_SEEKER_GUIDE = {
  id: 'job-seeker',
  title: 'Full Job Seeker Walkthrough',
  subtitle: 'A deeper walkthrough for Briefing, Check-in, Pipeline, Outreach, and the rest.',
  badge: 'Deeper guide',
  icon: 'map',
  accent: 'var(--accent)',
  audience: 'All users',
  sections: [
    {
      title: 'Start Here',
      text: 'The app works best when you use it as a command center instead of a storage closet. Your goal is not to fill in every field. Your goal is to always know what needs attention next.',
      bullets: [
        'Finish setup, then start with four things: Briefing, Pipeline, Outreach, and Check-in.',
        'Use Briefing first each day to see what needs attention now.',
        'Use Check-in at the end of the day to capture progress and set tomorrow\'s Top 3.',
        'Use Pipeline for roles and Outreach for people.',
      ],
    },
    {
      title: 'First-Day Setup',
      text: 'If this is your first time in the app, keep setup lightweight and practical.',
      bullets: [
        'Open Settings and confirm your name, login, and password are correct.',
        'Add the jobs you are already actively pursuing in Pipeline.',
        'Add recruiters, referrals, alumni, and other useful contacts in Outreach.',
        'Log any scheduled interviews or networking events so they stop living in your head.',
        'Skip Google Sheets sync unless you already know you want it on day one.',
      ],
    },
    {
      title: 'Briefing',
      text: 'Briefing is your home base. It should answer one question quickly: what should I work on today?',
      bullets: [
        'Check overdue follow-ups, upcoming interviews, and stalled roles first.',
        'Use the page to decide priorities, then move into Pipeline or Outreach to do the work.',
        'If Briefing feels empty, add better dates and next actions elsewhere in the app.',
      ],
    },
    {
      title: 'Check-in',
      text: 'Check-in is where you log your day and set up tomorrow so you do not have to rethink everything from scratch.',
      bullets: [
        'Record outreach sent, applications submitted, responses, and conversations.',
        'Write one honest win and one short reflection.',
        'Set exactly three specific priorities in Tomorrow\'s Top 3.',
      ],
      tip: 'Strong Top 3 items are concrete: "Follow up with Acme recruiter" beats "do job search."',
    },
    {
      title: 'Pipeline',
      text: 'Pipeline is the center of the search. Track every role you actually care about and keep the next action current.',
      bullets: [
        'For each role, focus on company, role, stage, next action, next action date, follow-up date, and notes.',
        'Move the stage as soon as something changes.',
        'If you only update one thing after an interaction, update the next action and date.',
      ],
      tip: 'A role with no next action usually becomes a stale role. Use Next Action Date for what you plan to do; use Follow-Up Date for when you want a reminder if you are waiting on them.',
    },
    {
      title: 'Outreach',
      text: 'Outreach is your networking tracker. It is for the people around the search, not the roles themselves.',
      bullets: [
        'Add recruiters, hiring managers, referrals, alumni, and former coworkers.',
        'Log how you know them, what happened, and when to follow up next.',
        'Update the contact right after each real conversation while details are fresh.',
      ],
      tip: 'If you are not sure how to classify someone yet, save the contact first and refine warmth or status later.',
    },
    {
      title: 'Interviews, Events, Watchlist, Inbox, and Templates',
      text: 'These sections support the core search and keep details from slipping through the cracks.',
      bullets: [
        'Use Interviews for one-on-one hiring conversations like recruiter screens, hiring manager calls, and later-round interviews.',
        'Use Events for group sessions like job fairs, meetups, webinars, and networking events.',
        'Use Watchlist for companies you care about before there is a real application or active process in Pipeline.',
        'Use Inbox for program or staff messages tied to your account.',
        'Use Templates for reusable outreach notes that still leave room for personalization.',
      ],
    },
    {
      title: 'A Simple Rhythm',
      text: 'The app gets much more useful when you use the same light routine every day.',
      bullets: [
        'Morning: open Briefing and handle anything time-sensitive first.',
        'During the day: work from Pipeline and Outreach and update records as things change.',
        'End of day: complete Check-in and set tomorrow\'s Top 3.',
        'Once a week: close dead roles, refresh dates, and clean up stale contacts.',
      ],
    },
  ],
}

const BYO_GUIDE = {
  id: 'byo-agent',
  title: 'Bring Your Own AI Agent',
  subtitle: 'Connect an external agent that sends leads into your account through a secure ingest token.',
  badge: 'Advanced setup',
  icon: 'bot',
  accent: 'oklch(0.62 0.13 230)',
  audience: 'Optional',
  sections: [
    {
      title: 'What This Does',
      text: 'Job Hunt Dashboard does not host your agent runtime. Your external agent sends leads to your account through a secure ingest token.',
      bullets: [
        'Open Settings -> Operations -> Bring Your Own AI Agent.',
        'Enable ingest, save settings, then generate a token.',
        'Store that token in your external agent as a secret.',
        'Send leads to POST /api/agents/ingest with the x-agent-token header.',
      ],
    },
    {
      title: 'Claude / ChatGPT Request Format',
      code: `POST /api/agents/ingest
Headers:
  x-agent-token: <YOUR_TOKEN>
  Content-Type: application/json
Body:
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
}`,
      text: 'Rules: company is required, the request can contain up to 25 entries, and duplicate detection uses jobUrl first, then company plus role.',
    },
    {
      title: 'Setup Checklist',
      bullets: [
        'Keep your existing search and scoring instructions.',
        'After your own filtering and dedupe, build entries[].',
        'POST leads to dashboard ingest as the final step.',
        'Batch when needed, with 25 rows max per request.',
      ],
    },
    {
      title: 'Troubleshooting',
      bullets: [
        '401 Missing agent token: the header was not sent.',
        '401 Invalid agent token: rotate the token and update the external agent.',
        '400 entries[] is required: the payload format is wrong.',
      ],
      tip: 'Treat x-agent-token like a password and rotate it if you think it was exposed.',
    },
  ],
}

const GUIDES = [START_HERE_GUIDE, JOB_SEEKER_GUIDE, BYO_GUIDE]

function GuideCard({ guide, active, onClick }) {
  return (
    <button
      className={'guide-nav-card' + (active ? ' active' : '')}
      style={{ '--guide-accent': guide.accent }}
      onClick={onClick}
    >
      <div className="guide-nav-top">
        <div className="guide-nav-icon">
          <Icon name={guide.icon} />
        </div>
        <span className="chip chip-line">{guide.audience}</span>
      </div>
      <div className="guide-nav-title">{guide.title}</div>
      <div className="guide-nav-sub">{guide.subtitle}</div>
      <div className="guide-nav-foot">
        <span className="guide-nav-badge">{guide.badge}</span>
        <span className="guide-nav-open">Open</span>
      </div>
    </button>
  )
}

function GuideSection({ section }) {
  return (
    <section className="guide-section card">
      <div className="guide-section-head">
        <h2>{section.title}</h2>
      </div>
      {section.text && <p className="guide-copy">{section.text}</p>}
      {section.bullets?.length ? (
        <ul className="guide-list">
          {section.bullets.map(item => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {section.code ? <pre className="guide-code"><code>{section.code}</code></pre> : null}
      {section.tip ? (
        <div className="guide-tip">
          <Icon name="lightbulb" />
          <span>{section.tip}</span>
        </div>
      ) : null}
    </section>
  )
}

export default function Guides() {
  const [selectedId, setSelectedId] = useState(START_HERE_GUIDE.id)
  const selectedGuide = useMemo(
    () => GUIDES.find(guide => guide.id === selectedId) || START_HERE_GUIDE,
    [selectedId]
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Guides</h1>
          <div className="sub">IN-APP HOW-TOS FOR FIRST-TIME USERS AND ADVANCED SETUP</div>
        </div>
        <span className="chip chip-gray">{GUIDES.length} guides</span>
      </div>

      <div className="guide-hero card" style={{ '--guide-accent': selectedGuide.accent }}>
        <div className="guide-hero-copy">
          <div className="guide-hero-label">{selectedGuide.badge}</div>
          <div className="guide-hero-title">{selectedGuide.title}</div>
          <div className="guide-hero-sub">{selectedGuide.subtitle}</div>
        </div>
        <div className="guide-hero-quick">
          <div className="guide-hero-quick-title">Best first move</div>
          <div className="guide-hero-quick-body">
            {selectedGuide.id === 'job-seeker'
              ? 'Open Briefing, then make sure every active role in Pipeline has a next action and a date.'
              : selectedGuide.id === 'start-here'
                ? 'Open Briefing, then add one real job to Pipeline and one real person to Outreach.'
              : 'Generate your ingest token in Settings before touching the external agent configuration.'}
          </div>
        </div>
      </div>

      <div className="guide-layout">
        <aside className="guide-nav">
          {GUIDES.map(guide => (
            <GuideCard
              key={guide.id}
              guide={guide}
              active={guide.id === selectedGuide.id}
              onClick={() => setSelectedId(guide.id)}
            />
          ))}
        </aside>

        <div className="guide-content">
          {selectedGuide.sections.map(section => <GuideSection key={section.title} section={section} />)}
        </div>
      </div>
    </div>
  )
}
