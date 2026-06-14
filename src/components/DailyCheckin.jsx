import { useState, useEffect } from 'react'
import { Icon } from '../ui-icons.jsx'

const EXERCISE_OPTIONS = ['Cardio/Run', 'Weights/Strength', 'Yoga/Stretch', 'Walk', 'Sport/Activity', 'Rest Day']
const CERT_OPTIONS = ['Gainsight', 'HubSpot Inbound', 'HubSpot CRM', 'SuccessHACKER', 'LinkedIn Learning', 'None today']

function moodColor(v) {
  if (v >= 7) return 'var(--green)'
  if (v >= 4) return 'var(--amber)'
  return 'var(--red)'
}

export default function DailyCheckin() {
  const [existingId, setExistingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [autofillingTop3, setAutofillingTop3] = useState(false)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  const [form, setForm] = useState({
    'Date': today,
    'Mindset (1-10)': 5,
    'Energy (1-10)': 5,
    'Outreach Sent': 0,
    'Responses Received': 0,
    'Applications Submitted': 0,
    'Conversations / Calls': 0,
    'LinkedIn Posts': false,
    'Volunteer Activity': false,
    'Exercise': '',
    'Cert Progress': '',
    'Win of the Day': '',
    'Gratitude / Reflection': '',
    "Tomorrow's Top 3": ''
  })

  // Split Top 3 textarea into 3 separate lines for the new UI
  const top3Lines = (() => {
    const raw = String(form["Tomorrow's Top 3"] || '')
    const lines = raw.split('\n').map(s => s.trim())
    return [lines[0] || '', lines[1] || '', lines[2] || '']
  })()

  function setTop(i, val) {
    const next = [...top3Lines]
    next[i] = val
    setForm(prev => ({ ...prev, "Tomorrow's Top 3": next.join('\n') }))
  }

  useEffect(() => {
    const todayLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })
    const qs = new URLSearchParams({ date_label: todayLabel }).toString()
    fetch(`/api/daily/today?${qs}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.id) {
          setExistingId(d.id)
          setForm(prev => ({
            ...prev,
            'Mindset (1-10)': d['Mindset (1-10)'] ?? prev['Mindset (1-10)'],
            'Energy (1-10)': d['Energy (1-10)'] ?? prev['Energy (1-10)'],
            'Outreach Sent': d['Outreach Sent'] ?? prev['Outreach Sent'],
            'Responses Received': d['Responses Received'] ?? prev['Responses Received'],
            'Applications Submitted': d['Applications Submitted'] ?? prev['Applications Submitted'],
            'Conversations / Calls': d['Conversations / Calls'] ?? prev['Conversations / Calls'],
            'LinkedIn Posts': d['LinkedIn Posts'] ?? false,
            'Volunteer Activity': d['Volunteer Activity'] ?? false,
            'Exercise': d['Exercise'] || '',
            'Cert Progress': d['Cert Progress'] || '',
            'Win of the Day': d['Win of the Day'] || '',
            'Gratitude / Reflection': d['Gratitude / Reflection'] || '',
            "Tomorrow's Top 3": d["Tomorrow's Top 3"] || ''
          }))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function step(key, delta) {
    setForm(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      if (existingId) {
        const r = await fetch(`/api/daily/${existingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form)
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Save failed (${r.status})`)
      } else {
        const r = await fetch('/api/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form)
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Save failed (${r.status})`)
        const d = await r.json()
        setExistingId(d.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Network/auth issue. Refresh and sign in again.' : e.message)
    } finally {
      setSaving(false)
    }
  }

  async function autofillTop3() {
    setAutofillingTop3(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard', { credentials: 'include' })
      if (!res.ok) throw new Error('Could not load queue')
      const data = await res.json()
      const lines = Array.isArray(data?.suggestedTop3) ? data.suggestedTop3.slice(0, 3) : []
      if (!lines.length) throw new Error('No queue suggestions right now. Add next actions or follow-up dates first.')
      set("Tomorrow's Top 3", lines.join('\n'))
    } catch (e) {
      setError(e.message || 'Could not auto-fill Top 3')
    } finally {
      setAutofillingTop3(false)
    }
  }

  if (loading) return <div className="loading"><div className="spin" /> Loading today's log…</div>

  const mindset = form['Mindset (1-10)'] || 5
  const energy = form['Energy (1-10)'] || 5
  const outreach = form['Outreach Sent'] || 0
  const responses = form['Responses Received'] || 0
  const applications = form['Applications Submitted'] || 0
  const calls = form['Conversations / Calls'] || 0
  const totalActivity = outreach + responses + applications + calls
  const top3Filled = top3Lines.filter(t => t.trim()).length

  const checklist = [
    mindset !== 5 || energy !== 5,
    totalActivity > 0 || form['LinkedIn Posts'] || form['Volunteer Activity'],
    !!form['Exercise'],
    !!form['Win of the Day'].trim(),
    !!form['Gratitude / Reflection'].trim(),
    top3Filled === 3,
  ]
  const doneCount = checklist.filter(Boolean).length
  const pct = Math.round((doneCount / checklist.length) * 100)

  const R = 30
  const C = 2 * Math.PI * R
  const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()

  const COUNTERS = [
    { key: 'Outreach Sent', label: 'Outreach sent', sub: 'Messages sent today', icon: 'send', val: outreach },
    { key: 'Responses Received', label: 'Responses', sub: 'Replies received', icon: 'reply', val: responses },
    { key: 'Applications Submitted', label: 'Applications', sub: 'Jobs applied to', icon: 'file-text', val: applications },
    { key: 'Conversations / Calls', label: 'Calls / convos', sub: 'Live conversations', icon: 'phone', val: calls },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Daily Check-in</h1>
          <div className="sub">{todayShort} · {existingId ? 'UPDATING' : 'NEW ENTRY'}</div>
        </div>
        <span className="chip chip-gray ci-status"><Icon name="flame" /> {existingId ? 'Entry exists' : 'New entry'}</span>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="checkin-layout">
        {/* ── main column ─────────────────────────────── */}
        <div className="checkin-main">

          {/* 01 · How are you feeling */}
          <div className="ci-card">
            <div className="ci-card-head">
              <span className="ci-num">01</span>
              <span className="ci-card-title">How are you feeling?</span>
              <span className="ci-card-hint">Sets the tone of tomorrow's briefing</span>
            </div>
            <div className="mood-grid">
              {[
                { key: 'Mindset (1-10)', label: 'Mindset', icon: 'target', low: 'Scattered', high: 'Focused', val: mindset },
                { key: 'Energy (1-10)', label: 'Energy', icon: 'zap', low: 'Drained', high: 'Energized', val: energy },
              ].map(m => {
                const col = moodColor(m.val)
                return (
                  <div className="mood" key={m.key}>
                    <div className="mood-head">
                      <div className="mood-ico"><Icon name={m.icon} /></div>
                      <span className="mood-name">{m.label}</span>
                      <span className="mood-val" style={{ color: col }}>{m.val}</span>
                    </div>
                    <input
                      className="ci-range"
                      type="range"
                      min="1" max="10"
                      value={m.val}
                      style={{ '--pct': ((m.val - 1) / 9 * 100) + '%', '--rng': col }}
                      onChange={e => set(m.key, Number(e.target.value))}
                    />
                    <div className="mood-scale"><span>{m.low}</span><span>{m.high}</span></div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 02 · Today's activity */}
          <div className="ci-card">
            <div className="ci-card-head">
              <span className="ci-num">02</span>
              <span className="ci-card-title">Today's activity</span>
              <span className="ci-card-hint"><Icon name="trending-up" /> Rolls into your weekly goals</span>
            </div>
            <div className="count-grid">
              {COUNTERS.map(c => (
                <div className="counter" key={c.key}>
                  <div className="counter-ico"><Icon name={c.icon} /></div>
                  <div className="counter-body">
                    <div className="counter-label">{c.label}</div>
                    <div className="counter-sub">{c.sub}</div>
                  </div>
                  <div className="stepper">
                    <button type="button" onClick={() => step(c.key, -1)} disabled={c.val === 0} aria-label="decrease">
                      <Icon name="minus" />
                    </button>
                    <span className="stepper-val">{c.val}</span>
                    <button type="button" onClick={() => step(c.key, 1)} aria-label="increase">
                      <Icon name="plus" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="choice-block">
              <div className="choice-label">Habits</div>
              <div className="toggle-stack">
                {[
                  { key: 'LinkedIn Posts', label: 'Posted on LinkedIn', icon: 'trending-up' },
                  { key: 'Volunteer Activity', label: 'Volunteer activity', icon: 'heart' },
                ].map(h => (
                  <div
                    key={h.key}
                    className={'toggle-row' + (form[h.key] ? ' on' : '')}
                    onClick={() => set(h.key, !form[h.key])}
                  >
                    <Icon name={h.icon} />
                    <span className="toggle-label">{h.label}</span>
                    <span className="switch"><i /></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="choice-block">
              <div className="choice-label"><Icon name="activity" /> Movement</div>
              <div className="choice-row">
                {EXERCISE_OPTIONS.map(o => (
                  <button
                    key={o}
                    type="button"
                    className={'choice' + (form['Exercise'] === o ? ' sel' : '')}
                    onClick={() => set('Exercise', form['Exercise'] === o ? '' : o)}
                  >{o}</button>
                ))}
              </div>
            </div>

            <div className="choice-block">
              <div className="choice-label"><Icon name="award" /> Cert progress</div>
              <div className="choice-row">
                {CERT_OPTIONS.map(o => (
                  <button
                    key={o}
                    type="button"
                    className={'choice' + (form['Cert Progress'] === o ? ' sel' : '')}
                    onClick={() => set('Cert Progress', form['Cert Progress'] === o ? '' : o)}
                  >{o}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 03 · Reflection */}
          <div className="ci-card">
            <div className="ci-card-head">
              <span className="ci-num">03</span>
              <span className="ci-card-title">Reflection</span>
            </div>
            <div className="ci-field" style={{ marginBottom: 16 }}>
              <label><Icon name="pen-line" /> Win of the day</label>
              <input
                className="ci-input"
                value={form['Win of the Day']}
                onChange={e => set('Win of the Day', e.target.value)}
                placeholder="One thing that went well — no matter how small"
              />
            </div>
            <div className="ci-field">
              <label><Icon name="heart" /> Gratitude / reflection <span className="opt">optional</span></label>
              <textarea
                className="ci-textarea"
                value={form['Gratitude / Reflection']}
                onChange={e => set('Gratitude / Reflection', e.target.value)}
                placeholder="Something you're grateful for, or a note on how the day went"
              />
            </div>
          </div>

          {/* 04 · Tomorrow's Top 3 */}
          <div className="ci-card top3">
            <div className="ci-card-head">
              <span className="ci-num">04</span>
              <span className="ci-card-title">Tomorrow's Top 3</span>
              <button type="button" className="btn btn-ghost btn-sm t3-auto" onClick={autofillTop3} disabled={autofillingTop3}>
                <Icon name="rotate-ccw" /> {autofillingTop3 ? 'Pulling…' : 'Auto-fill from queue'}
              </button>
            </div>
            <div className="top3-rows">
              {[0, 1, 2].map(i => (
                <div className="top3-row" key={i}>
                  <span className="top3-num">{i + 1}</span>
                  <input
                    className="ci-input"
                    value={top3Lines[i]}
                    onChange={e => setTop(i, e.target.value)}
                    placeholder={i === 0 ? 'The one thing that moves the search forward…' : 'Add a focus…'}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── right rail ────────────────────────────────── */}
        <aside className="checkin-rail">
          <div className="rail-card accent">
            <div className="ring-wrap">
              <svg className="ring" viewBox="0 0 72 72">
                <circle className="ring-track" cx="36" cy="36" r={R} fill="none" strokeWidth="7" />
                <circle
                  className="ring-fill"
                  cx="36" cy="36" r={R} fill="none" strokeWidth="7"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - doneCount / checklist.length)}
                />
                <text className="ring-label" x="36" y="36" dominantBaseline="central" textAnchor="middle">{pct}%</text>
              </svg>
              <div className="ring-info">
                <div className="rc-title">{doneCount === checklist.length ? 'All set' : 'Log your day'}</div>
                <div className="rc-sub">{doneCount} of {checklist.length} steps done</div>
              </div>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-label">Feeds tomorrow's briefing</div>
            <div className="feed-row">
              <Icon name="trending-up" />
              <span className="fr-label">Activity logged</span>
              <b>{totalActivity}</b>
            </div>
            <div className="feed-row">
              <Icon name="sun" />
              <span className="fr-label">Mindset · energy</span>
              <b>{mindset} · {energy}</b>
            </div>
            <div className="feed-row">
              <Icon name="list-checks" />
              <span className="fr-label">Top 3 set</span>
              <b>{top3Filled}/3</b>
            </div>
            <div className="feed-foot">
              <Icon name="sparkles" />
              <span>Your Top 3 become tomorrow's focus tasks on the Briefing.</span>
            </div>
          </div>

          <div className="rail-card">
            <div className="save-stack">
              <button
                type="button"
                className={'btn btn-primary btn-full' + (saved ? ' btn-saved' : '')}
                onClick={save}
                disabled={saving}
              >
                <Icon name={saved ? 'check' : 'save'} />
                {saving ? 'Saving…' : saved ? 'Saved for today' : (existingId ? 'Update check-in' : 'Save check-in')}
              </button>
              <div className="save-meta">{saved ? 'Synced · see you tomorrow' : 'Saves to your daily log'}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
