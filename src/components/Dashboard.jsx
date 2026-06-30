import { useState, useEffect } from 'react'
import { Icon } from '../ui-icons.jsx'

const WEEKLY_TARGETS = {
  outreach: 25,
  responses: 5,
  applications: 6,
  linkedInPosts: 2
}

function pct(val, target) {
  return Math.min(100, Math.round((Number(val) / target) * 100))
}

function timeAgo(iso) {
  if (!iso) return 'never'
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return 'unknown'
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Dashboard({ onNavigate, me }) {
  const [data, setData] = useState(null)
  const [staffQueue, setStaffQueue] = useState(null)
  const [staffScope, setStaffScope] = useState(() => {
    try { return localStorage.getItem('staff_scope') || 'assigned' } catch { return 'assigned' }
  })
  const [memberThreads, setMemberThreads] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [doneItems, setDoneItems] = useState({})
  const isStaffLike = me?.role === 'staff' || me?.isAdmin

  useEffect(() => {
    const staffQuery = (isStaffLike && me?.isAdmin && staffScope === 'assigned') ? '?scope=assigned' : ''
    const staffQueueFetch = isStaffLike
      ? fetch(`/api/staff/queue${staffQuery}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null)
      : Promise.resolve(null)

    Promise.all([
      fetch('/api/dashboard', { credentials: 'include' }).then(r => r.json()),
      staffQueueFetch
    ])
      .then(([d, sq]) => { setData(d); setStaffQueue(sq); setLoading(false) })
      .catch(() => { setError('Failed to load dashboard'); setLoading(false) })

    fetch('/api/sheets/status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSyncStatus(d))
      .catch(() => {})

    if (!isStaffLike) {
      fetch('/api/member/threads', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setMemberThreads(d?.threads || []))
        .catch(() => {})
    }
  }, [isStaffLike, me?.isAdmin, staffScope])

  useEffect(() => {
    try { localStorage.setItem('staff_scope', staffScope) } catch {}
  }, [staffScope])

  if (loading) return <div className="loading"><div className="spin" />Loading your briefing…</div>
  if (error) return <div className="error-msg">{error}</div>

  const {
    overdueContacts = [],
    duePipelineFollowUps = [],
    dueInterviewActions = [],
    upcomingInterviews = [],
    recentLogs = [],
    weekStats = { outreach: 0, responses: 0, applications: 0, linkedInPosts: 0 },
    todayQueue = [],
    priorityFramework = [],
    sourcePerformance = [],
    health
  } = data

  const followUpsTotal = overdueContacts.length + duePipelineFollowUps.length
  const openMemberThreads = memberThreads.filter(t => t.status === 'open')

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const yesterdayLabel = new Date(Date.now() - 864e5).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
  const yesterdayLog = recentLogs.find(l => (l.Date || '').trim() === yesterdayLabel)
  const todayLog = recentLogs.find(l => (l.Date || '').trim() === todayLabel)
  const yesterdayTop3 = String(yesterdayLog?.["Tomorrow's Top 3"] || '').trim()
  const todayTop3 = String(todayLog?.["Tomorrow's Top 3"] || '').trim()
  const yesterdayTop3Lines = yesterdayTop3 ? yesterdayTop3.split('\n').map(s => s.trim()).filter(Boolean) : []
  const todayTop3Lines = todayTop3 ? todayTop3.split('\n').map(s => s.trim()).filter(Boolean) : []

  const focusTasks = (yesterdayTop3Lines.length ? yesterdayTop3Lines : todayTop3Lines).slice(0, 3)
  const doneCount = Object.values(doneItems).filter(Boolean).length

  // ── Staff / Admin view ──────────────────────────────────────────────────────
  if (isStaffLike) {
    const summary = staffQueue?.summary || {}
    const candidates = staffQueue?.candidates || []
    const recommendations = staffQueue?.recommendations || []
    const tasks = staffQueue?.tasks || []
    const draftRecommendations = recommendations.filter(r => r.status === 'draft')
    const todoTasks = tasks.filter(t => t.status === 'todo')
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
    const openThreads = Number(summary.threadsOpen || 0)
    const staleThreads = Number(summary.threadsStale48h || 0)
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0)
    const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1)
    const overdueTasks = tasks.filter(t => t.status !== 'done' && Number(t.dueAt || 0) > 0 && Number(t.dueAt) < startToday.getTime())
    const dueTodayTasks = tasks.filter(t => t.status !== 'done' && Number(t.dueAt || 0) >= startToday.getTime() && Number(t.dueAt || 0) < endToday.getTime())

    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Staff Briefing</h1>
            <div className="sub">{todayDate.toUpperCase()} · @{me?.username || 'unknown'} ({me?.role || 'unknown'})</div>
          </div>
          {me?.isAdmin && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${staffScope === 'assigned' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStaffScope('assigned')}>My Queue</button>
              <button className={`btn btn-sm ${staffScope === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStaffScope('all')}>All Candidates</button>
            </div>
          )}
        </div>

        <div className="card mb-16" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-title" style={{ color: 'var(--accent)' }}>Today Focus</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
            Viewing: {scopeLabel}
          </div>
          <div className="stats-grid" style={{ marginBottom: 12 }}>
            <div className="stat-card"><div className="stat-value">{summary.candidates || candidates.length}</div><div className="stat-label">{summary.scope === 'all' ? 'Total Candidates' : 'Assigned Candidates'}</div></div>
            <div className="stat-card">
              <div className="stat-value">{summary.weeklyRecommendationPosted || 0}/{summary.weeklyRecommendationTarget || 0}</div>
              <div className="stat-label">Weekly Job Posts</div>
            </div>
            <div className="stat-card"><div className="stat-value">{(summary.tasksTodo || todoTasks.length) + (summary.tasksInProgress || inProgressTasks.length)}</div><div className="stat-label">Open Tasks</div></div>
            <div className="stat-card"><div className="stat-value">{openThreads}</div><div className="stat-label">Open Threads</div></div>
          </div>
          <div className="quick-actions">
            <button className="btn btn-primary" onClick={() => onNavigate('operations', { staffFocus: 'candidates' })}>
              Review Queue
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('operations', { staffFocus: 'recommendations' })}>
              Post Jobs ({summary.weeklyRecommendationRemaining || 0} due)
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('operations', { staffFocus: 'tasks' })}>
              Tasks ({todoTasks.length + inProgressTasks.length})
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('operations', { staffFocus: 'threads' })}>
              Threads ({openThreads})
            </button>
            {me?.isAdmin && (
              <button className="btn btn-ghost" onClick={() => onNavigate('admin_operations')}>
                Admin Operations
              </button>
            )}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
            Overdue tasks: {overdueTasks.length} · Due today: {dueTodayTasks.length} · Stale threads 48h+: {staleThreads}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Source Performance</div>
          {!sourcePerformance.length && <div style={{ color: 'var(--text-muted)' }}>No source data yet.</div>}
          {!!sourcePerformance.length && (
            <table className="data-table">
              <thead><tr><th>Source</th><th>Active</th><th>Response %</th><th>Interview %</th><th>Offers</th></tr></thead>
              <tbody>
                {sourcePerformance.slice(0, 6).map(s => (
                  <tr key={`staff-src-${s.source}`}>
                    <td>{s.source}</td><td>{s.active}</td><td>{s.responseRate}%</td><td>{s.interviewRate}%</td><td>{s.offers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ── Job Seeker view — new Briefing layout ───────────────────────────────────
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (me?.displayName || me?.username || 'there').split(' ')[0]

  const FOCUS_TAG_MAP = {
    0: 'Interview',
    1: 'Outreach',
    2: 'Pipeline',
  }

  const attnCards = [
    {
      label: 'Due follow-ups',
      val: followUpsTotal,
      ico: 'arrow-right',
      color: 'amber',
      onClick: () => onNavigate('pipeline', { mode: 'due_followups' })
    },
    {
      label: 'Upcoming interviews',
      val: upcomingInterviews.length,
      ico: 'phone',
      color: 'blue',
      onClick: () => onNavigate('interviews')
    },
    {
      label: 'Stalled roles',
      val: health?.staleTotal || 0,
      ico: 'clock',
      color: 'red',
      onClick: () => onNavigate('pipeline', { mode: 'stale_actions' })
    },
    {
      label: 'Inbox messages',
      val: openMemberThreads.length,
      ico: 'message',
      color: 'green',
      onClick: () => onNavigate('inbox')
    },
  ]

  const metrics = [
    { label: 'Outreach', val: weekStats.outreach, target: WEEKLY_TARGETS.outreach, color: 'var(--accent)' },
    { label: 'Responses', val: weekStats.responses, target: WEEKLY_TARGETS.responses, color: 'var(--green)' },
    { label: 'Applications', val: weekStats.applications, target: WEEKLY_TARGETS.applications, color: 'var(--amber)' },
    { label: 'LinkedIn', val: weekStats.linkedInPosts, target: WEEKLY_TARGETS.linkedInPosts, color: 'var(--purple, oklch(0.55 0.15 295))' },
  ]

  return (
    <div className="page">
      <div className="topline">
        <div>
          <div className="greeting">{greeting}, <span className="accent">{firstName}.</span></div>
          <div className="date-line">{todayDate}</div>
        </div>
        <div className="topline-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('checkin')}>
            <Icon name="circle-check" /> Log today
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('pipeline')}>
            <Icon name="columns" /> Pipeline
          </button>
        </div>
      </div>

      {/* Focus block */}
      <div className="focus">
        <div className="focus-top">
          <div className="focus-top-l">
            <div className="focus-icon"><Icon name="target" /></div>
            <div>
              <div className="focus-title">Today's Focus</div>
              <div className="focus-sub">
                {focusTasks.length > 0 ? "Yesterday's Top 3 plan" : 'No plan set — add one in Check-in'}
              </div>
            </div>
          </div>
          <button className="btn btn-quiet btn-sm" onClick={() => onNavigate('checkin')}>
            <Icon name="pen-line" /> Edit
          </button>
        </div>

        <div className="focus-list">
          {focusTasks.length > 0 ? focusTasks.map((task, i) => {
            const done = !!doneItems[i]
            return (
              <div key={i} className="focus-row">
                <button
                  className={'focus-check' + (done ? ' done' : '')}
                  onClick={() => setDoneItems(prev => ({ ...prev, [i]: !prev[i] }))}
                  aria-label={done ? 'Mark undone' : 'Mark done'}
                >
                  {done && <Icon name="check" />}
                </button>
                <div className={'focus-body' + (done ? ' struck' : '')}>
                  <div className="focus-task">{task}</div>
                  <div className="focus-meta">
                    <span className="focus-tag">{FOCUS_TAG_MAP[i] || 'Task'}</span>
                  </div>
                </div>
                <button className="btn btn-quiet btn-sm" onClick={() => onNavigate(i === 0 ? 'interviews' : i === 1 ? 'contacts' : 'pipeline')}>
                  <Icon name="arrow-right" />
                </button>
              </div>
            )
          }) : (
            <div className="focus-row">
              <div className="focus-body">
                <div className="focus-task" style={{ color: 'var(--text-3)', fontWeight: 500 }}>No focus tasks set yet</div>
                <div className="focus-meta">Complete yesterday's check-in to set today's Top 3</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('checkin')}>
                <Icon name="pen-line" /> Set plan
              </button>
            </div>
          )}
        </div>

        <div className="focus-foot">
          <button className="btn btn-quiet btn-sm" onClick={() => onNavigate('checkin')}>
            <Icon name="rotate-ccw" /> Update Top 3
          </button>
          {focusTasks.length > 0 && (
            <span className="progress-text">{doneCount}/{focusTasks.length} done</span>
          )}
        </div>
      </div>

      {/* Needs attention */}
      <div className="section-label">
        <span>Needs attention</span>
        <span className="rule" />
      </div>
      <div className="attn-grid" style={{ marginBottom: 26 }}>
        {attnCards.map(card => (
          <button key={card.label} className="attn" onClick={card.onClick}>
            <div className="attn-top">
              <div className={`attn-icn ${card.color}`}><Icon name={card.ico} /></div>
              <Icon name="arrow-right" className="arrow lucide" />
            </div>
            <div className="attn-val">{card.val}</div>
            <div className="attn-label">{card.label}</div>
          </button>
        ))}
      </div>

      {/* This week */}
      <div className="section-label">
        <span>This week</span>
        <span className="rule" />
      </div>
      <div className="metrics">
        {metrics.map(m => {
          const p = pct(m.val, m.target)
          return (
            <div key={m.label} className="metric">
              <div className="metric-head">
                <span className="metric-val">{m.val}</span>
                <span className="metric-target">/{m.target}</span>
              </div>
              <div className="metric-label">{m.label}</div>
              <div className="metric-bar">
                <i style={{ width: `${p}%`, background: m.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
