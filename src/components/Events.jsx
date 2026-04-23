import { useState, useEffect } from 'react'

const STATUSES = ['Interested', 'Registered', 'Attended', 'Skipped']

function statusColor(s) {
  if (s === 'Registered') return 'badge-green'
  if (s === 'Attended') return 'badge-purple'
  if (s === 'Skipped') return 'badge-gray'
  return 'badge-blue' // Interested
}

function isUpcoming(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) >= new Date(new Date().toDateString())
}

function emptyForm(defaults = {}) {
  return {
    Name: '', Date: '', Price: '', Status: 'Interested',
    'Registration Link': '', Notes: '',
    ...defaults
  }
}

function EventForm({ form, set }) {
  return (
    <>
      <div className="checkin-grid">
        <div className="field"><label>Event Name *</label><input value={form.Name} onChange={e => set('Name', e.target.value)} /></div>
        <div className="field"><label>Date</label><input type="date" value={form.Date} onChange={e => set('Date', e.target.value)} /></div>
        <div className="field"><label>Status</label><select value={form.Status} onChange={e => set('Status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Price</label><input value={form.Price} onChange={e => set('Price', e.target.value)} placeholder="e.g. Free, $25, $150" /></div>
      </div>
      <div className="field"><label>Registration Link</label><input value={form['Registration Link']} onChange={e => set('Registration Link', e.target.value)} placeholder="https://…" /></div>
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
    if (!form.Name) { setError('Event name is required'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/events', {
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
          <span className="modal-title">Add Event</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <EventForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Event'}</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ event, onClose, onUpdate }) {
  const [form, setForm] = useState(emptyForm({
    Name: event.Name || '',
    Date: event.Date || '',
    Price: event.Price || '',
    Status: event.Status || 'Interested',
    'Registration Link': event['Registration Link'] || '',
    Notes: event.Notes || ''
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/events/${event.id}`, {
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{event.Name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Saved!</div>}
        <EventForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Events() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('upcoming')

  function load() {
    setLoading(true)
    fetch('/api/events', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = filter === 'upcoming'
    ? items.filter(i => isUpcoming(i.Date) && i.Status !== 'Skipped')
    : filter === 'registered'
    ? items.filter(i => i.Status === 'Registered')
    : items

  const upcomingCount = items.filter(i => isUpcoming(i.Date) && i.Status !== 'Skipped').length

  if (loading) return <div className="loading"><div className="spin" /> Loading events…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Events</h1>
            <div className="subtitle">{items.length} total · {upcomingCount} upcoming</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${filter === 'upcoming' ? ' active' : ''}`} onClick={() => setFilter('upcoming')}>
          Upcoming {upcomingCount > 0 && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>({upcomingCount})</span>}
        </button>
        <button className={`tab${filter === 'registered' ? ' active' : ''}`} onClick={() => setFilter('registered')}>Registered</button>
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🗓️</div>
            <p>{filter === 'upcoming' ? 'No upcoming events.' : 'No events match this filter.'}</p>
          </div>
        ) : (
          filtered.map(e => (
            <div key={e.id} className="contact-row" onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
              <div className="contact-info">
                <div className="contact-name">{e.Name}</div>
                <div className="contact-meta">
                  {[e.Date, e.Price].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="contact-actions">
                {e['Registration Link'] && (
                  <a href={e['Registration Link']} target="_blank" rel="noreferrer"
                    onClick={ev => ev.stopPropagation()}
                    className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                    Register ↗
                  </a>
                )}
                <span className={`badge ${statusColor(e.Status)}`}>{e.Status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <EditModal
          event={selected}
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
