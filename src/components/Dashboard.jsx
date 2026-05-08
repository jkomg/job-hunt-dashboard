import { useState, useEffect } from 'react'

const WEEKLY_TARGETS = {
  outreach: 25,
  responses: 5,
  applications: 6,
  linkedInPosts: 2
}

function queueIcon(type) {
  if (type === 'contact_follow_up') return '👥'
  if (type === 'pipeline_follow_up') return '🎯'
  if (type === 'interview_action' || type === 'upcoming_interview') return '📞'
  if (type === 'upcoming_event') return '🗓️'
  return '•'
}

function pct(val, target) {
  return Math.min(100, Math.round((val / target) * 100))
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

function summarizeSync(run) {
  const summary = run?.summary || {}
  const merged = (summary.inbound || summary.outbound)
    ? { ...(summary.inbound || {}), ...(summary.outbound || {}) }
    : summary

  const parts = []
  if (Number.isFinite(Number(merged.updatedRows))) parts.push(`${merged.updatedRows} updated`)
  if (Number.isFinite(Number(merged.imported))) parts.push(`${merged.imported} imported`)
  if (Number.isFinite(Number(merged.skippedUnchanged))) parts.push(`${merged.skippedUnchanged} skipped`)
  if (Number(merged.conflicts || 0) > 0) parts.push(`${merged.conflicts} conflicts`)
  return parts.length ? parts.join(' • ') : 'No recent summary'
}

function StatCard({ label, value, target, color }) {
  const p = pct(value, target)
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color: `var(--${color || 'text'})` }}>{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-target">Target: {target}/wk</div>
      <div className="stat-bar">
        <div className="stat-bar-fill" style={{ width: `${p}%`, background: `var(--${color || 'accent'})` }} />
      </div>
    </div>
  )
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
  const isStaffLike = me?.role === 'staff' || me?.isAdmin

  useEffect(() => {
    const dashboardFetch = fetch('/api/dashboard', { credentials: 'include' }).then(r => r.json())
    const staffQuery = (isStaffLike && me?.isAdmin && staffScope === 'assigned') ? '?scope=assigned' : ''
    const staffQueueFetch = isStaffLike
      ? fetch(`/api/staff/queue${staffQuery}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null)
      : Promise.resolve(null)

    Promise.all([dashboardFetch, staffQueueFetch])
      .then(([d, sq]) => {
        setData(d)
        setStaffQueue(sq)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load dashboard'); setLoading(false) })

    fetch('/api/sheets/status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSyncStatus(d))
      .catch(() => setSyncStatus(null))

    if (!isStaffLike) {
      fetch('/api/member/threads', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setMemberThreads(d?.threads || []))
        .catch(() => setMemberThreads([]))
    } else {
      setMemberThreads([])
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

  const topQueue = todayQueue.slice(0, 3)
  const openMemberThreads = memberThreads.filter(t => t.status === 'open')
  const latestMemberThreadUpdateAt = memberThreads.reduce((max, t) => Math.max(max, Number(t.updatedAt || 0)), 0)

  if (isStaffLike) {
    const summary = staffQueue?.summary || {}
    const candidates = staffQueue?.candidates || []
    const recommendations = staffQueue?.recommendations || []
    const tasks = staffQueue?.tasks || []
    const draftRecommendations = recommendations.filter(r => r.status === 'draft')
    const postedRecommendations = recommendations.filter(r => r.status === 'posted')
    const todoTasks = tasks.filter(t => t.status === 'todo')
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
    const openThreads = Number(summary.threadsOpen || 0)
    const staleThreads = Number(summary.threadsStale48h || 0)
    const startToday = new Date()
    startToday.setHours(0, 0, 0, 0)
    const endToday = new Date(startToday)
    endToday.setDate(endToday.getDate() + 1)
    const overdueTasks = tasks.filter(t => t.status !== 'done' && Number(t.dueAt || 0) > 0 && Number(t.dueAt) < startToday.getTime())
    const dueTodayTasks = tasks.filter(t => t.status !== 'done' && Number(t.dueAt || 0) >= startToday.getTime() && Number(t.dueAt || 0) < endToday.getTime())
    const scopeLabel = summary.scope === 'all' ? 'All Candidates' : 'My Assigned Candidates'
    const candidateCountLabel = summary.scope === 'all' ? 'candidates in the organization queue' : 'candidates in your queue'

    return (
      <div>
        <div className="morning-greeting">Good morning, {me?.displayName || 'there'}.</div>
        <div className="today-date">{todayDate}</div>

        <div className="card mb-16">
          <div className="card-title">Staff Briefing</div>
          {me?.isAdmin && (
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`btn btn-sm ${staffScope === 'assigned' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStaffScope('assigned')}>My Queue</button>
              <button className={`btn btn-sm ${staffScope === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStaffScope('all')}>All Candidates</button>
            </div>
          )}
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
            Viewing: {scopeLabel}
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{summary.candidates || candidates.length}</div><div className="stat-label">{summary.scope === 'all' ? 'Total Candidates' : 'Assigned Candidates'}</div></div>
            <div className="stat-card"><div className="stat-value">{summary.recommendationsDraft || draftRecommendations.length}</div><div className="stat-label">Draft Jobs</div></div>
            <div className="stat-card"><div className="stat-value">{summary.recommendationsPosted || postedRecommendations.length}</div><div className="stat-label">Posted Jobs</div></div>
            <div className="stat-card"><div className="stat-value">{(summary.tasksTodo || todoTasks.length) + (summary.tasksInProgress || inProgressTasks.length)}</div><div className="stat-label">Open Tasks</div></div>
          </div>
          <div className="stats-grid" style={{ marginTop: 10 }}>
            <div className="stat-card"><div className="stat-value">{Number(summary.candidatesInterviewActive || 0)}</div><div className="stat-label">Interview Active</div></div>
            <div className="stat-card"><div className="stat-value">{Number(summary.candidatesStaleFollowUps || 0)}</div><div className="stat-label">Stale Follow-Ups</div></div>
            <div className="stat-card"><div className="stat-value">{Number(summary.candidatesInactive7d || 0)}</div><div className="stat-label">Inactive 7d</div></div>
            <div className="stat-card"><div className="stat-value">{Number(summary.candidatesRrPosted72h || 0)}</div><div className="stat-label">RR Posted 72h</div></div>
          </div>
        </div>

        <div className="card mb-16" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-title" style={{ color: 'var(--accent)' }}>Daily Ops Checklist</div>
          <div className="contact-row" style={{ padding: '8px 0' }}>
            <div className="contact-info">
              <div className="contact-name">1. Review candidate queue</div>
              <div className="contact-meta">{candidates.length} candidate{candidates.length === 1 ? '' : 's'} {candidateCountLabel}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('operations')}>Open Operations</button>
          </div>
          <div className="contact-row" style={{ padding: '8px 0' }}>
            <div className="contact-info">
              <div className="contact-name">2. Post researched jobs</div>
              <div className="contact-meta">{draftRecommendations.length} draft recommendation{draftRecommendations.length === 1 ? '' : 's'} pending</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('operations')}>Post Jobs</button>
          </div>
          <div className="contact-row" style={{ padding: '8px 0' }}>
            <div className="contact-info">
              <div className="contact-name">3. Resolve support/admin tasks</div>
              <div className="contact-meta">
                {todoTasks.length} todo · {inProgressTasks.length} in progress · {overdueTasks.length} overdue · {dueTodayTasks.length} due today
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('staff_tasks')}>Open Tasks</button>
          </div>
          <div className="contact-row" style={{ padding: '8px 0' }}>
            <div className="contact-info">
              <div className="contact-name">4. Review audit + sync health</div>
              <div className="contact-meta">Keep org actions and integrations healthy</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('settings')}>Open Settings</button>
          </div>
          <div className="contact-row" style={{ padding: '8px 0' }}>
            <div className="contact-info">
              <div className="contact-name">5. Clear thread inbox</div>
              <div className="contact-meta">{openThreads} open · {staleThreads} stale 48h+</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('staff_threads')}>Open Threads</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Weekly Staff Rhythm</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
            Monday: rebalance assignments · Midweek: pipeline quality checks · Friday: outcomes review.
          </div>
          <div className="quick-actions">
            <button className="btn btn-primary" onClick={() => onNavigate('operations')}>🧭 Operations</button>
            <button className="btn btn-ghost" onClick={() => onNavigate('settings')}>⚙️ Admin Settings</button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Source Performance</div>
          {!sourcePerformance.length && <div style={{ color: 'var(--text-muted)' }}>No source data yet.</div>}
          {!!sourcePerformance.length && (
            <table className="data-table">
              <thead><tr><th>Source</th><th>Active</th><th>Response %</th><th>Interview %</th><th>Offers</th></tr></thead>
              <tbody>
                {sourcePerformance.slice(0, 6).map(s => (
                  <tr key={`staff-source-${s.source}`}>
                    <td>{s.source}</td>
                    <td>{s.active}</td>
                    <td>{s.responseRate}%</td>
                    <td>{s.interviewRate}%</td>
                    <td>{s.offers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  function openItem(item) {
    const intent = {}
    if (item.type === 'pipeline_follow_up') intent.mode = 'due_followups'
    if (item.type === 'pipeline_stalled') intent.mode = 'stale_actions'
    if (item.entityId) intent.focusId = item.entityId
    onNavigate(item.route, intent)
  }

  function openPriority(pillarId, route) {
    if (pillarId === 'follow_ups_due') return onNavigate('pipeline', { mode: 'due_followups' })
    if (pillarId === 'pipeline_momentum') return onNavigate('pipeline', { mode: 'stale_actions' })
    return onNavigate(route)
  }

  return (
    <div>
      <div className="morning-greeting">Good morning, {me?.displayName || 'there'}.</div>
      <div className="today-date">{todayDate}</div>

      <div className="card mb-16">
        <div className="card-title">Support Inbox</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {openMemberThreads.length} open thread{openMemberThreads.length === 1 ? '' : 's'} · {memberThreads.length} total
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Last message update: {latestMemberThreadUpdateAt ? timeAgo(new Date(latestMemberThreadUpdateAt).toISOString()) : 'never'}
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('inbox')}>
            Open Inbox
          </button>
        </div>
      </div>
      <div className="card mb-16">
        <div className="card-title">Source Performance</div>
        {!sourcePerformance.length && <div style={{ color: 'var(--text-muted)' }}>No source data yet.</div>}
        {!!sourcePerformance.length && (
          <table className="data-table">
            <thead><tr><th>Source</th><th>Active</th><th>Response %</th><th>Interview %</th><th>Offers</th></tr></thead>
            <tbody>
              {sourcePerformance.slice(0, 6).map(s => (
                <tr key={`member-source-${s.source}`}>
                  <td>{s.source}</td>
                  <td>{s.active}</td>
                  <td>{s.responseRate}%</td>
                  <td>{s.interviewRate}%</td>
                  <td>{s.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mb-16" style={{ borderColor: 'var(--accent)' }}>
        <div className="card-title" style={{ color: 'var(--accent)' }}>Briefing Priorities</div>
        <div className="contact-row" style={{ padding: '8px 0' }}>
          <div className="contact-info">
            <div className="contact-name">Top 3 Plan</div>
            <div className="contact-meta">
              {yesterdayTop3Lines.length > 0
                ? 'Using yesterday plan for today.'
                : todayTop3Lines.length >= 3
                  ? 'Top 3 already set for tomorrow.'
                  : 'No Top 3 plan found.'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('checkin')}>Open Check-in</button>
        </div>
        {yesterdayTop3Lines.length > 0 && (
          <ul className="top3-list" style={{ marginTop: 8 }}>
            {yesterdayTop3Lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        )}

        <div className="contact-row" style={{ padding: '8px 0' }}>
          <div className="contact-info">
            <div className="contact-name">📞 Interviews first</div>
            <div className="contact-meta">{dueInterviewActions.length} due actions · {upcomingInterviews.length} upcoming</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('interviews')}>Open</button>
        </div>
        <div className="contact-row" style={{ padding: '8px 0' }}>
          <div className="contact-info">
            <div className="contact-name">🔁 Due follow-ups</div>
            <div className="contact-meta">{followUpsTotal} due ({duePipelineFollowUps.length} pipeline, {overdueContacts.length} contacts)</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('pipeline', { mode: 'due_followups' })}>Open</button>
        </div>
        <div className="contact-row" style={{ padding: '8px 0' }}>
          <div className="contact-info">
            <div className="contact-name">🧭 Stalled pipeline</div>
            <div className="contact-meta">{health?.staleTotal || 0} stalled of {todayQueue.length} queue items</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('pipeline', { mode: 'stale_actions' })}>Open</button>
        </div>

        {!!topQueue.length && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Next actions</div>
            {topQueue.map(item => (
              <div key={item.id} className="contact-row" style={{ padding: '8px 0' }}>
                <div className="contact-info">
                  <div className="contact-name">{queueIcon(item.type)} {item.title}</div>
                  <div className="contact-meta">{item.reason}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openItem(item)}>Open</button>
              </div>
            ))}
          </div>
        )}

        {!!priorityFramework.length && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Priority buckets</div>
            {priorityFramework.map(p => (
              <div key={p.id} className="contact-row" style={{ padding: '8px 0' }}>
                <div className="contact-info">
                  <div className="contact-name">{p.label}</div>
                  <div className="contact-meta">{p.count} item{p.count === 1 ? '' : 's'}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openPriority(p.id, p.route)}>Open</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-16">
        <div className="card-title" style={{ marginBottom: 10 }}>This Week's Numbers</div>
        <div className="stats-grid">
          <StatCard label="Outreach" value={weekStats.outreach} target={WEEKLY_TARGETS.outreach} color="accent" />
          <StatCard label="Responses" value={weekStats.responses} target={WEEKLY_TARGETS.responses} color="green" />
          <StatCard label="Applications" value={weekStats.applications} target={WEEKLY_TARGETS.applications} color="yellow" />
          <StatCard label="LinkedIn" value={weekStats.linkedInPosts} target={WEEKLY_TARGETS.linkedInPosts} color="purple" />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('checkin')}>✅ Log Today</button>
          <button className="btn btn-ghost" onClick={() => onNavigate('contacts')}>👥 Outreach</button>
          <button className="btn btn-ghost" onClick={() => onNavigate('pipeline')}>🎯 Pipeline</button>
        </div>
      </div>

      {syncStatus?.health && (
        <div
          className="card"
          style={{ marginTop: 16, borderColor: syncStatus.health.status === 'needs_attention' ? 'var(--yellow)' : 'var(--green)' }}
        >
          <div className="card-title">
            {syncStatus.health.status === 'needs_attention' ? '⚠️ Sync Needs Attention' : '✅ Sync Healthy'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Last success: {syncStatus.health.lastSuccessAt ? new Date(syncStatus.health.lastSuccessAt).toLocaleString() : 'Never'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Last local save: {syncStatus.freshness?.localLastSavedAt ? `${timeAgo(syncStatus.freshness.localLastSavedAt)}` : 'Never'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Last Google sync: {syncStatus.freshness?.googleLastSyncedAt ? `${timeAgo(syncStatus.freshness.googleLastSyncedAt)}` : 'Never'}
          </div>
          {syncStatus.health.lastError?.details && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
              Last issue: {syncStatus.health.lastError.details}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('settings')}>
              Open sync settings →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
