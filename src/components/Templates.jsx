import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../ui-icons.jsx'

const CATEGORIES = [
  'Connection Request', 'Follow-Up', 'Thank You Note',
  'Cold Outreach', 'Referral Ask', 'Informational Interview', 'Other'
]

const CAT_COLORS = {
  'Connection Request': 'var(--accent)',
  'Cold Outreach': 'var(--amber)',
  'Follow-Up': 'oklch(0.62 0.14 300)',
  'Thank You Note': 'var(--green)',
  'Referral Ask': 'oklch(0.62 0.18 28)',
  'Informational Interview': 'oklch(0.62 0.13 230)',
  'Other': 'var(--text-3)',
}

function renderBody(body) {
  const parts = (body || '').split(/(\[[^\]]+\])/g)
  return parts.map((p, i) =>
    /^\[.+\]$/.test(p) ? <span key={i} className="tpl-placeholder">{p}</span> : p
  )
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
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Use [Name], [Company], [Role] etc. as placeholders</div>
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
  const [selId, setSelId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [cat, setCat] = useState('all')
  const [copied, setCopied] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/templates', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const list = useMemo(() => cat === 'all' ? items : items.filter(t => t.Category === cat), [items, cat])
  const sel = items.find(t => t.id === selId) || list[0] || null

  function copy() {
    if (!sel?.Body) return
    navigator.clipboard.writeText(sel.Body).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  if (loading) return <div className="loading"><div className="spin" />Loading templates…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Templates</h1>
          <div className="sub">{items.length} OUTREACH TEMPLATES</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" /> New template
        </button>
      </div>

      <div className="tpl-layout">
        <div className="tpl-sidebar">
          <div className="tpl-sidebar-head">
            <Icon name="mail" /> Templates
          </div>
          <div className="tpl-cats">
            <button className={'tpl-all-btn' + (cat === 'all' ? ' sel' : '')} onClick={() => setCat('all')}>
              All templates <span className="tpl-cat-count">{items.length}</span>
            </button>
            {CATEGORIES.map(c => {
              const count = items.filter(t => t.Category === c).length
              if (!count) return null
              return (
                <button key={c} className={'tpl-cat-btn' + (cat === c ? ' sel' : '')} onClick={() => setCat(c)}>
                  <span className="tpl-cat-dot" style={{ background: CAT_COLORS[c] || 'var(--text-3)' }} />
                  {c}
                  <span className="tpl-cat-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="tpl-col">
          {list.length === 0 ? (
            <div className="placeholder">
              <div className="placeholder-inner">
                <div className="placeholder-icn"><Icon name="mail" /></div>
                <p>{cat === 'all' ? 'No templates yet — add your first one.' : `No ${cat} templates yet.`}</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>New template</button>
              </div>
            </div>
          ) : (
            <>
              <div className="tpl-list">
                {list.map(t => (
                  <button key={t.id} className={'tpl-row' + (t.id === (sel?.id) ? ' sel' : '')} onClick={() => setSelId(t.id)}>
                    <span className="tpl-row-dot" style={{ background: CAT_COLORS[t.Category] || 'var(--text-3)' }} />
                    <div className="tpl-row-body">
                      <div className="tpl-row-name">{t.Name}</div>
                      <div className="tpl-row-usage">{t.Notes}</div>
                    </div>
                    {t.Category && <span className="chip chip-gray">{t.Category}</span>}
                  </button>
                ))}
              </div>

              {sel && (
                <div className="tpl-card">
                  <div className="tpl-card-head">
                    <div className="tpl-card-info">
                      <div className="tpl-card-name">{sel.Name}</div>
                      {sel.Notes && <div className="tpl-card-usage">{sel.Notes}</div>}
                      {sel.Category && (
                        <div style={{ marginTop: 9 }}>
                          <span className="chip chip-line" style={{ color: CAT_COLORS[sel.Category] || 'var(--text-3)' }}>
                            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: CAT_COLORS[sel.Category] || 'var(--text-3)', marginRight: 5, verticalAlign: 'middle' }} />
                            {sel.Category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="tpl-body-wrap">
                    <div className="tpl-body-text">
                      {sel.Body ? renderBody(sel.Body) : <span style={{ color: 'var(--text-3)' }}>No message body yet.</span>}
                    </div>
                  </div>
                  <div className="tpl-card-foot">
                    <button className={'btn btn-primary' + (copied ? ' btn-copied' : '')} onClick={copy} disabled={!sel.Body}>
                      <Icon name={copied ? 'check' : 'clipboard-list'} />
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(sel)}>
                      <Icon name="pen-line" /> Edit
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
