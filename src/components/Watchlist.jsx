import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../ui-icons.jsx'

const INDUSTRIES = ['Healthcare Tech', 'Climate / Clean Energy', 'AI/ML Platform', 'EdTech', 'Social Impact', 'Other']
const STATUSES = ['Watching', 'Reached Out', 'Applied — In Pipeline', 'Pass']
const FILTERS = ['Active', 'Due', 'All']

const IND_COLORS = {
  'Healthcare Tech': 'oklch(0.62 0.18 28)',
  'Climate / Clean Energy': 'var(--green)',
  'AI/ML Platform': 'var(--accent)',
  'EdTech': 'var(--amber)',
  'Social Impact': 'oklch(0.62 0.14 300)',
  'Other': 'var(--text-3)',
}

function statusChip(s) {
  if (s === 'Reached Out') return 'chip chip-amber'
  if (s === 'Applied — In Pipeline') return 'chip chip-green'
  if (s === 'Pass') return 'chip chip-gray'
  return 'chip chip-blue'
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) <= new Date()
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return Math.round((d - today) / 86400000)
}

function dueInfo(dateStr) {
  const days = daysUntil(dateStr)
  if (days === null) return { text: 'No follow-up', tone: '' }
  if (days < 0) return { text: `${-days}d overdue`, tone: ' over' }
  if (days === 0) return { text: 'Due today', tone: ' over' }
  return { text: `In ${days}d`, tone: ' soon' }
}

function emptyForm(defaults = {}) {
  return {
    Company: '', Industry: '', Website: '', 'Connections There': '',
    'Know the Founder': false, 'Open Application': false,
    'Follow Up': '', Status: 'Watching', Notes: '',
    ...defaults
  }
}

function WatchlistForm({ form, set }) {
  return (
    <>
      <div className="checkin-grid">
        <div className="field"><label>Company *</label><input value={form.Company} onChange={e => set('Company', e.target.value)} /></div>
        <div className="field"><label>Industry</label><select value={form.Industry} onChange={e => set('Industry', e.target.value)}><option value="">—</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>
        <div className="field"><label>Status</label><select value={form.Status} onChange={e => set('Status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Follow Up</label><input type="date" value={form['Follow Up']} onChange={e => set('Follow Up', e.target.value)} /></div>
        <div className="field"><label>Connections There</label><input value={form['Connections There']} onChange={e => set('Connections There', e.target.value)} placeholder="Names or count of connections" /></div>
      </div>
      <div className="field"><label>Website</label><input value={form.Website} onChange={e => set('Website', e.target.value)} placeholder="https://…" /></div>
      <div className="field"><label>Notes</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="know-founder" checked={!!form['Know the Founder']} onChange={e => set('Know the Founder', e.target.checked)} style={{ width: 16, height: 16, margin: 0, appearance: 'auto', flexShrink: 0 }} />
          <label htmlFor="know-founder" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer', margin: 0 }}>Know the founder</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="open-app" checked={!!form['Open Application']} onChange={e => set('Open Application', e.target.checked)} style={{ width: 16, height: 16, margin: 0, appearance: 'auto', flexShrink: 0 }} />
          <label htmlFor="open-app" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer', margin: 0 }}>Accepts open applications</label>
        </div>
      </div>
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
      const r = await fetch('/api/watchlist', {
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
          <span className="modal-title">Add Company</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <WatchlistForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Company'}</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ company, onClose, onUpdate }) {
  const [form, setForm] = useState(emptyForm({
    Company: company.Company || '',
    Industry: company.Industry || '',
    Website: company.Website || '',
    'Connections There': company['Connections There'] || '',
    'Know the Founder': company['Know the Founder'] || false,
    'Open Application': company['Open Application'] || false,
    'Follow Up': company['Follow Up'] || '',
    Status: company.Status || 'Watching',
    Notes: company.Notes || ''
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/watchlist/${company.id}`, {
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
          <span className="modal-title">{company.Company}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Saved!</div>}
        <WatchlistForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Watchlist() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('Active')

  function load() {
    setLoading(true)
    fetch('/api/watchlist', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = useMemo(() => items.filter(i => {
    if (filter === 'Active') return i.Status !== 'Pass' && i.Status !== 'Applied — In Pipeline'
    if (filter === 'Due') return isOverdue(i['Follow Up']) && i.Status !== 'Pass'
    return true
  }), [items, filter])

  const dueCount = items.filter(i => isOverdue(i['Follow Up']) && i.Status !== 'Pass').length
  const activeCount = items.filter(i => i.Status !== 'Pass').length

  if (loading) return <div className="loading"><div className="spin" />Loading watchlist…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Watchlist</h1>
          <div className="sub">{activeCount} TRACKED · {dueCount} FOLLOW-UP DUE</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" /> Add company
        </button>
      </div>

      <div className="wl-layout">
        <div>
          <div className="ev-section-head" style={{ marginBottom: 12 }}>
            <span className="iv-section-title">Companies</span>
            <div className="seg">
              {FILTERS.map(f => (
                <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <span className="or-count">{filtered.length} shown</span>
          </div>

          <div className="wl-list">
            {filtered.length === 0 ? (
              <div className="or-empty">
                <Icon name="eye" />
                <div>{filter === 'Active' ? 'No companies on your watchlist yet.' : 'No companies match this filter.'}</div>
              </div>
            ) : filtered.map(c => {
              const col = IND_COLORS[c.Industry] || 'var(--text-3)'
              const inits = (c.Company || '?').split(' ').map(x => x[0]).slice(0, 2).join('')
              const due = dueInfo(c['Follow Up'])
              return (
                <button
                  key={c.id}
                  className={'wl-row' + (selected?.id === c.id ? ' sel' : '')}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                >
                  <div className="wl-initial" style={{
                    color: col,
                    borderColor: `color-mix(in oklch, ${col} 25%, transparent)`,
                    background: `color-mix(in oklch, ${col} 10%, transparent)`
                  }}>
                    {inits}
                  </div>
                  <div className="wl-body">
                    <div className="wl-name">{c.Company}</div>
                    <div className="wl-sub"><span>{c.Industry || 'No industry'}</span></div>
                  </div>
                  <div className="wl-right">
                    <span className={'wl-due' + due.tone}>{due.text}</span>
                    <div className="wl-flags">
                      {c['Know the Founder'] && <span className="wl-flag founder">Founder</span>}
                      {c['Open Application'] && <span className="wl-flag openapp">Open app</span>}
                      <span className={statusChip(c.Status)}>{c.Status}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selected ? (
          <div className="wl-detail">
            <div className="wl-det-head">
              <div className="wl-det-co">{selected.Company}</div>
              <div className="wl-det-ind">{selected.Industry || 'No industry set'}</div>
              <div className="wl-det-chips">
                <span className={statusChip(selected.Status)}>{selected.Status}</span>
                {selected['Know the Founder'] && <span className="wl-flag founder">Know founder</span>}
                {selected['Open Application'] && <span className="wl-flag openapp">Open applications</span>}
              </div>
            </div>
            <div className="wl-det-body">
              {selected['Connections There'] && (
                <div className="wl-det-block">
                  <div className="db-label">Connections</div>
                  <div className="db-val">{selected['Connections There']}</div>
                </div>
              )}
              {selected.Website && (
                <div className="wl-det-block">
                  <div className="db-label">Website</div>
                  <div className="db-val">
                    <a href={selected.Website.startsWith('http') ? selected.Website : `https://${selected.Website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                      {selected.Website}
                    </a>
                  </div>
                </div>
              )}
              <div className="wl-det-block">
                <div className="db-label">Follow-up</div>
                <div className="db-val" style={{ color: isOverdue(selected['Follow Up']) ? 'var(--red)' : 'inherit' }}>
                  {selected['Follow Up'] ? dueInfo(selected['Follow Up']).text : 'Not set'}
                </div>
              </div>
              <div className="wl-det-block">
                <div className="db-label">Notes</div>
                <div className={'db-val' + (selected.Notes ? '' : ' empty')}>{selected.Notes || 'No notes yet'}</div>
              </div>
            </div>
            <div className="wl-det-foot">
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(selected)}>
                <Icon name="pen-line" /> Edit
              </button>
              {selected.Website && (
                <a href={selected.Website.startsWith('http') ? selected.Website : `https://${selected.Website}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  <Icon name="external-link" /> Website
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="wl-detail">
            <div className="or-empty">
              <Icon name="eye" />
              <div>Select a company to see details.</div>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          company={editing}
          onClose={() => setEditing(null)}
          onUpdate={() => { load(); setEditing(null); setSelected(null) }}
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
