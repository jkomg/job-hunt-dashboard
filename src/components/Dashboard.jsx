import { useState, useEffect } from 'react'

const WEEKLY_TARGETS = {
  outreach: 25,
  responses: 5,
  applications: 6,
  linkedInPosts: 2
}

function warmthColor(warmth) {
  if (warmth?.includes('Hot')) return 'badge-red'
  if (warmth?.includes('Warm')) return 'badge-orange'
  return 'badge-gray'
}

function stageColor(stage) {
  if (stage?.includes('Conversation')) return 'badge-yellow'
  if (stage?.includes('Interview Scheduled')) return 'badge-orange'
  if (stage?.includes('Interviewing')) return 'badge-red'
  return 'badge-blue'
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
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load dashboard'); setLoading(false) })

    fetch('/api/sheets/status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSyncStatus(d))
      .catch(() => setSyncStatus(null))
  }, [])

  if (loading) return <div className="loading"><div className="spin" />Loading your briefing…</div>
  if (error) return <div className="error-msg">{error}</div>

  const {
    overdueContacts,
    duePipelineFollowUps = [],
    recentLogs,
    activeItems,
    weekStats,
    todayQueue = [],
    suggestedTop3 = [],
    priorityFramework = [],
    health
  } = data
  const pillarLabel = Object.fromEntries((priorityFramework || []).map(p => [p.id, p.label]))

  // Find yesterday's entry using the browser's local timezone
  const yesterdayLabel = new Date(Date.now() - 864e5).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const yesterdayLog = recentLogs?.find(l => (l.Date || '').trim() === yesterdayLabel) ||
    recentLogs?.find(l => l._createdTime && new Date(l._createdTime).toDateString() === new Date(Date.now() - 864e5).toDateString())
  const yesterdayTop3 = yesterdayLog?.["Tomorrow's Top 3"] || null
  const top3Lines = yesterdayTop3 ? yesterdayTop3.split('\n').filter(Boolean) : []

  return (
    <div>
      <div className="morning-greeting">Good morning, {me?.displayName || 'there'}.</div>
      <div className="today-date">{todayDate}</div>

      {syncStatus?.health && (
        <div
          className="card mb-16"
          style={{ borderColor: syncStatus.health.status === 'needs_attention' ? 'var(--yellow)' : 'var(--green)' }}
        >
          <div className="card-title">
            {syncStatus.health.status === 'needs_attention' ? '⚠️ Sync Needs Attention' : '✅ Sync Healthy'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Last success: {syncStatus.health.lastSuccessAt ? new Date(syncStatus.health.lastSuccessAt).toLocaleString() : 'Never'}
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

      {/* Yesterday's Top 3 */}
      <div className="card mb-16">
        <div className="card-title">Yesterday's Top 3 — Today's Agenda</div>
        {top3Lines.length > 0 ? (
          <ul className="top3-list">
            {top3Lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        ) : (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>No Top 3 logged yesterday.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('checkin')}>
              Log today's now →
            </button>
          </div>
        )}
      </div>

      {/* Today Queue */}
      <div className="card mb-16" style={{ borderColor: 'var(--accent)' }}>
        <div className="card-title" style={{ color: 'var(--accent)' }}>
          🧭 Today Queue ({todayQueue.length})
        </div>
        {!todayQueue.length ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            No urgent items. Pick one pipeline move and one outreach touchpoint today.
          </div>
        ) : (
          <>
            {todayQueue.slice(0, 8).map(item => (
              <div key={item.id} className="contact-row" style={{ padding: '10px 0' }}>
                <div className="contact-info">
                  <div className="contact-name">{queueIcon(item.type)} {item.title}</div>
                  <div className="contact-meta">{item.subtitle || item.reason}</div>
                  {item.pillarId && (
                    <div style={{ marginTop: 4 }}>
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>{pillarLabel[item.pillarId] || item.pillarId}</span>
                    </div>
                  )}
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>
                    Why now: {item.reason}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {item.dueDate && <span className="overdue-badge">Due {item.dueDate}</span>}
                  <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(item.route)}>
                    {item.actionLabel || 'Open'}
                  </button>
                </div>
              </div>
            ))}
            {!!suggestedTop3.length && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                Suggested Top 3: {suggestedTop3.join(' | ')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Six priorities status */}
      {!!priorityFramework.length && (
        <div className="card mb-16">
          <div className="card-title">6 Priorities</div>
          {priorityFramework.map(p => (
            <div key={p.id} className="contact-row" style={{ padding: '8px 0' }}>
              <div className="contact-info">
                <div className="contact-name">{p.label}</div>
              </div>
              <span className={`badge ${p.count > 0 ? 'badge-yellow' : 'badge-green'}`}>
                {p.count} item{p.count === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Overdue follow-ups */}
      {overdueContacts.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'var(--red)' }}>
          <div className="card-title" style={{ color: 'var(--red)' }}>
            🔔 Follow-ups Due ({overdueContacts.length})
          </div>
          {overdueContacts.slice(0, 5).map(c => (
            <div key={c.id} className="contact-row" style={{ padding: '10px 0' }}>
              <div className="contact-avatar">{(c.Name || '?')[0].toUpperCase()}</div>
              <div className="contact-info">
                <div className="contact-name">{c.Name}</div>
                <div className="contact-meta">
                  {[c.Title, c.Company && `@ ${c.Company}`].filter(Boolean).join(' ')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className={`badge ${warmthColor(c.Warmth)}`}>{c.Warmth?.split('—')[0].trim()}</span>
                {c['Next Follow-Up'] && (
                  <span className="overdue-badge">Due {c['Next Follow-Up']}</span>
                )}
              </div>
            </div>
          ))}
          {overdueContacts.length > 5 && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('contacts')}>
                +{overdueContacts.length - 5} more → View all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Command Center Health */}
      {health && (
        <div className="card mb-16">
          <div className="card-title">System Health</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Queue items: {health.queueSize} · Stalled records needing next action: {health.staleTotal}
          </div>
          <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12 }}>
            Pipeline: {health.stale?.pipeline || 0} · Contacts: {health.stale?.contacts || 0} · Interviews: {health.stale?.interviews || 0}
          </div>
        </div>
      )}

      {/* Due pipeline follow-ups */}
      {duePipelineFollowUps.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'var(--orange)' }}>
          <div className="card-title" style={{ color: 'var(--orange)' }}>
            🔁 Pipeline Follow-ups Due ({duePipelineFollowUps.length})
          </div>
          {duePipelineFollowUps.slice(0, 6).map(item => (
            <div key={item.id} className="contact-row" style={{ padding: '10px 0' }}>
              <div className="contact-info">
                <div className="contact-name">{item.Company}</div>
                <div className="contact-meta">{item.Role}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className={`badge ${stageColor(item.Stage)}`} style={{ fontSize: 10 }}>{item.Stage}</span>
                <span className="overdue-badge">Due {item['Follow-Up Date']}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('pipeline')}>
              Review in pipeline →
            </button>
          </div>
        </div>
      )}

      {/* Active pipeline items */}
      {activeItems.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'var(--yellow)' }}>
          <div className="card-title" style={{ color: 'var(--yellow)' }}>
            ⚡ Active Pipeline ({activeItems.length})
          </div>
          {activeItems.map(item => (
            <div key={item.id} className="contact-row" style={{ padding: '10px 0' }}>
              <div className="contact-info">
                <div className="contact-name">{item.Company}</div>
                <div className="contact-meta">{item.Role}</div>
              </div>
              <span className={`badge ${stageColor(item.Stage)}`} style={{ fontSize: 10, marginLeft: 8, flexShrink: 0 }}>{item.Stage}</span>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('pipeline')}>
              View full pipeline →
            </button>
          </div>
        </div>
      )}

      {/* This week's numbers */}
      <div className="mb-16">
        <div className="card-title" style={{ marginBottom: 10 }}>This Week's Numbers</div>
        <div className="stats-grid">
          <StatCard label="Outreach" value={weekStats.outreach} target={WEEKLY_TARGETS.outreach} color="accent" />
          <StatCard label="Responses" value={weekStats.responses} target={WEEKLY_TARGETS.responses} color="green" />
          <StatCard label="Applications" value={weekStats.applications} target={WEEKLY_TARGETS.applications} color="yellow" />
          <StatCard label="LinkedIn" value={weekStats.linkedInPosts} target={WEEKLY_TARGETS.linkedInPosts} color="purple" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('checkin')}>✅ Log Today</button>
          <button className="btn btn-ghost" onClick={() => onNavigate('contacts')}>👥 Outreach</button>
          <button className="btn btn-ghost" onClick={() => onNavigate('pipeline')}>🎯 Pipeline</button>
        </div>
      </div>
    </div>
  )
}
