import { useState, useEffect, useRef } from 'react'

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

function emptyForm(defaults = {}) {
  return {
    Company: '', Role: '', Stage: '🔍 Researching', Priority: '', Sector: '',
    'Job URL': '', 'Salary Range': '', 'Date Applied': '', 'Follow-Up Date': '',
    'Contact Name': '', 'Contact Title': '', 'Outreach Method': '', 'Resume Version': '',
    'Company Address': '', 'Company Phone': '', Notes: '',
    ...defaults
  }
}

function PipelineForm({ form, set }) {
  return (
    <>
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
        <div className="field"><label>Company Address</label><input value={form['Company Address']} onChange={e => set('Company Address', e.target.value)} placeholder="123 Main St, City, ST" /></div>
        <div className="field"><label>Company Phone</label><input type="tel" value={form['Company Phone']} onChange={e => set('Company Phone', e.target.value)} placeholder="(555) 555-5555" /></div>
      </div>
      <div className="field"><label>Job URL</label><input value={form['Job URL']} onChange={e => set('Job URL', e.target.value)} placeholder="https://…" /></div>
      <div className="field"><label>Notes</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} /></div>
    </>
  )
}

function AddModal({ onClose, onSave }) {
  const [form, setForm] = useState(emptyForm())
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
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">Add to Pipeline</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <PipelineForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add to Pipeline'}</button>
        </div>
      </div>
    </div>
  )
}

function CardModal({ card, onClose, onUpdate }) {
  const [form, setForm] = useState(emptyForm({
    Company: card.Company || '',
    Role: card.Role || '',
    Stage: card.Stage || '🔍 Researching',
    Priority: card.Priority || '',
    Sector: card.Sector || '',
    'Job URL': card['Job URL'] || '',
    'Salary Range': card['Salary Range'] || '',
    'Date Applied': card['Date Applied'] || '',
    'Follow-Up Date': card['Follow-Up Date'] || '',
    'Contact Name': card['Contact Name'] || '',
    'Contact Title': card['Contact Title'] || '',
    'Outreach Method': card['Outreach Method'] || '',
    'Resume Version': card['Resume Version'] || '',
    'Company Address': card['Company Address'] || '',
    'Company Phone': card['Company Phone'] || '',
    Notes: card.Notes || ''
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/pipeline/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onUpdate(card.id, form)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{card.Company}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Saved to Notion!</div>}
        <PipelineForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
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
  const dragCard = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  function load() {
    setLoading(true)
    fetch('/api/pipeline', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  function handleUpdate(id, updatedFields) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedFields } : item))
  }

  // ─── Drag and drop ───────────────────────────────────

  function onDragStart(e, card) {
    dragCard.current = card
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, stage) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(stage)
  }

  function onDragLeave() {
    setDragOver(null)
  }

  async function onDrop(e, stage) {
    e.preventDefault()
    setDragOver(null)
    const card = dragCard.current
    if (!card || card.Stage === stage) return

    // Optimistic update
    setItems(prev => prev.map(item => item.id === card.id ? { ...item, Stage: stage } : item))

    await fetch(`/api/pipeline/${card.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stage })
    })
    dragCard.current = null
  }

  // ─── Render ──────────────────────────────────────────

  const visible = filter === 'all' ? items
    : filter === 'active' ? items.filter(i => !i.Stage?.includes('Closed'))
    : items.filter(i => i.Stage === filter)

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = visible.filter(i => i.Stage === s)
    return acc
  }, {})

  const visibleStages = filter === 'all' ? STAGES
    : filter === 'active' ? STAGES.filter(s => !s.includes('Closed'))
    : STAGES // show all columns so you can drop into any stage

  if (loading) return <div className="loading"><div className="spin" /> Loading pipeline…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between pipeline-header-row">
          <div>
            <h1>Job Pipeline</h1>
            <div className="subtitle">{items.length} total · {items.filter(i => !i.Stage?.includes('Closed')).length} active</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')}>Active</button>
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {['💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing'].map(s => (
          <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="kanban-scroll">
        <div className="kanban">
          {visibleStages.map(stage => {
            const cards = byStage[stage] || []
            const isOver = dragOver === stage
            return (
              <div
                key={stage}
                className="kanban-col"
                style={{ borderColor: isOver ? 'var(--accent)' : undefined, background: isOver ? 'var(--accent-dim)' : undefined, transition: 'border-color 0.15s, background 0.15s' }}
                onDragOver={e => onDragOver(e, stage)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, stage)}
              >
                <div className="kanban-col-header">
                  <span style={{ color: stageHeaderColor(stage) }}>{stage}</span>
                  <span className="kanban-count">{cards.length}</span>
                </div>
                {cards.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0', textAlign: 'center' }}>
                    {isOver ? 'Drop here' : 'Empty'}
                  </div>
                )}
                {cards.map(card => (
                  <div
                    key={card.id}
                    className="kanban-card"
                    draggable
                    onDragStart={e => onDragStart(e, card)}
                    onClick={() => setSelected(card)}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="kanban-card-company">{card.Company}</div>
                    {card.Role && <div className="kanban-card-role">{card.Role}</div>}
                    <div className="kanban-card-meta">
                      {card.Priority && <span className={`badge ${priorityColor(card.Priority)}`} style={{ fontSize: 10 }}>{card.Priority}</span>}
                      {card['Follow-Up Date'] && <span className="text-muted text-sm">↩ {card['Follow-Up Date']}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <CardModal
          card={selected}
          onClose={() => setSelected(null)}
          onUpdate={(id, fields) => { handleUpdate(id, fields); setSelected(null) }}
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
