import { useState, useEffect } from 'react'

const EXERCISE_OPTIONS = ['🏃 Cardio/Run', '🏋️ Weights/Strength', '🧘 Yoga/Stretch', '🚶 Walk', '🏀 Sport/Activity', '❌ Rest Day']
const CERT_OPTIONS = ['Gainsight', 'HubSpot Inbound', 'HubSpot CRM', 'SuccessHACKER', 'LinkedIn Learning', 'None today']

function Slider({ label, name, value, onChange }) {
  const color = value >= 7 ? 'var(--green)' : value >= 4 ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className="field">
      <label>{label}</label>
      <div className="slider-wrap">
        <input
          type="range"
          min={1} max={10}
          value={value || 5}
          onChange={e => onChange(name, Number(e.target.value))}
        />
        <span className="slider-val" style={{ color }}>{value || 5}</span>
      </div>
    </div>
  )
}

export default function DailyCheckin() {
  const [existingId, setExistingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.error || `Save failed (${r.status})`)
        }
      } else {
        const r = await fetch('/api/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form)
        })
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.error || `Save failed (${r.status})`)
        }
        const d = await r.json()
        setExistingId(d.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      if (e?.message === 'Failed to fetch') {
        setError('Network/auth issue while saving. Refresh the page and sign in again, then retry.')
      } else {
        setError(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spin" /> Loading today's log…</div>

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!saving) save() }}>
      <div className="page-header">
        <h1>Daily Check-in</h1>
        <div className="subtitle">{today} {existingId ? '— updating existing entry' : '— new entry'}</div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">Saved!</div>}

      {/* Mindset & energy */}
      <div className="checkin-section">
        <div className="checkin-section-title">How are you feeling?</div>
        <div className="checkin-grid">
          <Slider label="Mindset (1–10)" name="Mindset (1-10)" value={form['Mindset (1-10)']} onChange={set} />
          <Slider label="Energy (1–10)" name="Energy (1-10)" value={form['Energy (1-10)']} onChange={set} />
        </div>
      </div>

      {/* Activity numbers */}
      <div className="checkin-section">
        <div className="checkin-section-title">Today's Activity</div>
        <div className="checkin-grid">
          {[
            ['Outreach Sent', 'Messages sent'],
            ['Responses Received', 'Replies received'],
            ['Applications Submitted', 'Applications'],
            ['Conversations / Calls', 'Calls / convos']
          ].map(([key, placeholder]) => (
            <div className="field" key={key}>
              <label>{key}</label>
              <input
                type="number"
                min={0}
                value={form[key]}
                onChange={e => set(key, Number(e.target.value))}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>

        <div className="checkin-grid">
          <div>
            <div className="check-row">
              <input
                type="checkbox"
                id="linkedin"
                checked={form['LinkedIn Posts']}
                onChange={e => set('LinkedIn Posts', e.target.checked)}
              />
              <label htmlFor="linkedin">Posted on LinkedIn today</label>
            </div>
            <div className="check-row">
              <input
                type="checkbox"
                id="volunteer"
                checked={form['Volunteer Activity']}
                onChange={e => set('Volunteer Activity', e.target.checked)}
              />
              <label htmlFor="volunteer">Volunteer activity</label>
            </div>
          </div>
          <div className="field">
            <label>Exercise</label>
            <select value={form.Exercise} onChange={e => set('Exercise', e.target.value)}>
              <option value="">Select…</option>
              {EXERCISE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Cert Progress</label>
          <select value={form['Cert Progress']} onChange={e => set('Cert Progress', e.target.value)}>
            <option value="">Select…</option>
            {CERT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Reflection */}
      <div className="checkin-section">
        <div className="checkin-section-title">Reflection</div>
        <div className="field">
          <label>Win of the Day</label>
          <input
            type="text"
            value={form['Win of the Day']}
            onChange={e => set('Win of the Day', e.target.value)}
            placeholder="One thing that went well, no matter how small"
          />
        </div>
        <div className="field">
          <label>Gratitude / Reflection</label>
          <textarea
            value={form['Gratitude / Reflection']}
            onChange={e => set('Gratitude / Reflection', e.target.value)}
            placeholder="Something you're grateful for or a reflection on the day"
          />
        </div>
      </div>

      {/* Tomorrow's Top 3 */}
      <div className="checkin-section" style={{ borderColor: 'var(--accent)' }}>
        <div className="checkin-section-title" style={{ color: 'var(--accent)' }}>Tomorrow's Top 3</div>
        <div className="field">
          <label>3 most important things to do tomorrow</label>
          <textarea
            value={form["Tomorrow's Top 3"]}
            onChange={e => set("Tomorrow's Top 3", e.target.value)}
            placeholder={'1. ...\n2. ...\n3. ...'}
            style={{ minHeight: 100 }}
          />
        </div>
      </div>

      <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
        {saving ? 'Saving…' : existingId ? 'Update' : 'Save'}
      </button>
    </form>
  )
}
