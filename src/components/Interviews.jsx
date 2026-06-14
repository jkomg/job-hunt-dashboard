import { useState, useEffect } from 'react'
import { Icon } from '../ui-icons.jsx'

const ROUNDS = ['Phone Screen', '1st Interview', '2nd Interview', '3rd Interview', 'Final Round', 'Take-Home / Assignment']
const FORMATS = ['Video Call', 'Phone Call', 'Technical', 'Panel', 'On-Site', 'Async / Recorded']
const OUTCOMES = ['Pending', 'Passed', 'Rejected', 'Cancelled']
const FILTERS = ['All', 'Pending', 'Passed', 'Rejected']

const FORMAT_ICON = {
  'Video Call': 'video',
  'Phone Call': 'phone',
  'Technical': 'activity',
  'Panel': 'users',
  'On-Site': 'building',
  'Async / Recorded': 'file-text',
}

function outcomeChipClass(o) {
  if (o === 'Passed') return 'chip chip-green'
  if (o === 'Rejected') return 'chip chip-red'
  if (o === 'Cancelled') return 'chip chip-gray'
  return 'chip chip-amber'
}

function emptyForm(defaults = {}) {
  return {
    Company: '', 'Job Title': '', Date: '', Round: '', Format: '',
    Interviewer: '', 'Questions Asked': '', Outcome: 'Pending',
    'Feedback Received': '', 'Follow-Up Sent': false, Notes: '', 'Next Action': '', 'Next Action Date': '',
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
      <div className="checkin-grid">
        <div className="field"><label>Next Action</label><input value={form['Next Action']} onChange={e => set('Next Action', e.target.value)} placeholder="Thank-you note, prep, follow-up, etc." /></div>
        <div className="field"><label>Next Action Date</label><input type="date" value={form['Next Action Date']} onChange={e => set('Next Action Date', e.target.value)} /></div>
      </div>
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
    Notes: interview.Notes || '',
    'Next Action': interview['Next Action'] || '',
    'Next Action Date': interview['Next Action Date'] || ''
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

function InterviewDetail({ interview, onEdit, onClose }) {
  const fmtIcon = FORMAT_ICON[interview.Format] || 'file-text'
  return (
    <div className="iv-detail" style={{ marginTop: 16 }}>
      <div className="iv-det-head">
        <div className="iv-det-title">
          <h3>{interview.Company}</h3>
          <div className="iv-role">{interview['Job Title']}</div>
          <div className="iv-det-chips">
            <span className={outcomeChipClass(interview.Outcome)}>{interview.Outcome}</span>
            {interview.Round && <span className="chip chip-line"><Icon name={fmtIcon} />{interview.Round}</span>}
            {interview.Format && <span className="chip chip-gray">{interview.Format}</span>}
          </div>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="iv-det-body">
        {interview.Date && (
          <div>
            <div className="iv-field-label">Date</div>
            <div className="iv-field-val">{interview.Date}</div>
          </div>
        )}
        <div>
          <div className="iv-field-label">Interviewer</div>
          <div className={'iv-field-val' + (interview.Interviewer ? '' : ' empty')}>{interview.Interviewer || 'Not recorded'}</div>
        </div>
        {interview['Questions Asked'] && (
          <div className="iv-det-full">
            <div className="iv-field-label">Questions asked</div>
            <div className="iv-field-val">{interview['Questions Asked']}</div>
          </div>
        )}
        <div className="iv-det-full">
          <div className="iv-field-label">Feedback received</div>
          <div className={'iv-field-val' + (interview['Feedback Received'] ? '' : ' empty')}>{interview['Feedback Received'] || 'None yet'}</div>
        </div>
        {interview.Notes && (
          <div className="iv-det-full">
            <div className="iv-field-label">Notes</div>
            <div className="iv-field-val">{interview.Notes}</div>
          </div>
        )}
        {interview['Next Action'] && (
          <div className="iv-det-full">
            <div className="iv-field-label">Next action</div>
            <div className="iv-field-val">
              {interview['Next Action']}{interview['Next Action Date'] ? ` — ${interview['Next Action Date']}` : ''}
            </div>
          </div>
        )}
        <div className="iv-det-full">
          <div className="iv-followup">
            <Icon name={interview['Follow-Up Sent'] ? 'check' : 'send'} />
            <span style={{ color: interview['Follow-Up Sent'] ? 'var(--green)' : 'var(--text-3)' }}>
              {interview['Follow-Up Sent'] ? 'Thank-you note sent' : 'Thank-you note not yet sent'}
            </span>
          </div>
        </div>
      </div>

      <div className="iv-det-foot">
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="pen-line" /> Edit</button>
      </div>
    </div>
  )
}

export default function Interviews() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('All')

  function load() {
    setLoading(true)
    fetch('/api/interviews', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
  }

  useEffect(load, [])

  const upcoming = items.filter(i => i.Outcome === 'Pending')
  const filtered = filter === 'All' ? items : items.filter(i => i.Outcome === filter)
  const sel = items.find(i => i.id === selId)

  if (loading) return <div className="loading"><div className="spin" />Loading interviews…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Interviews</h1>
          <div className="sub">{items.length} TOTAL · {upcoming.length} UPCOMING</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" /> Log interview
        </button>
      </div>

      <div className="iv-layout">
        {upcoming.length > 0 && (
          <div>
            <div className="iv-section-head">
              <span className="iv-section-title">Coming up</span>
              <span className="chip chip-amber"><Icon name="clock" /> Action needed</span>
            </div>
            <div className="iv-upcoming">
              {upcoming.map(iv => (
                <div key={iv.id} className="iv-hero">
                  <div className="iv-hero-head">
                    <div className="iv-hero-co">
                      <h3>{iv.Company}</h3>
                      <div className="iv-role">{iv['Job Title']}</div>
                    </div>
                  </div>
                  <div className="iv-meta-row">
                    <span className="iv-meta-item">
                      <Icon name={FORMAT_ICON[iv.Format] || 'file-text'} />
                      {[iv.Round, iv.Format].filter(Boolean).join(' · ')}
                    </span>
                    {iv.Date && <span className="iv-meta-item"><Icon name="clock" />{iv.Date}</span>}
                    {iv.Interviewer && <span className="iv-meta-item"><Icon name="user" />{iv.Interviewer}</span>}
                  </div>
                  {iv['Next Action'] && (
                    <div className="iv-prep">
                      <div className="iv-prep-head">
                        <span className="iv-prep-label">Next action</span>
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>{iv['Next Action']}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="iv-section-head">
            <span className="iv-section-title">All rounds</span>
            <div className="seg">
              {FILTERS.map(f => (
                <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="placeholder">
              <div className="placeholder-inner">
                <div className="placeholder-icn"><Icon name="phone" /></div>
                <p>Log your first interview to start tracking rounds and prep.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                  <Icon name="plus" /> Log interview
                </button>
              </div>
            </div>
          ) : (
            <div className="iv-table">
              {filtered.map(iv => (
                <button
                  key={iv.id}
                  className={'iv-row' + (iv.id === selId ? ' sel' : '')}
                  onClick={() => setSelId(selId === iv.id ? null : iv.id)}
                >
                  <div className="iv-row-ico"><Icon name={FORMAT_ICON[iv.Format] || 'file-text'} /></div>
                  <div className="iv-row-body">
                    <div className="iv-row-top">{iv.Company}</div>
                    <div className="iv-row-sub">
                      {[iv.Round, iv.Format, iv.Interviewer?.split(' · ')[0]].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="iv-row-right">
                    {iv.Date && <span className="iv-row-date">{iv.Date}</span>}
                    <span className={outcomeChipClass(iv.Outcome)}>{iv.Outcome}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {sel && (
            <InterviewDetail
              key={sel.id}
              interview={sel}
              onEdit={() => { setEditItem(sel) }}
              onClose={() => setSelId(null)}
            />
          )}
        </div>
      </div>

      {editItem && (
        <EditModal
          interview={editItem}
          onClose={() => setEditItem(null)}
          onUpdate={() => { load(); setEditItem(null); setSelId(null) }}
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
