import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../ui-icons.jsx'

const STATUS_OPTIONS = ['Need to reach out', 'Waiting on response', 'In conversation', 'Referred me', 'Gone cold']
const WARMTH_OPTIONS = ['🔥 Hot — active convo', '☀️ Warm — responded', '❄️ Cold — no contact yet']
const HOW_OPTIONS = ['Former IBM colleague', 'Former Blue Box', 'YearUp / Nonprofit', 'LinkedIn cold outreach', 'Event / Meetup', 'Referral', 'Recruiter']

const FILTERS = [
  { key: 'due', label: 'Needs follow-up' },
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Hot/Warm' },
  { key: 'cold', label: 'Cold' },
]

function warmthDot(w) {
  if (w?.includes('Hot')) return 'oklch(0.58 0.22 25)'
  if (w?.includes('Warm')) return 'oklch(0.70 0.15 50)'
  return 'oklch(0.60 0.10 240)'
}

function warmthChip(w) {
  if (w?.includes('Hot')) return 'chip chip-red'
  if (w?.includes('Warm')) return 'chip chip-amber'
  return 'chip chip-line'
}

function statusChip(s) {
  if (s === 'In conversation') return 'chip chip-green'
  if (s === 'Waiting on response') return 'chip chip-amber'
  if (s === 'Referred me') return 'chip chip-line'
  if (s === 'Gone cold') return 'chip chip-gray'
  return 'chip chip-gray'
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
    Email: '', Phone: '', 'Resume Used': '', Notes: '', 'Next Action': '', 'Next Action Date': '',
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
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Set this so the contact appears in "Due" when it's time.</div>
        </div>
        <div className="field"><label>LinkedIn URL</label><input value={form['LinkedIn URL']} onChange={e => set('LinkedIn URL', e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
      </div>
      <div className="field"><label>Resume / Cover Letter Used</label><input value={form['Resume Used']} onChange={e => set('Resume Used', e.target.value)} placeholder="e.g. CS General + Healthcare tailored CL" /></div>
      <div className="checkin-grid">
        <div className="field"><label>Next Action</label><input value={form['Next Action']} onChange={e => set('Next Action', e.target.value)} placeholder="What is the next outreach step?" /></div>
        <div className="field"><label>Next Action Date</label><input type="date" value={form['Next Action Date']} onChange={e => set('Next Action Date', e.target.value)} /></div>
      </div>
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
    Notes: contact.Notes || '',
    'Next Action': contact['Next Action'] || '',
    'Next Action Date': contact['Next Action Date'] || ''
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

function ContactDetail({ contact, onEdit, onUpdated }) {
  const [nextFollowUp, setNextFollowUp] = useState('')
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(false)

  async function markContacted() {
    setMarking(true)
    await fetch(`/api/contacts/${contact.id}/contacted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nextFollowUp: nextFollowUp || undefined })
    })
    setMarking(false)
    setMarked(true)
    onUpdated()
  }

  const dot = warmthDot(contact.Warmth)
  const initials = (contact.Name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const due = isOverdue(contact['Next Follow-Up'])
  const wLabel = (contact.Warmth || '').split('—')[0].trim().replace(/[🔥☀️❄️\s]+/g, ' ').trim()

  return (
    <div className="or-detail">
      <div className="det-head">
        <div className="det-avatar" style={{ background: `color-mix(in oklch, ${dot} 16%, transparent)`, color: dot }}>
          {initials}
          <i className="cc-warm-dot" style={{ background: dot, width: 16, height: 16 }} />
        </div>
        <div className="det-id">
          <div className="det-name">{contact.Name}</div>
          <div className="det-title">{contact.Title}{contact.Company ? ` · ${contact.Company}` : ''}</div>
          <div className="det-chips">
            <span className={warmthChip(contact.Warmth)}>{wLabel}</span>
            <span className={statusChip(contact.Status)}>{contact.Status || 'No status'}</span>
          </div>
        </div>
      </div>

      <div className="det-body">
        <div className="det-block">
          <div className="db-label">Details</div>
          <div className="det-meta">
            {contact['How We Know Each Other'] && (
              <div className="meta-item"><Icon name="users" /><span>{contact['How We Know Each Other']}</span></div>
            )}
            <div className="meta-item">
              <Icon name="clock" />
              <span style={{ color: due ? 'var(--red)' : 'inherit' }}>
                {contact['Next Follow-Up']
                  ? (due ? `Overdue: ${contact['Next Follow-Up']}` : `Follow-up: ${contact['Next Follow-Up']}`)
                  : 'No follow-up set'}
              </span>
            </div>
            {contact['Next Action'] && (
              <div className="meta-item"><Icon name="corner-down-right" /><span>{contact['Next Action']}</span></div>
            )}
          </div>
        </div>

        {contact.Notes && (
          <div className="det-block">
            <div className="db-label">Notes</div>
            <div className="last-note">{contact.Notes}</div>
          </div>
        )}

        <div className="det-block">
          <div className="db-label">Mark contacted — set next follow-up</div>
          <input
            type="date"
            className="ci-input"
            style={{ width: '100%', marginTop: 6 }}
            value={nextFollowUp}
            onChange={e => setNextFollowUp(e.target.value)}
          />
        </div>
      </div>

      <div className="det-foot">
        <button
          className={`btn btn-primary${marked ? ' btn-saved' : ''}`}
          onClick={markContacted}
          disabled={marking || marked}
        >
          <Icon name={marked ? 'check' : 'send'} /> {marked ? 'Logged' : 'Mark contacted'}
        </button>
        <button className="btn btn-ghost btn-icon" onClick={onEdit} title="Edit contact">
          <Icon name="pen-line" />
        </button>
      </div>
    </div>
  )
}

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editContact, setEditContact] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('due')

  function load() {
    setLoading(true)
    fetch('/api/contacts', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setContacts(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = useMemo(() => contacts.filter(c => {
    if (filter === 'due') return isOverdue(c['Next Follow-Up']) && c.Status !== 'Gone cold' && c.Status !== 'Referred me'
    if (filter === 'hot') return c.Warmth?.includes('Hot') || c.Warmth?.includes('Warm')
    if (filter === 'cold') return c.Warmth?.includes('Cold')
    return true
  }), [contacts, filter])

  const dueCount = contacts.filter(c =>
    isOverdue(c['Next Follow-Up']) && c.Status !== 'Gone cold' && c.Status !== 'Referred me'
  ).length

  if (loading) return <div className="loading"><div className="spin" />Loading contacts…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Outreach</h1>
          <div className="sub">{contacts.length} CONTACTS · {dueCount} NEED FOLLOW-UP</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Icon name="user-plus" /> Add contact
        </button>
      </div>

      <div className="outreach-layout">
        <div className="or-list-col">
          {dueCount > 0 && (
            <div className="due-banner">
              <div className="db-ico"><Icon name="corner-down-right" /></div>
              <div className="db-body">
                <div className="db-title">{dueCount} {dueCount === 1 ? 'contact needs' : 'contacts need'} a follow-up</div>
                <div className="db-sub">Keep momentum — these feed your daily briefing.</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setFilter('due')}>Review</button>
            </div>
          )}

          <div className="or-toolbar">
            <div className="seg">
              {FILTERS.map(f => (
                <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="or-count">{filtered.length} shown</span>
          </div>

          <div className="or-list">
            {filtered.length === 0 ? (
              <div className="or-empty">
                <Icon name="check" />
                <div>{filter === 'due' ? 'All caught up — no follow-ups due.' : 'No contacts match this filter.'}</div>
              </div>
            ) : filtered.map(c => {
              const dot = warmthDot(c.Warmth)
              const initials = (c.Name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              const due = isOverdue(c['Next Follow-Up'])
              return (
                <button
                  key={c.id}
                  className={'contact-card' + (selected?.id === c.id ? ' sel' : '')}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                >
                  <div className="cc-avatar" style={{ background: `color-mix(in oklch, ${dot} 16%, transparent)`, color: dot }}>
                    {initials}
                    <i className="cc-warm-dot" style={{ background: dot }} />
                  </div>
                  <div className="cc-body">
                    <div className="cc-top"><span className="cc-name">{c.Name}</span></div>
                    <div className="cc-role">
                      {c.Title}
                      {c.Company ? <span className="cc-co"> · {c.Company}</span> : null}
                    </div>
                  </div>
                  <div className="cc-right">
                    <span className={'cc-due' + (due ? ' over' : '')}>{due ? 'Overdue' : (c['Next Follow-Up'] || 'No date')}</span>
                    <span className={statusChip(c.Status)}>{c.Status || '—'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selected ? (
          <ContactDetail
            key={selected.id}
            contact={selected}
            onEdit={() => setEditContact(selected)}
            onUpdated={() => { load(); setSelected(null) }}
          />
        ) : (
          <div className="or-detail">
            <div className="or-empty">
              <Icon name="users" />
              <div>Select a contact to see details.</div>
            </div>
          </div>
        )}
      </div>

      {editContact && (
        <ContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onUpdate={() => { load(); setEditContact(null); setSelected(null) }}
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
