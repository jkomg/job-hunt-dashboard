import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../ui-icons.jsx'

const STATUSES = ['Interested', 'Registered', 'Attended', 'Skipped']
const FILTERS = ['Upcoming', 'Attended', 'All']

function statusChip(s) {
  if (s === 'Registered') return 'chip chip-green'
  if (s === 'Attended') return 'chip chip-line'
  if (s === 'Skipped') return 'chip chip-gray'
  return 'chip chip-blue'
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return Math.round((d - today) / 86400000)
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
        <div className="field">
          <label>Status</label>
          <select value={form.Status} onChange={e => set('Status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Use "Registered" to keep this in your active event list.</div>
        </div>
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

function EventRow({ e, sel, onSelect, onEdit }) {
  const days = daysUntil(e.Date)
  const shortDate = e.Date ? new Date(e.Date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

  return (
    <>
      <button className={'ev-row' + (sel ? ' sel' : '')} onClick={onSelect}>
        <span className="ev-type-dot" style={{ background: e.Status === 'Registered' ? 'var(--green)' : e.Status === 'Attended' ? 'var(--accent)' : 'var(--text-3)' }} />
        <div className="ev-row-body">
          <div className="ev-row-name">{e.Name}</div>
          <div className="ev-row-meta">
            {e.Price && <><span>{e.Price}</span><span className="sep">·</span></>}
            <span>{e.Status}</span>
          </div>
        </div>
        <div className="ev-row-right">
          <span className="ev-date">{shortDate}</span>
          <span className={statusChip(e.Status)}>{e.Status}</span>
        </div>
      </button>

      {sel && (
        <div className="ev-detail">
          <div className="ev-det-inner">
            {e.Date && (
              <div>
                <div className="ev-det-label">Date</div>
                <div className="ev-det-val">
                  {new Date(e.Date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {days !== null && <span style={{ color: days < 0 ? 'var(--red)' : days === 0 ? 'var(--amber)' : 'var(--text-3)', marginLeft: 8, fontSize: 12 }}>
                    {days < 0 ? `${-days}d ago` : days === 0 ? 'Today' : `In ${days}d`}
                  </span>}
                </div>
              </div>
            )}
            {e.Price && (
              <div>
                <div className="ev-det-label">Price</div>
                <div className={'ev-det-val' + (e.Price === 'Free' ? ' free' : '')}>{e.Price}</div>
              </div>
            )}
            {e.Notes && (
              <div className="ev-det-full">
                <div className="ev-det-label">Notes</div>
                <div className="ev-det-val">{e.Notes}</div>
              </div>
            )}
          </div>
          <div className="ev-det-foot">
            {e['Registration Link'] ? (
              <a href={e['Registration Link']} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <Icon name="external-link" /> Open link
              </a>
            ) : (
              <button className="btn btn-ghost btn-sm" disabled><Icon name="external-link" /> No link</button>
            )}
            <button className="btn btn-primary btn-sm ev-advance" onClick={onEdit}>
              <Icon name="pen-line" /> Edit
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function Events() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('Upcoming')
  const [selId, setSelId] = useState(null)

  function load() {
    setLoading(true)
    fetch('/api/events', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const registered = items.filter(i => i.Status === 'Registered').sort((a, b) => {
    const da = daysUntil(a.Date) ?? 9999
    const db = daysUntil(b.Date) ?? 9999
    return da - db
  })

  const list = useMemo(() => {
    return items.filter(i => {
      if (filter === 'Upcoming') return isUpcoming(i.Date) && i.Status !== 'Skipped'
      if (filter === 'Attended') return i.Status === 'Attended' || i.Status === 'Skipped'
      return true
    }).sort((a, b) => {
      const da = daysUntil(a.Date) ?? 9999
      const db = daysUntil(b.Date) ?? 9999
      return da - db
    })
  }, [items, filter])

  const groups = useMemo(() => {
    if (filter !== 'Upcoming') {
      return [{ label: filter === 'All' ? 'All events' : 'Past', items: list }]
    }
    const thisWeek = list.filter(e => { const d = daysUntil(e.Date); return d !== null && d >= 0 && d <= 7 })
    const thisMonth = list.filter(e => { const d = daysUntil(e.Date); return d !== null && d > 7 && d <= 30 })
    const later = list.filter(e => { const d = daysUntil(e.Date); return d === null || d > 30 })
    return [
      thisWeek.length ? { label: 'This week', items: thisWeek } : null,
      thisMonth.length ? { label: 'This month', items: thisMonth } : null,
      later.length ? { label: 'Later', items: later } : null,
    ].filter(Boolean)
  }, [list, filter])

  const upcomingCount = items.filter(i => isUpcoming(i.Date) && i.Status !== 'Skipped').length

  if (loading) return <div className="loading"><div className="spin" />Loading events…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <div className="sub">{items.length} TOTAL · {upcomingCount} UPCOMING</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" /> Add event
        </button>
      </div>

      <div className="ev-layout">
        {registered.length > 0 && (
          <div>
            <div className="ev-section-head">
              <span className="ev-section-title">On your calendar</span>
              <span className="chip chip-green">{registered.length} registered</span>
            </div>
            <div className="ev-registered">
              {registered.map(e => {
                const d = e.Date ? new Date(e.Date + 'T00:00:00') : null
                const day = d ? d.getDate() : '—'
                const mon = d ? d.toLocaleString('en-US', { month: 'short' }) : ''
                return (
                  <div className="ev-committed" key={e.id}>
                    <div className="ev-committed-num">
                      <span className="ev-day">{day}</span>
                      <span className="ev-mon">{mon}</span>
                    </div>
                    <div className="ev-committed-body">
                      <h3>{e.Name}</h3>
                      <div className="ev-committed-meta">
                        {e.Price && e.Price !== 'Free' && <span><Icon name="tag" />{e.Price}</span>}
                      </div>
                      <div className="ev-committed-foot">
                        {e['Registration Link'] ? (
                          <a href={e['Registration Link']} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                            <Icon name="external-link" /> Open link
                          </a>
                        ) : (
                          <button className="btn btn-ghost btn-sm" disabled><Icon name="external-link" /> No link</button>
                        )}
                        <button className="btn btn-quiet btn-sm" onClick={() => setEditing(e)}>
                          <Icon name="pen-line" /> Edit
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <div className="ev-section-head">
            <span className="ev-section-title">All events</span>
            <div className="seg">
              {FILTERS.map(f => (
                <button key={f} className={filter === f ? 'active' : ''} onClick={() => { setFilter(f); setSelId(null) }}>{f}</button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="placeholder">
              <div className="placeholder-inner">
                <div className="placeholder-icn"><Icon name="calendar" /></div>
                <p>Track meetups, webinars, and fairs so opportunities don't slip.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                  <Icon name="plus" /> Add first event
                </button>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="or-empty">
              <Icon name="calendar" />
              <div>No events in this view.</div>
            </div>
          ) : groups.map(g => (
            <div className="ev-group" key={g.label}>
              <div className="ev-bucket-label">{g.label}</div>
              {g.items.map(e => (
                <EventRow
                  key={e.id}
                  e={e}
                  sel={selId === e.id}
                  onSelect={() => setSelId(selId === e.id ? null : e.id)}
                  onEdit={() => { setEditing(e); setSelId(null) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <EditModal
          event={editing}
          onClose={() => setEditing(null)}
          onUpdate={() => { load(); setEditing(null) }}
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
