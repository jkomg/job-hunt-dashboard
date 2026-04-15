import { useState, useEffect } from 'react'

const CATEGORIES = [
  'Connection Request', 'Follow-Up', 'Thank You Note',
  'Cold Outreach', 'Referral Ask', 'Informational Interview', 'Other'
]

function categoryColor(c) {
  if (c === 'Connection Request') return 'badge-blue'
  if (c === 'Follow-Up') return 'badge-yellow'
  if (c === 'Thank You Note') return 'badge-green'
  if (c === 'Cold Outreach') return 'badge-orange'
  if (c === 'Referral Ask') return 'badge-purple'
  if (c === 'Informational Interview') return 'badge-red'
  return 'badge-gray'
}

function emptyForm(defaults = {}) {
  return { Name: '', Category: '', Body: '', Notes: '', ...defaults }
}

function TemplateForm({ form, set }) {
  return (
    <>
      <div className="checkin-grid">
        <div className="field"><label>Template Name *</label><input value={form.Name} onChange={e => set('Name', e.target.value)} placeholder="e.g. LinkedIn – mutual connection" /></div>
        <div className="field"><label>Category</label><select value={form.Category} onChange={e => set('Category', e.target.value)}><option value="">—</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field">
        <label>Message Body</label>
        <textarea value={form.Body} onChange={e => set('Body', e.target.value)} placeholder={'Hi [Name],\n\nI came across your profile and...'} style={{ minHeight: 160, fontFamily: 'inherit' }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Use [Name], [Company], [Role] etc. as placeholders</div>
      </div>
      <div className="field"><label>Notes — when to use this</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} style={{ minHeight: 60 }} /></div>
    </>
  )
}

function AddModal({ onClose, onSave }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.Name) { setError('Template name is required'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/templates', {
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
          <span className="modal-title">New Template</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <TemplateForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</button>
        </div>
      </div>
    </div>
  )
}

function ViewModal({ template, onClose, onEdit }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(template.Body || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{template.Name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {template.Category && (
          <div style={{ marginBottom: 12 }}>
            <span className={`badge ${categoryColor(template.Category)}`}>{template.Category}</span>
          </div>
        )}
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 16, marginBottom: 16, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
          {template.Body || <span style={{ color: 'var(--text-muted)' }}>No message body yet.</span>}
        </div>
        {template.Notes && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            <strong>When to use:</strong> {template.Notes}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onEdit}>Edit</button>
          <button className="btn btn-primary" onClick={copy} disabled={!template.Body}>
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ template, onClose, onUpdate }) {
  const [form, setForm] = useState(emptyForm({
    Name: template.Name || '',
    Category: template.Category || '',
    Body: template.Body || '',
    Notes: template.Notes || ''
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setSaved(true)
      setTimeout(() => { setSaved(false); onUpdate() }, 1000)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">Edit Template</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Saved!</div>}
        <TemplateForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Templates() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')

  function load() {
    setLoading(true)
    fetch('/api/templates', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = filter === 'all' ? items : items.filter(i => i.Category === filter)

  if (loading) return <div className="loading"><div className="spin" /> Loading templates…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Outreach Templates</h1>
            <div className="subtitle">{items.length} templates</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ New</button>
        </div>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} className={`tab${filter === c ? ' active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">✉️</div>
            <p>{filter === 'all' ? 'No templates yet — add your first one.' : `No ${filter} templates yet.`}</p>
          </div>
        ) : (
          filtered.map(t => (
            <div key={t.id} className="contact-row" onClick={() => setViewing(t)} style={{ cursor: 'pointer' }}>
              <div className="contact-info">
                <div className="contact-name">{t.Name}</div>
                {t.Notes && <div className="contact-meta">{t.Notes}</div>}
              </div>
              <div className="contact-actions">
                {t.Category && <span className={`badge ${categoryColor(t.Category)}`}>{t.Category}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {viewing && !editing && (
        <ViewModal
          template={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
        />
      )}

      {editing && (
        <EditModal
          template={editing}
          onClose={() => setEditing(null)}
          onUpdate={() => { setEditing(null); load() }}
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
