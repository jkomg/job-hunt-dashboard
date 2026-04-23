import { useState, useEffect } from 'react'

const STATUS_OPTIONS = ['Need to reach out', 'Waiting on response', 'In conversation', 'Referred me', 'Gone cold']
const WARMTH_OPTIONS = ['🔥 Hot — active convo', '☀️ Warm — responded', '❄️ Cold — no contact yet']
const HOW_OPTIONS = ['Former IBM colleague', 'Former Blue Box', 'YearUp / Nonprofit', 'LinkedIn cold outreach', 'Event / Meetup', 'Referral', 'Recruiter']

function warmthColor(w) {
  if (w?.includes('Hot')) return 'badge-red'
  if (w?.includes('Warm')) return 'badge-orange'
  return 'badge-blue'
}

function statusColor(s) {
  if (s === 'In conversation') return 'badge-green'
  if (s === 'Waiting on response') return 'badge-yellow'
  if (s === 'Referred me') return 'badge-purple'
  if (s === 'Gone cold') return 'badge-gray'
  return 'badge-gray'
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) <= new Date()
}

function emptyContactForm(defaults = {}) {
  return {
    Name: '', Title: '', Company: '', Warmth: '❄️ Cold — no contact yet',
    Status: 'Need to reach out', 'How We Know Each Other': '',
    'LinkedIn URL': '', 'Next Follow-Up': '',
    Email: '', Phone: '', 'Resume Used': '', Notes: '',
    ...defaults
  }
}

function ContactForm({ form, set }) {
  return (
    <>
      <div className="checkin-grid">
        <div className="field"><label>Name *</label><input value={form.Name} onChange={e => set('Name', e.target.value)} /></div>
        <div className="field"><label>Title</label><input value={form.Title} onChange={e => set('Title', e.target.value)} /></div>
        <div className="field"><label>Company</label><input value={form.Company} onChange={e => set('Company', e.target.value)} /></div>
        <div className="field"><label>Email</label><input type="email" value={form.Email} onChange={e => set('Email', e.target.value)} placeholder="name@company.com" /></div>
        <div className="field"><label>Phone</label><input type="tel" value={form.Phone} onChange={e => set('Phone', e.target.value)} placeholder="(555) 555-5555" /></div>
        <div className="field"><label>Warmth</label><select value={form.Warmth} onChange={e => set('Warmth', e.target.value)}>{WARMTH_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
        <div className="field"><label>Status</label><select value={form.Status} onChange={e => set('Status', e.target.value)}>{STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
        <div className="field"><label>How We Know Each Other</label><select value={form['How We Know Each Other']} onChange={e => set('How We Know Each Other', e.target.value)}><option value="">—</option>{HOW_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
        <div className="field">
          <label>Next Follow-Up</label>
          <input type="date" value={form['Next Follow-Up']} onChange={e => set('Next Follow-Up', e.target.value)} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Set this so the contact appears in “Due” when it’s time.</div>
        </div>
        <div className="field"><label>LinkedIn URL</label><input value={form['LinkedIn URL']} onChange={e => set('LinkedIn URL', e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
      </div>
      <div className="field"><label>Resume / Cover Letter Used</label><input value={form['Resume Used']} onChange={e => set('Resume Used', e.target.value)} placeholder="e.g. CS General + Healthcare tailored CL" /></div>
      <div className="field"><label>Notes</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} /></div>
    </>
  )
}

function AddModal({ onClose, onSave }) {
  const [form, setForm] = useState(emptyContactForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.Name) { setError('Name is required'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/contacts', {
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
          <span className="modal-title">Add Contact</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <ContactForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Contact'}</button>
        </div>
      </div>
    </div>
  )
}

function ContactModal({ contact, onClose, onUpdate }) {
  const [form, setForm] = useState(emptyContactForm({
    Name: contact.Name || '',
    Title: contact.Title || '',
    Company: contact.Company || '',
    Warmth: contact.Warmth || '❄️ Cold — no contact yet',
    Status: contact.Status || 'Need to reach out',
    'How We Know Each Other': contact['How We Know Each Other'] || '',
    'LinkedIn URL': contact['LinkedIn URL'] || '',
    'Next Follow-Up': contact['Next Follow-Up'] || '',
    Email: contact.Email || '',
    Phone: contact.Phone || '',
    'Resume Used': contact['Resume Used'] || '',
    Notes: contact.Notes || ''
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [nextFollowUp, setNextFollowUp] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onUpdate()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function markContacted() {
    setSaving(true)
    await fetch(`/api/contacts/${contact.id}/contacted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nextFollowUp: nextFollowUp || undefined })
    })
    setSaving(false)
    onUpdate()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{contact.Name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Saved!</div>}

        <ContactForm form={form} set={set} />

        <hr className="divider" />

        <div className="field">
          <label>Mark as contacted — set next follow-up</label>
          <input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} />
        </div>
        <button className="btn btn-success" style={{ marginBottom: 16 }} onClick={markContacted} disabled={saving}>
          ✓ Mark Contacted
        </button>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('due')
  const [search, setSearch] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/contacts', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setContacts(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = contacts.filter(c => {
    const matchSearch = !search || `${c.Name} ${c.Company} ${c.Title}`.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'due') return isOverdue(c['Next Follow-Up']) && c.Status !== 'Gone cold' && c.Status !== 'Referred me'
    if (filter === 'hot') return c.Warmth?.includes('Hot') || c.Warmth?.includes('Warm')
    if (filter === 'cold') return c.Warmth?.includes('Cold')
    return true
  })

  const dueCount = contacts.filter(c => isOverdue(c['Next Follow-Up']) && c.Status !== 'Gone cold' && c.Status !== 'Referred me').length

  if (loading) return <div className="loading"><div className="spin" /> Loading contacts…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Outreach & Contacts</h1>
            <div className="subtitle">{contacts.length} contacts · {dueCount} follow-ups due</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      <div className="contacts-toolbar mb-16" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          className="search-input"
          placeholder="Search contacts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab${filter === 'due' ? ' active' : ''}`} onClick={() => setFilter('due')}>
            Due {dueCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 3 }}>({dueCount})</span>}
          </button>
          <button className={`tab${filter === 'hot' ? ' active' : ''}`} onClick={() => setFilter('hot')}>Hot/Warm</button>
          <button className={`tab${filter === 'cold' ? ' active' : ''}`} onClick={() => setFilter('cold')}>Cold</button>
          <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
        </div>
      </div>

      {contacts.length === 0 && (
        <div className="card mb-16">
          <div className="card-title">Build Your Network Tracker</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 10 }}>
            Add people you can contact for referrals, warm intros, and follow-ups.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add First Contact</button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <p>{filter === 'due' ? "No follow-ups due — you're caught up!" : 'No contacts match this filter'}</p>
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="contact-row" onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
              <div className="contact-avatar">{(c.Name || '?')[0].toUpperCase()}</div>
              <div className="contact-info">
                <div className="contact-name">{c.Name}</div>
                <div className="contact-meta">
                  {[c.Title, c.Company].filter(Boolean).join(' @ ')}
                  {c['How We Know Each Other'] && ` · ${c['How We Know Each Other']}`}
                </div>
              </div>
              <div className="contact-actions">
                {c['Next Follow-Up'] && (
                  <span className={isOverdue(c['Next Follow-Up']) ? 'overdue-badge' : 'text-muted text-sm'}>
                    {isOverdue(c['Next Follow-Up']) ? '🔔 ' : ''}
                    {c['Next Follow-Up']}
                  </span>
                )}
                <span className={`badge ${warmthColor(c.Warmth)}`}>{c.Warmth?.split('—')[0].trim()}</span>
                {c.Status && c.Status !== 'Need to reach out' && (
                  <span className={`badge ${statusColor(c.Status)}`}>{c.Status}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <ContactModal
          contact={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => { load(); setSelected(null) }}
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
