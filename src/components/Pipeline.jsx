import { useState, useEffect } from 'react'

const STAGES = [
  '🔍 Researching',
  '📨 Applied',
  '🤝 Warm Outreach Sent',
  '💬 In Conversation',
  '📞 Interview Scheduled',
  '🎯 Interviewing',
  '📋 Offer',
  '❌ Closed'
]

const PRIORITIES = ['🔥 Top Target', '⭐ Strong Fit', '📌 Worth a Shot']
const SECTORS = ['Healthcare Tech', 'Climate / Clean Energy', 'AI/ML Platform', 'EdTech', 'Social Impact', 'Other']
const OUTREACH_METHODS = ['LinkedIn DM', 'Email', 'Referral', 'Cold Application', 'Recruiter']
const RESUME_VERSIONS = ['CS General', 'Tailored']

function priorityColor(p) {
  if (p?.includes('Top')) return 'badge-red'
  if (p?.includes('Strong')) return 'badge-yellow'
  return 'badge-gray'
}

function stageHeaderColor(stage) {
  if (stage.includes('Conversation')) return 'var(--yellow)'
  if (stage.includes('Interview Scheduled')) return 'var(--orange)'
  if (stage.includes('Interviewing')) return 'var(--red)'
  if (stage.includes('Offer')) return 'var(--green)'
  if (stage.includes('Closed')) return 'var(--text-muted)'
  return 'var(--text-muted)'
}

function AddModal({ onClose, onSave }) {
  const [form, setForm] = useState({ Company: '', Role: '', Stage: '🔍 Researching', Priority: '', Sector: '', 'Job URL': '', 'Salary Range': '', 'Date Applied': '', 'Follow-Up Date': '', 'Contact Name': '', 'Contact Title': '', 'Outreach Method': '', 'Resume Version': '', Notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.Company) { setError('Company is required'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      if (!r.ok) throw new Error((await r.json()).error)
      onSave()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add to Pipeline</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="checkin-grid">
          <div className="field"><label>Company *</label><input value={form.Company} onChange={e => set('Company', e.target.value)} /></div>
          <div className="field"><label>Role</label><input value={form.Role} onChange={e => set('Role', e.target.value)} /></div>
          <div className="field"><label>Stage</label><select value={form.Stage} onChange={e => set('Stage', e.target.value)}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="field"><label>Priority</label><select value={form.Priority} onChange={e => set('Priority', e.target.value)}><option value="">—</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div className="field"><label>Sector</label><select value={form.Sector} onChange={e => set('Sector', e.target.value)}><option value="">—</option>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="field"><label>Salary Range</label><input value={form['Salary Range']} onChange={e => set('Salary Range', e.target.value)} placeholder="e.g. $130k–$160k" /></div>
          <div className="field"><label>Date Applied</label><input type="date" value={form['Date Applied']} onChange={e => set('Date Applied', e.target.value)} /></div>
          <div className="field"><label>Follow-Up Date</label><input type="date" value={form['Follow-Up Date']} onChange={e => set('Follow-Up Date', e.target.value)} /></div>
          <div className="field"><label>Contact Name</label><input value={form['Contact Name']} onChange={e => set('Contact Name', e.target.value)} /></div>
          <div className="field"><label>Contact Title</label><input value={form['Contact Title']} onChange={e => set('Contact Title', e.target.value)} /></div>
          <div className="field"><label>Outreach Method</label><select value={form['Outreach Method']} onChange={e => set('Outreach Method', e.target.value)}><option value="">—</option>{OUTREACH_METHODS.map(o => <option key={o}>{o}</option>)}</select></div>
          <div className="field"><label>Resume Version</label><select value={form['Resume Version']} onChange={e => set('Resume Version', e.target.value)}><option value="">—</option>{RESUME_VERSIONS.map(v => <option key={v}>{v}</option>)}</select></div>
        </div>
        <div className="field"><label>Job URL</label><input value={form['Job URL']} onChange={e => set('Job URL', e.target.value)} placeholder="https://…" /></div>
        <div className="field"><label>Notes</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} /></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add to Pipeline'}</button>
        </div>
      </div>
    </div>
  )
}

function CardModal({ card, onClose, onStageChange }) {
  const [stage, setStage] = useState(card.Stage || '')
  const [saving, setSaving] = useState(false)

  async function applyStage() {
    setSaving(true)
    await fetch(`/api/pipeline/${card.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stage })
    })
    setSaving(false)
    onStageChange(card.id, stage)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{card.Company}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <table className="data-table" style={{ marginBottom: 16 }}>
          <tbody>
            {card.Role && <tr><td className="text-muted">Role</td><td>{card.Role}</td></tr>}
            {card.Priority && <tr><td className="text-muted">Priority</td><td><span className={`badge ${priorityColor(card.Priority)}`}>{card.Priority}</span></td></tr>}
            {card.Sector && <tr><td className="text-muted">Sector</td><td>{card.Sector}</td></tr>}
            {card['Salary Range'] && <tr><td className="text-muted">Salary</td><td>{card['Salary Range']}</td></tr>}
            {card['Date Applied'] && <tr><td className="text-muted">Applied</td><td>{card['Date Applied']}</td></tr>}
            {card['Follow-Up Date'] && <tr><td className="text-muted">Follow-up</td><td>{card['Follow-Up Date']}</td></tr>}
            {card['Contact Name'] && <tr><td className="text-muted">Contact</td><td>{card['Contact Name']}{card['Contact Title'] ? ` — ${card['Contact Title']}` : ''}</td></tr>}
            {card['Outreach Method'] && <tr><td className="text-muted">Outreach</td><td>{card['Outreach Method']}</td></tr>}
            {card['Resume Version'] && <tr><td className="text-muted">Resume</td><td>{card['Resume Version']}</td></tr>}
            {card['Job URL'] && <tr><td className="text-muted">URL</td><td><a href={card['Job URL']} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Open posting →</a></td></tr>}
            {card.Notes && <tr><td className="text-muted" style={{ verticalAlign: 'top' }}>Notes</td><td style={{ whiteSpace: 'pre-wrap' }}>{card.Notes}</td></tr>}
          </tbody>
        </table>

        <div className="field">
          <label>Move to stage</label>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={applyStage} disabled={saving || stage === card.Stage}>
            {saving ? 'Moving…' : 'Move Stage'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('active')

  function load() {
    setLoading(true)
    fetch('/api/pipeline', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  function handleStageChange(id, stage) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, Stage: stage } : item))
  }

  const ACTIVE_STAGES = STAGES.filter(s => !s.includes('Closed') && !s.includes('Offer'))
  const visible = filter === 'all' ? items : filter === 'active'
    ? items.filter(i => !i.Stage?.includes('Closed'))
    : items.filter(i => i.Stage === filter)

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = visible.filter(i => i.Stage === s)
    return acc
  }, {})

  if (loading) return <div className="loading"><div className="spin" /> Loading pipeline…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Job Pipeline</h1>
            <div className="subtitle">{items.length} total · {items.filter(i => !i.Stage?.includes('Closed')).length} active</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')}>Active</button>
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {['💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing'].map(s => (
          <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="kanban">
        {STAGES.filter(s => filter === 'all' || (filter === 'active' ? !s.includes('Closed') : s === filter || filter === 'active')).map(stage => {
          const cards = byStage[stage] || []
          return (
            <div key={stage} className="kanban-col">
              <div className="kanban-col-header">
                <span style={{ color: stageHeaderColor(stage) }}>{stage}</span>
                <span className="kanban-count">{cards.length}</span>
              </div>
              {cards.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Empty</div>
              )}
              {cards.map(card => (
                <div key={card.id} className="kanban-card" onClick={() => setSelected(card)}>
                  <div className="kanban-card-company">{card.Company}</div>
                  {card.Role && <div className="kanban-card-role">{card.Role}</div>}
                  <div className="kanban-card-meta">
                    {card.Priority && <span className={`badge ${priorityColor(card.Priority)} badge`} style={{ fontSize: 10 }}>{card.Priority}</span>}
                    {card['Follow-Up Date'] && (
                      <span className="text-muted text-sm">↩ {card['Follow-Up Date']}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {selected && (
        <CardModal
          card={selected}
          onClose={() => setSelected(null)}
          onStageChange={handleStageChange}
        />
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}
