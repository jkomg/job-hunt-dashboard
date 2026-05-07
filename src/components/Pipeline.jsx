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

const OUTCOMES = ['Rejected — No Interview', 'Rejected — After Interview', 'Ghosted', 'Withdrew', 'Offer Declined', 'Offer Accepted']

const PRIORITIES = ['🔥 Top Target', '⭐ Strong Fit', '📌 Worth a Shot']
const SECTORS = ['Healthcare Tech', 'Climate / Clean Energy', 'AI/ML Platform', 'EdTech', 'Social Impact', 'Other']
const JOB_SOURCES = ['LinkedIn', 'Indeed', 'Company Website', 'Referral', 'Recruiter', 'Glassdoor', 'Wellfound', 'Hacker News', 'Remote.co', 'Remote Rebellion', 'Welcome to the Jungle', 'Other']
const OUTREACH_METHODS = ['LinkedIn DM', 'Email', 'Referral', 'Cold Application', 'Recruiter']
const RESUME_VERSIONS = ['CS General', 'Tailored']
const WORK_LOCATIONS = ['In-Office', 'Hybrid', 'Remote (State)', 'Remote (Country)', 'Remote-First']

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
    'Job Source': '', 'Job URL': '', 'Salary Range': '', 'Date Applied': '', 'Follow-Up Date': '',
    'Contact Name': '', 'Contact Title': '', 'Outreach Method': '', 'Resume Version': '',
    'Company Address': '', 'Company Phone': '', Notes: '', 'Research Notes': '',
    'Filed for Unemployment': false, Outcome: '', 'Resume URL': '', 'Cover Letter': '', 'Work Location': '',
    'Next Action': '', 'Next Action Date': '',
    'Application Contacts': [],
    ...defaults
  }
}

function PipelineForm({ form, set }) {
  const contacts = Array.isArray(form['Application Contacts']) ? form['Application Contacts'] : []
  function applyContacts(next) {
    const normalized = (next || [])
      .slice(0, 3)
      .map(c => ({
        name: c?.name || '',
        title: c?.title || '',
        email: c?.email || '',
        linkedinUrl: c?.linkedinUrl || '',
        note: c?.note || ''
      }))
    set('Application Contacts', normalized)
    set('Contact Name', normalized[0]?.name || '')
    set('Contact Title', normalized[0]?.title || '')
  }
  function updateContact(idx, key, value) {
    const next = contacts.map((c, i) => i === idx ? { ...c, [key]: value } : c)
    applyContacts(next)
  }
  function addContact() {
    applyContacts([...contacts, { name: '', title: '', email: '', linkedinUrl: '', note: '' }])
  }
  function removeContact(idx) {
    applyContacts(contacts.filter((_, i) => i !== idx))
  }

  return (
    <>
      <div className="checkin-grid">
        <div className="field"><label>Company *</label><input value={form.Company} onChange={e => set('Company', e.target.value)} /></div>
        <div className="field"><label>Role</label><input value={form.Role} onChange={e => set('Role', e.target.value)} /></div>
        <div className="field">
          <label>Stage</label>
          <select value={form.Stage} onChange={e => set('Stage', e.target.value)}>{STAGES.map(s => <option key={s}>{s}</option>)}</select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tip: move to “Closed” only when this role is done.</div>
        </div>
        <div className="field"><label>Priority</label><select value={form.Priority} onChange={e => set('Priority', e.target.value)}><option value="">—</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
        <div className="field"><label>Sector</label><select value={form.Sector} onChange={e => set('Sector', e.target.value)}><option value="">—</option>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Salary Range</label><input value={form['Salary Range']} onChange={e => set('Salary Range', e.target.value)} placeholder="e.g. $130k–$160k" /></div>
        <div className="field"><label>Date Applied</label><input type="date" value={form['Date Applied']} onChange={e => set('Date Applied', e.target.value)} /></div>
        <div className="field">
          <label>Follow-Up Date</label>
          <input type="date" value={form['Follow-Up Date']} onChange={e => set('Follow-Up Date', e.target.value)} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Use this to surface reminders in your briefing.</div>
        </div>
        <div className="field"><label>Work Location</label><select value={form['Work Location']} onChange={e => set('Work Location', e.target.value)}><option value="">—</option>{WORK_LOCATIONS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label>Job Source</label><select value={form['Job Source']} onChange={e => set('Job Source', e.target.value)}><option value="">—</option>{JOB_SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Outreach Method</label><select value={form['Outreach Method']} onChange={e => set('Outreach Method', e.target.value)}><option value="">—</option>{OUTREACH_METHODS.map(o => <option key={o}>{o}</option>)}</select></div>
        <div className="field"><label>Resume Version</label><select value={form['Resume Version']} onChange={e => set('Resume Version', e.target.value)}><option value="">—</option>{RESUME_VERSIONS.map(v => <option key={v}>{v}</option>)}</select></div>
        {form['Resume Version'] === 'Tailored' && (
          <>
            <div className="field"><label>Resume URL</label><input value={form['Resume URL']} onChange={e => set('Resume URL', e.target.value)} placeholder="https://docs.google.com/…" /></div>
            <div className="field"><label>Cover Letter</label><input value={form['Cover Letter']} onChange={e => set('Cover Letter', e.target.value)} placeholder="https://docs.google.com/… or notes" /></div>
          </>
        )}
        <div className="field"><label>Company Address</label><input value={form['Company Address']} onChange={e => set('Company Address', e.target.value)} placeholder="123 Main St, City, ST" /></div>
        <div className="field"><label>Company Phone</label><input type="tel" value={form['Company Phone']} onChange={e => set('Company Phone', e.target.value)} placeholder="(555) 555-5555" /></div>
      </div>

      <div className="field">
        <label>Application Contacts (up to 3)</label>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Add recruiter/hiring manager/referral contacts with LinkedIn or email to complete an application.
        </div>
        {!contacts.length && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>No contacts added yet.</div>
        )}
        {contacts.map((contact, idx) => (
          <div key={`contact-${idx}`} className="card" style={{ marginBottom: 8 }}>
            <div className="quick-actions" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>Contact {idx + 1}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeContact(idx)}>Remove</button>
            </div>
            <div className="checkin-grid">
              <div className="field"><label>Name</label><input value={contact.name} onChange={e => updateContact(idx, 'name', e.target.value)} /></div>
              <div className="field"><label>Title / Role</label><input value={contact.title} onChange={e => updateContact(idx, 'title', e.target.value)} /></div>
              <div className="field"><label>Email</label><input value={contact.email} onChange={e => updateContact(idx, 'email', e.target.value)} /></div>
              <div className="field"><label>LinkedIn URL</label><input value={contact.linkedinUrl} onChange={e => updateContact(idx, 'linkedinUrl', e.target.value)} /></div>
            </div>
            <div className="field"><label>Contact Note</label><input value={contact.note} onChange={e => updateContact(idx, 'note', e.target.value)} placeholder="Context for this contact" /></div>
          </div>
        ))}
        {contacts.length < 3 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={addContact}>+ Add Contact</button>
        )}
      </div>

      <div className="field"><label>Job URL</label><input value={form['Job URL']} onChange={e => set('Job URL', e.target.value)} placeholder="https://…" /></div>
      <div className="field"><label>Notes</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} /></div>
      <div className="field"><label>Research Notes</label><textarea value={form['Research Notes']} onChange={e => set('Research Notes', e.target.value)} placeholder="Company background, culture, products, interview prep…" /></div>
      <div className="checkin-grid">
        <div className="field"><label>Next Action</label><input value={form['Next Action']} onChange={e => set('Next Action', e.target.value)} placeholder="What should happen next for this job?" /></div>
        <div className="field"><label>Next Action Date</label><input type="date" value={form['Next Action Date']} onChange={e => set('Next Action Date', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <input type="checkbox" id="filed-ue" checked={!!form['Filed for Unemployment']} onChange={e => set('Filed for Unemployment', e.target.checked)} style={{ width: 16, height: 16, margin: 0, appearance: 'auto', flexShrink: 0 }} />
        <label htmlFor="filed-ue" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer', margin: 0 }}>Filed for Unemployment</label>
      </div>
      {form.Stage === '❌ Closed' && (
        <div className="field">
          <label>Outcome</label>
          <select value={form.Outcome} onChange={e => set('Outcome', e.target.value)}>
            <option value="">— Select outcome —</option>
            {OUTCOMES.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      )}
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
    'Job Source': card['Job Source'] || '',
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
    Notes: card.Notes || '',
    'Research Notes': card['Research Notes'] || '',
    'Filed for Unemployment': card['Filed for Unemployment'] || false,
    Outcome: card.Outcome || '',
    'Resume URL': card['Resume URL'] || '',
    'Cover Letter': card['Cover Letter'] || '',
    'Work Location': card['Work Location'] || '',
    'Next Action': card['Next Action'] || '',
    'Next Action Date': card['Next Action Date'] || '',
    'Application Contacts': Array.isArray(card['Application Contacts']) ? card['Application Contacts'] : []
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
        {saved && <div className="success-msg">Saved!</div>}
        <PipelineForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline({ navIntent }) {
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

  useEffect(() => {
    if (!navIntent) return
    if (navIntent.mode === 'due_followups') setFilter('due_followups')
    if (navIntent.mode === 'stale_actions') setFilter('stale_actions')
  }, [navIntent])

  useEffect(() => {
    if (!navIntent?.focusId) return
    const hit = items.find(i => i.id === navIntent.focusId)
    if (hit) setSelected(hit)
  }, [navIntent, items])

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

  const today = new Date().toISOString().slice(0, 10)
  const getDueDate = (i) => {
    const nextActionDate = String(i['Next Action Date'] || '').trim()
    if (nextActionDate) return nextActionDate
    return String(i['Follow-Up Date'] || '').trim()
  }
  const getDueSourceLabel = (i) => {
    const nextActionDate = String(i['Next Action Date'] || '').trim()
    if (nextActionDate) return `Next Action Date: ${nextActionDate}`
    const followUpDate = String(i['Follow-Up Date'] || '').trim()
    if (followUpDate) return `Follow-Up Date: ${followUpDate}`
    return ''
  }
  const isDueFollowup = (i) => {
    const due = getDueDate(i)
    if (!due) return false
    if (i.Stage?.includes('Closed')) return false
    return due <= today
  }
  const isStaleAction = (i) => {
    if (i.Stage?.includes('Closed')) return false
    return !String(i['Next Action'] || '').trim() || !String(i['Next Action Date'] || '').trim()
  }
  const isIncompleteApplication = (i) => {
    if (i.Stage?.includes('Closed')) return false
    const stage = String(i.Stage || '')
    const applyingStages = new Set(['📨 Applied', '🤝 Warm Outreach Sent', '💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing', '📋 Offer'])
    if (!applyingStages.has(stage)) return false
    const hasDateApplied = !!String(i['Date Applied'] || '').trim()
    const hasNextAction = !!String(i['Next Action'] || '').trim()
    const hasNextActionDate = !!String(i['Next Action Date'] || '').trim()
    const hasJobUrl = !!String(i['Job URL'] || '').trim()
    const contacts = Array.isArray(i['Application Contacts']) ? i['Application Contacts'] : []
    const hasContact = contacts.some(c => String(c?.name || '').trim() && (String(c?.linkedinUrl || '').trim() || String(c?.email || '').trim()))
      || (!!String(i['Contact Name'] || '').trim() && !!(String(i['Contact Title'] || '').trim()))
    return !(hasDateApplied && hasNextAction && hasNextActionDate && hasJobUrl && hasContact)
  }

  const visible = filter === 'all' ? items
    : filter === 'active' ? items.filter(i => !i.Stage?.includes('Closed'))
    : filter === 'due_followups' ? items.filter(isDueFollowup)
    : filter === 'incomplete' ? items.filter(isIncompleteApplication)
    : filter === 'stale_actions' ? items.filter(isStaleAction)
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
        <button className={`tab${filter === 'due_followups' ? ' active' : ''}`} onClick={() => setFilter('due_followups')}>Due Follow-ups</button>
        <button className={`tab${filter === 'incomplete' ? ' active' : ''}`} onClick={() => setFilter('incomplete')}>Incomplete Applications</button>
        <button className={`tab${filter === 'stale_actions' ? ' active' : ''}`} onClick={() => setFilter('stale_actions')}>Missing Next Action</button>
        {['💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing'].map(s => (
          <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="card mb-16">
          <div className="card-title">Start Your Pipeline</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 10 }}>
            Add your first role to track status, notes, and follow-up dates.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add First Role</button>
        </div>
      )}

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
                    {card['Next Action'] && (
                      <div className="kanban-card-role" style={{ color: 'var(--text)', marginBottom: 6 }}>
                        Next: {card['Next Action']}
                        {card['Next Action Date'] ? ` (${card['Next Action Date']})` : ''}
                      </div>
                    )}
                    <div className="kanban-card-meta">
                      {card.Priority && <span className={`badge ${priorityColor(card.Priority)}`} style={{ fontSize: 10 }}>{card.Priority}</span>}
                      {card['Follow-Up Date'] && <span className="text-muted text-sm">↩ {card['Follow-Up Date']}</span>}
                      {filter === 'due_followups' && getDueSourceLabel(card) && (
                        <span className="badge badge-blue" style={{ fontSize: 10 }}>{getDueSourceLabel(card)}</span>
                      )}
                      {card['Filed for Unemployment'] && <span className="badge badge-gray" style={{ fontSize: 10 }}>✓ UE Filed</span>}
                      {isIncompleteApplication(card) && <span className="badge badge-yellow" style={{ fontSize: 10 }}>Incomplete</span>}
                      {card.Outcome && <span className={`badge ${card.Outcome.includes('Accepted') ? 'badge-green' : card.Outcome.includes('Withdrew') ? 'badge-gray' : 'badge-red'}`} style={{ fontSize: 10 }}>{card.Outcome}</span>}
                      {card['Work Location'] && <span className={`badge ${card['Work Location'].startsWith('Remote') ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 10 }}>{card['Work Location']}</span>}
                      {card['Resume Version'] === 'Tailored' && card['Resume URL'] && (
                        <a href={card['Resume URL']} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }} title="View tailored resume">📄 Resume</a>
                      )}
                      {card['Resume Version'] === 'Tailored' && card['Cover Letter'] && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={card['Cover Letter']}>✉️ Cover Letter</span>
                      )}
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
