import { useState, useEffect } from 'react'

const ROUNDS = ['Phone Screen', '1st Interview', '2nd Interview', '3rd Interview', 'Final Round', 'Take-Home / Assignment']
const FORMATS = ['Video Call', 'Phone Call', 'Technical', 'Panel', 'On-Site', 'Async / Recorded']
const OUTCOMES = ['Pending', 'Passed', 'Rejected', 'Cancelled']

function outcomeColor(o) {
  if (o === 'Passed') return 'badge-green'
  if (o === 'Rejected') return 'badge-red'
  if (o === 'Cancelled') return 'badge-gray'
  return 'badge-yellow' // Pending
}

function emptyForm(defaults = {}) {
  return {
    Company: '', 'Job Title': '', Date: '', Round: '', Format: '',
    Interviewer: '', 'Questions Asked': '', Outcome: 'Pending',
    'Feedback Received': '', 'Follow-Up Sent': false, Notes: '',
    ...defaults
  }
}

function InterviewForm({ form, set }) {
  return (
    <>
      <div className="checkin-grid">
        <div className="field"><label>Company *</label><input value={form.Company} onChange={e => set('Company', e.target.value)} /></div>
        <div className="field"><label>Job Title</label><input value={form['Job Title']} onChange={e => set('Job Title', e.target.value)} /></div>
        <div className="field"><label>Date</label><input type="date" value={form.Date} onChange={e => set('Date', e.target.value)} /></div>
        <div className="field"><label>Round</label><select value={form.Round} onChange={e => set('Round', e.target.value)}><option value="">—</option>{ROUNDS.map(r => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label>Format</label><select value={form.Format} onChange={e => set('Format', e.target.value)}><option value="">—</option>{FORMATS.map(f => <option key={f}>{f}</option>)}</select></div>
        <div className="field"><label>Outcome</label><select value={form.Outcome} onChange={e => set('Outcome', e.target.value)}>{OUTCOMES.map(o => <option key={o}>{o}</option>)}</select></div>
        <div className="field"><label>Interviewer (Name & Role)</label><input value={form.Interviewer} onChange={e => set('Interviewer', e.target.value)} placeholder="e.g. Jane Smith, Engineering Manager" /></div>
      </div>
      <div className="field"><label>Questions Asked</label><textarea value={form['Questions Asked']} onChange={e => set('Questions Asked', e.target.value)} placeholder="Questions asked during the interview — useful for future prep" style={{ minHeight: 80 }} /></div>
      <div className="field"><label>Feedback Received</label><textarea value={form['Feedback Received']} onChange={e => set('Feedback Received', e.target.value)} placeholder="Any feedback from the interviewer or recruiter" /></div>
      <div className="field"><label>Notes</label><textarea value={form.Notes} onChange={e => set('Notes', e.target.value)} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <input type="checkbox" id="followup-sent" checked={!!form['Follow-Up Sent']} onChange={e => set('Follow-Up Sent', e.target.checked)} style={{ width: 16, height: 16, margin: 0, appearance: 'auto', flexShrink: 0 }} />
        <label htmlFor="followup-sent" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer', margin: 0 }}>Follow-up / thank-you sent</label>
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
      const r = await fetch('/api/interviews', {
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
          <span className="modal-title">Log Interview</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <InterviewForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Log Interview'}</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ interview, onClose, onUpdate }) {
  const [form, setForm] = useState(emptyForm({
    Company: interview.Company || '',
    'Job Title': interview['Job Title'] || '',
    Date: interview.Date || '',
    Round: interview.Round || '',
    Format: interview.Format || '',
    Outcome: interview.Outcome || 'Pending',
    Interviewer: interview.Interviewer || '',
    'Questions Asked': interview['Questions Asked'] || '',
    'Feedback Received': interview['Feedback Received'] || '',
    'Follow-Up Sent': interview['Follow-Up Sent'] || false,
    Notes: interview.Notes || ''
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/interviews/${interview.id}`, {
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
          <span className="modal-title">{interview.Company}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="success-msg">Saved!</div>}
        <InterviewForm form={form} set={set} />
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Interviews() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')

  function load() {
    setLoading(true)
    fetch('/api/interviews', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const filtered = filter === 'all' ? items
    : filter === 'pending' ? items.filter(i => i.Outcome === 'Pending')
    : items.filter(i => i.Outcome === filter)

  const pendingCount = items.filter(i => i.Outcome === 'Pending').length

  if (loading) return <div className="loading"><div className="spin" /> Loading interviews…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Interview Tracker</h1>
            <div className="subtitle">{items.length} total · {pendingCount} pending</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Log</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`tab${filter === 'pending' ? ' active' : ''}`} onClick={() => setFilter('pending')}>
          Pending {pendingCount > 0 && <span style={{ color: 'var(--yellow)', marginLeft: 3 }}>({pendingCount})</span>}
        </button>
        <button className={`tab${filter === 'Passed' ? ' active' : ''}`} onClick={() => setFilter('Passed')}>Passed</button>
        <button className={`tab${filter === 'Rejected' ? ' active' : ''}`} onClick={() => setFilter('Rejected')}>Rejected</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📞</div>
            <p>{filter === 'all' ? 'No interviews logged yet.' : 'No interviews match this filter.'}</p>
          </div>
        ) : (
          filtered.map(i => (
            <div key={i.id} className="contact-row" onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
              <div className="contact-info">
                <div className="contact-name">{i.Company}</div>
                <div className="contact-meta">
                  {[i['Job Title'], i.Round, i.Format].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="contact-actions">
                {i.Date && <span className="text-muted text-sm">{i.Date}</span>}
                {i['Follow-Up Sent'] && <span className="badge badge-gray" style={{ fontSize: 10 }}>✓ TY sent</span>}
                <span className={`badge ${outcomeColor(i.Outcome)}`}>{i.Outcome}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <EditModal
          interview={selected}
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
