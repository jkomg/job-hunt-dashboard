import { useState, useEffect } from 'react'

const INDUSTRIES = ['Healthcare Tech', 'Climate / Clean Energy', 'AI/ML Platform', 'EdTech', 'Social Impact', 'Other']
const STATUSES = ['Watching', 'Reached Out', 'Applied — In Pipeline', 'Pass']

function statusColor(s) {
  if (s === 'Reached Out') return 'badge-yellow'
  if (s === 'Applied — In Pipeline') return 'badge-green'
  if (s === 'Pass') return 'badge-gray'
  return 'badge-blue' // Watching
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) <= new Date()
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
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('active')

  function load() {
    setLoading(true)
    fetch('/api/watchlist', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = filter === 'active'
    ? items.filter(i => i.Status !== 'Pass' && i.Status !== 'Applied — In Pipeline')
    : filter === 'due'
    ? items.filter(i => isOverdue(i['Follow Up']) && i.Status !== 'Pass')
    : items

  const dueCount = items.filter(i => isOverdue(i['Follow Up']) && i.Status !== 'Pass').length

  if (loading) return <div className="loading"><div className="spin" /> Loading watchlist…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Companies of Interest</h1>
            <div className="subtitle">{items.length} tracked · {items.filter(i => i.Status === 'Watching').length} watching</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')}>Active</button>
        <button className={`tab${filter === 'due' ? ' active' : ''}`} onClick={() => setFilter('due')}>
          Follow-up Due {dueCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 3 }}>({dueCount})</span>}
        </button>
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🔭</div>
            <p>{filter === 'active' ? 'No companies on your watchlist yet.' : 'No companies match this filter.'}</p>
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="contact-row" onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
              <div className="contact-info">
                <div className="contact-name">
                  {c.Company}
                  {c['Know the Founder'] && <span style={{ marginLeft: 6, fontSize: 11 }} title="Know the founder">🤝</span>}
                  {c['Open Application'] && <span style={{ marginLeft: 4, fontSize: 11 }} title="Open applications">📬</span>}
                </div>
                <div className="contact-meta">
                  {[c.Industry, c['Connections There'] && `${c['Connections There']} connection(s)`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="contact-actions">
                {c['Follow Up'] && (
                  <span className={isOverdue(c['Follow Up']) ? 'overdue-badge' : 'text-muted text-sm'}>
                    {isOverdue(c['Follow Up']) ? '🔔 ' : ''}{c['Follow Up']}
                  </span>
                )}
                <span className={`badge ${statusColor(c.Status)}`}>{c.Status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <EditModal
          company={selected}
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
