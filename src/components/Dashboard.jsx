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
      <div className="stat-target">Target: {target}/week</div>
      <div style={{ marginTop: 8, height: 4, background: 'var(--surface2)', borderRadius: 99 }}>
        <div style={{ width: `${p}%`, height: '100%', background: `var(--${color || 'accent'})`, borderRadius: 99, transition: 'width 0.4s' }} />
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

  if (loading) return <div className="loading"><div className="spin" /> Loading your briefing…</div>
  if (error) return <div className="error-msg">{error}</div>

  const { overdueContacts, yesterdayTop3, activeItems, weekStats, todayDate } = data
  const top3Lines = yesterdayTop3
    ? yesterdayTop3.split('\n').filter(Boolean)
    : []

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
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            No Top 3 logged yesterday.{' '}
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
            <div key={c.id} className="contact-row" style={{ padding: '8px 0' }}>
              <div className="contact-avatar">{(c.Name || '?')[0].toUpperCase()}</div>
              <div className="contact-info">
                <div className="contact-name">{c.Name}</div>
                <div className="contact-meta">
                  {c.Title && `${c.Title} `}{c.Company && `@ ${c.Company}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${warmthColor(c.Warmth)}`}>{c.Warmth?.split('—')[0].trim()}</span>
                {c['Next Follow-Up'] && (
                  <span className="overdue-badge">Due {c['Next Follow-Up']}</span>
                )}
              </div>
            </div>
          ))}
          {overdueContacts.length > 5 && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('contacts')}>
                +{overdueContacts.length - 5} more → View all outreach
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
            <div key={item.id} className="contact-row" style={{ padding: '8px 0' }}>
              <div className="contact-info">
                <div className="contact-name">{item.Company}</div>
                <div className="contact-meta">{item.Role}</div>
              </div>
              <span className={`badge ${stageColor(item.Stage)}`}>{item.Stage}</span>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('pipeline')}>
              View full pipeline →
            </button>
          </div>
        </div>
      )}

      {/* This week's numbers */}
      <div style={{ marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>This Week's Numbers</div>
        <div className="dashboard-grid thirds">
          <StatCard label="Outreach Sent" value={weekStats.outreach} target={WEEKLY_TARGETS.outreach} color="accent" />
          <StatCard label="Responses" value={weekStats.responses} target={WEEKLY_TARGETS.responses} color="green" />
          <StatCard label="Applications" value={weekStats.applications} target={WEEKLY_TARGETS.applications} color="yellow" />
          <StatCard label="LinkedIn Posts" value={weekStats.linkedInPosts} target={WEEKLY_TARGETS.linkedInPosts} color="purple" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('checkin')}>✅ Log Today</button>
          <button className="btn btn-ghost" onClick={() => onNavigate('contacts')}>👥 Outreach Queue</button>
          <button className="btn btn-ghost" onClick={() => onNavigate('pipeline')}>🎯 Pipeline</button>
        </div>
      </div>
    </div>
  )
}
