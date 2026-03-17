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

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load dashboard'); setLoading(false) })
  }, [])

  if (loading) return <div className="loading"><div className="spin" />Loading your briefing…</div>
  if (error) return <div className="error-msg">{error}</div>

  const { overdueContacts, recentLogs, activeItems, weekStats } = data

  // Find yesterday's entry using the browser's local timezone
  const todayStr = new Date().toDateString()
  const yesterdayStr = new Date(Date.now() - 864e5).toDateString()
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const yesterdayLog = recentLogs?.find(l =>
    l._createdTime && new Date(l._createdTime).toDateString() === yesterdayStr
  )
  const yesterdayTop3 = yesterdayLog?.["Tomorrow's Top 3"] || null
  const top3Lines = yesterdayTop3 ? yesterdayTop3.split('\n').filter(Boolean) : []

  return (
    <div>
      <div className="morning-greeting">Good morning, Jason.</div>
      <div className="today-date">{todayDate}</div>

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
