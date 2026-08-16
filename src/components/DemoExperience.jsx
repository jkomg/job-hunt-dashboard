import { useState } from 'react'
import { Icon } from '../ui-icons.jsx'
import { DEMO_CLIENTS, DEMO_CONTACTS, DEMO_JOBS, DEMO_NEXT_ACTION, DEMO_PERSON } from '../demoData.js'

const SOLO_NAV = [
  ['overview', 'Briefing', 'sunrise'],
  ['pipeline', 'Pipeline', 'columns'],
  ['outreach', 'Outreach', 'users'],
]

const PARTNER_NAV = [
  ['overview', 'Portfolio', 'building'],
  ['clients', 'Job hunters', 'users'],
  ['operations', 'Interventions', 'clipboard-list'],
]

function DemoMark() {
  return <span className="demo-mark"><Icon name="briefcase" /></span>
}

function SoloOverview({ onNavigate }) {
  return (
    <>
      <section className="demo-welcome">
        <div><span className="demo-eyebrow">Saturday briefing</span><h1>Good morning, {DEMO_PERSON.firstName}.</h1><p>One focused hour today keeps three promising conversations moving.</p></div>
        <div className="demo-score"><strong>{DEMO_PERSON.momentum}</strong><span>momentum</span></div>
      </section>
      <div className="demo-metric-grid">
        <article><span>Active roles</span><strong>12</strong><small>3 need attention</small></article>
        <article><span>Warm conversations</span><strong>8</strong><small>+2 this week</small></article>
        <article><span>Interviews</span><strong>3</strong><small>Next on Tuesday</small></article>
        <article><span>Weekly consistency</span><strong>4/5</strong><small>Best streak: 11 days</small></article>
      </div>
      <div className="demo-two-col">
        <section className="demo-panel demo-focus-panel">
          <div className="demo-panel-head"><div><span className="demo-eyebrow">Next best action</span><h2>{DEMO_NEXT_ACTION.title}</h2></div><span className="demo-time">25 min</span></div>
          <p>{DEMO_NEXT_ACTION.detail}</p>
          <div className="demo-action-row"><button type="button" onClick={() => onNavigate('pipeline')}>Open interview plan <Icon name="arrow-right" /></button><span>Suggested from your pipeline</span></div>
        </section>
        <section className="demo-panel">
          <div className="demo-panel-head"><div><span className="demo-eyebrow">Today</span><h2>Three small wins</h2></div><span className="demo-count">1/3</span></div>
          <ul className="demo-checklist"><li className="done"><span><Icon name="check" /></span>Share pipeline notes with Lucia</li><li><span />Draft Nimbus STAR stories</li><li><span />Follow up with Acme recruiter</li></ul>
        </section>
      </div>
    </>
  )
}

function SoloPipeline({ onSampleAction }) {
  return (
    <>
      <section className="demo-page-head"><div><span className="demo-eyebrow">Search command center</span><h1>Your pipeline</h1><p>Every opportunity has a next step, owner, and signal.</p></div><button type="button" className="demo-primary" onClick={() => onSampleAction('Adding an opportunity')}><Icon name="plus" /> Add opportunity</button></section>
      <div className="demo-kanban">
        {['Networking', 'Applied', 'Interview'].map(stage => <section className="demo-column" key={stage}>
          <div className="demo-column-head"><strong>{stage}</strong><span>{DEMO_JOBS.filter(j => j.stage === stage).length}</span></div>
          {DEMO_JOBS.filter(j => j.stage === stage).map(job => <article className="demo-job" key={job.company}><span className={`demo-company-mark ${job.accent}`}>{job.company[0]}</span><div><strong>{job.company}</strong><p>{job.role}</p><small><Icon name="clock" /> {job.next}</small></div></article>)}
          <button type="button" className="demo-add-card" onClick={() => onSampleAction(`Adding a ${stage.toLowerCase()} card`)}><Icon name="plus" /> Add card</button>
        </section>)}
      </div>
    </>
  )
}

function SoloOutreach({ onSampleAction }) {
  return (
    <>
      <section className="demo-page-head"><div><span className="demo-eyebrow">Relationship engine</span><h1>Outreach</h1><p>Keep the humans behind your search from becoming a spreadsheet.</p></div><button type="button" className="demo-primary" onClick={() => onSampleAction('Adding a contact')}><Icon name="user-plus" /> Add contact</button></section>
      <section className="demo-panel demo-table-panel">
        <div className="demo-contact-row demo-table-head"><span>Contact</span><span>Context</span><span>Last touch</span><span>Next move</span></div>
        {DEMO_CONTACTS.map(row => <div className="demo-contact-row" key={row[0]}><span><i>{row[0][0]}</i><strong>{row[0]}</strong></span><span>{row[1]}</span><span>{row[2]}</span><span><button type="button" onClick={() => onSampleAction(row[3])}>{row[3]}</button></span></div>)}
      </section>
    </>
  )
}

function PartnerOverview({ onNavigate, onSampleAction }) {
  return (
    <>
      <section className="demo-page-head"><div><span className="demo-eyebrow">Partner portfolio</span><h1>Know who needs you today.</h1><p>A shared operating view for every job hunter, coach, and account lead.</p></div><button type="button" className="demo-primary" onClick={() => onNavigate('clients')}>View all clients <Icon name="arrow-right" /></button></section>
      <div className="demo-metric-grid"><article><span>Active job hunters</span><strong>24</strong><small>Across 3 cohorts</small></article><article><span>Weekly engagement</span><strong>83%</strong><small>+9 points this month</small></article><article><span>Interviews booked</span><strong>18</strong><small>Last 30 days</small></article><article><span>Needs attention</span><strong>4</strong><small>Prioritized automatically</small></article></div>
      <div className="demo-two-col partner-grid">
        <section className="demo-panel"><div className="demo-panel-head"><div><span className="demo-eyebrow">Portfolio health</span><h2>Momentum by cohort</h2></div><span className="demo-time">This week</span></div><div className="demo-bars">{[['Career changers', 86], ['Recent grads', 74], ['Executive search', 63]].map(([label, value]) => <div key={label}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}%</strong></div>)}</div></section>
        <section className="demo-panel demo-alert-panel"><div className="demo-panel-head"><div><span className="demo-eyebrow">Intervention queue</span><h2>Two people need attention</h2></div><span className="demo-count">2</span></div><ul className="demo-interventions"><li><span className="risk high" /><div><strong>Maya Chen</strong><small>Nimbus interview prep due today</small></div><button type="button" onClick={() => onNavigate('clients')}>Review</button></li><li><span className="risk medium" /><div><strong>Darius Brooks</strong><small>No outreach activity in 4 days</small></div><button type="button" onClick={() => onSampleAction('Sending a supportive nudge')}>Nudge</button></li></ul></section>
      </div>
    </>
  )
}

function PartnerClients({ onSampleAction }) {
  return (
    <>
      <section className="demo-page-head"><div><span className="demo-eyebrow">Client success</span><h1>Job hunter portfolio</h1><p>See progress, blockers, and the next helpful intervention at a glance.</p></div><button type="button" className="demo-primary" onClick={() => onSampleAction('Inviting a job hunter')}><Icon name="user-plus" /> Invite job hunter</button></section>
      <section className="demo-panel demo-table-panel"><div className="demo-client-row demo-table-head"><span>Job hunter</span><span>Momentum</span><span>Status</span><span>Next signal</span></div>{DEMO_CLIENTS.map(client => <div className="demo-client-row" key={client.name}><span><i>{client.name.split(' ').map(n => n[0]).join('')}</i><span><strong>{client.name}</strong><small>{client.goal}</small></span></span><span><div className="demo-mini-bar"><i style={{ width: `${client.momentum}%` }} /></div><b>{client.momentum}</b></span><span><em className={client.status === 'At risk' ? 'danger' : client.status === 'Needs nudge' ? 'warn' : ''}>{client.status}</em></span><span>{client.next}</span></div>)}</section>
    </>
  )
}

function PartnerOperations({ onSampleAction }) {
  return (
    <>
      <section className="demo-page-head"><div><span className="demo-eyebrow">Team operations</span><h1>Intervention queue</h1><p>Turn signals into timely, accountable support.</p></div><button type="button" className="demo-primary" onClick={() => onSampleAction('Creating an intervention task')}><Icon name="plus" /> Create task</button></section>
      <div className="demo-task-grid">{[
        ['Urgent', 'Owen · Recovery check-in', 'Pipeline stalled for 8 days', 'Jordan', 'Today'],
        ['Follow-up', 'Darius · Outreach unblock', 'Draft three warm intros together', 'Sam', 'Monday'],
        ['Prep', 'Maya · Nimbus interview', 'Review STAR stories and questions', 'Jordan', 'Tuesday'],
      ].map(task => <article className="demo-panel demo-task" key={task[1]}><div><span className={`demo-task-label ${task[0].toLowerCase()}`}>{task[0]}</span><small>{task[4]}</small></div><h2>{task[1]}</h2><p>{task[2]}</p><footer><span><i>{task[3][0]}</i>{task[3]}</span><button type="button" onClick={() => onSampleAction(`Opening ${task[1]}`)}>Open task <Icon name="arrow-right" /></button></footer></article>)}</div>
    </>
  )
}

export default function DemoExperience({ initialRole = 'solo', onExit, onRoleChange }) {
  const [role, setRole] = useState(initialRole === 'partner' ? 'partner' : 'solo')
  const [view, setView] = useState('overview')
  const [notice, setNotice] = useState('')
  const nav = role === 'partner' ? PARTNER_NAV : SOLO_NAV
  function switchRole(next) { setRole(next); setView('overview'); onRoleChange?.(next) }
  function showSampleAction(action) { setNotice(`${action} is available in a live workspace. This demo never changes customer data.`) }
  return (
    <div className="demo-app">
      <aside className="demo-sidebar">
        <div className="demo-brand"><DemoMark /><strong>Job Hunt<span>.</span></strong></div>
        <div className="demo-role-switch" aria-label="Demo audience"><button type="button" className={role === 'solo' ? 'active' : ''} onClick={() => switchRole('solo')}>Solo</button><button type="button" className={role === 'partner' ? 'active' : ''} onClick={() => switchRole('partner')}>Partner</button></div>
        <nav><span>{role === 'partner' ? 'TEAM WORKSPACE' : 'MY SEARCH'}</span>{nav.map(([id, label, icon]) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon name={icon} />{label}</button>)}</nav>
        <div className="demo-sidebar-proof"><Icon name="sparkles" /><strong>{role === 'partner' ? 'Scale the human touch' : 'Built for real momentum'}</strong><p>{role === 'partner' ? 'Signals tell your team where support matters most.' : 'A clear next step beats another overwhelming list.'}</p></div>
        <button type="button" className="demo-exit" onClick={onExit}><Icon name="arrow-left" /> Back to overview</button>
      </aside>
      <main className="demo-main"><div className="demo-ribbon"><span><i /> Interactive sample data</span><span>{role === 'partner' ? 'Agency workspace' : 'Solo workspace'}</span></div><div className="demo-content">
        {role === 'solo' && view === 'overview' && <SoloOverview onNavigate={setView} />}{role === 'solo' && view === 'pipeline' && <SoloPipeline onSampleAction={showSampleAction} />}{role === 'solo' && view === 'outreach' && <SoloOutreach onSampleAction={showSampleAction} />}
        {role === 'partner' && view === 'overview' && <PartnerOverview onNavigate={setView} onSampleAction={showSampleAction} />}{role === 'partner' && view === 'clients' && <PartnerClients onSampleAction={showSampleAction} />}{role === 'partner' && view === 'operations' && <PartnerOperations onSampleAction={showSampleAction} />}
      </div></main>
      {notice && <div className="demo-toast" role="status"><Icon name="info" /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss demo message"><Icon name="x" /></button></div>}
    </div>
  )
}
