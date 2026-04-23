import { useEffect, useMemo, useState } from 'react'

function tabsToText(tabs) {
  return (tabs || []).join(', ')
}

function textToTabs(value) {
  return String(value || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
}

function timeAgo(iso) {
  if (!iso) return 'Never'
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return iso
  const diffMs = Date.now() - ts
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.payload = data || {}
    err.status = res.status
    throw err
  }
  return data
}

function ErrorCallout({ error }) {
  if (!error) return null
  const steps = Array.isArray(error.fixSteps) ? error.fixSteps : []
  return (
    <div className="error-msg" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700 }}>{error.error || error.message || 'Action failed'}</div>
      {error.code && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Code: {error.code}</div>}
      {steps.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>How to fix:</div>
          <ol style={{ paddingLeft: 18 }}>
            {steps.map((step, idx) => <li key={`${idx}-${step}`}>{step}</li>)}
          </ol>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState(null)
  const [runs, setRuns] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')

  const [enabled, setEnabled] = useState(true)
  const [sheetId, setSheetId] = useState('')
  const [pipelineTabsText, setPipelineTabsText] = useState('Jobs & Applications, Found')
  const [contactsTabsText, setContactsTabsText] = useState('Networking Tracker')
  const [interviewsTabsText, setInterviewsTabsText] = useState('Interview Tracker')
  const [eventsTabsText, setEventsTabsText] = useState('Events')

  const healthState = status?.health?.status || 'unknown'
  const healthColor = useMemo(() => {
    if (healthState === 'healthy') return 'var(--green)'
    if (healthState === 'needs_attention') return 'var(--yellow)'
    return 'var(--text-muted)'
  }, [healthState])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [statusRes, runsRes] = await Promise.all([
        api('/api/sheets/status'),
        api('/api/sheets/sync/runs')
      ])
      setStatus(statusRes)
      setRuns(runsRes || [])

      const cfg = statusRes?.config || {}
      setEnabled(cfg.enabled !== false)
      setSheetId(cfg.sheetId || '')
      setPipelineTabsText(tabsToText(cfg.pipelineTabs || ['Jobs & Applications', 'Found']))
      setContactsTabsText(tabsToText(cfg.contactsTabs || ['Networking Tracker']))
      setInterviewsTabsText(tabsToText(cfg.interviewsTabs || ['Interview Tracker']))
      setEventsTabsText(tabsToText(cfg.eventsTabs || ['Events']))
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function saveSettings() {
    setSaving(true)
    setError(null)
    setSuccess('')
    try {
      await api('/api/sheets/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          sheetId,
          pipelineTabs: textToTabs(pipelineTabsText),
          contactsTabs: textToTabs(contactsTabsText),
          interviewsTabs: textToTabs(interviewsTabsText),
          eventsTabs: textToTabs(eventsTabsText)
        })
      })
      setSuccess('Settings saved.')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setError(null)
    setSuccess('')
    try {
      const result = await api('/api/sheets/test-connection', { method: 'POST' })
      setSuccess(`Connection OK: ${result.spreadsheetTitle || result.spreadsheetId}`)
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setTesting(false)
    }
  }

  async function syncNow() {
    setSyncing(true)
    setError(null)
    setSuccess('')
    try {
      await api('/api/sheets/sync', { method: 'POST' })
      setSuccess('Sync completed successfully.')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spin" />Loading settings…</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <div className="subtitle">Google Sheets sync setup, health, and troubleshooting</div>
      </div>

      {success && <div className="success-msg">{success}</div>}
      <ErrorCallout error={error} />

      <div className="card mb-16">
        <div className="card-title">Sync Health</div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: healthColor }}>
            {healthState === 'healthy' ? 'Healthy' : healthState === 'needs_attention' ? 'Needs attention' : 'Unknown'}
          </strong>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Last success: {status?.health?.lastSuccessAt ? `${new Date(status.health.lastSuccessAt).toLocaleString()} (${timeAgo(status.health.lastSuccessAt)})` : 'Never'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Last error: {status?.health?.lastErrorAt ? `${new Date(status.health.lastErrorAt).toLocaleString()} (${timeAgo(status.health.lastErrorAt)})` : 'None'}
        </div>
        {status?.health?.lastError?.details && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Last error detail: {status.health.lastError.details}
          </div>
        )}
      </div>

      <div className="card mb-16">
        <div className="card-title">Google Sheets Connection</div>

        <div className="check-row" style={{ marginBottom: 12 }}>
          <input
            id="sync-enabled"
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
          />
          <label htmlFor="sync-enabled">Enable Google Sheets sync</label>
        </div>

        <div className="field">
          <label>Google Sheet ID</label>
          <input
            type="text"
            value={sheetId}
            onChange={e => setSheetId(e.target.value)}
            placeholder="Paste sheet ID or URL"
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Tip: you can paste the full URL; only the ID is used.
          </div>
        </div>

        <div className="field">
          <label>Pipeline Tabs (comma-separated)</label>
          <input value={pipelineTabsText} onChange={e => setPipelineTabsText(e.target.value)} />
        </div>
        <div className="field">
          <label>Networking Tabs (comma-separated)</label>
          <input value={contactsTabsText} onChange={e => setContactsTabsText(e.target.value)} />
        </div>
        <div className="field">
          <label>Interview Tabs (comma-separated)</label>
          <input value={interviewsTabsText} onChange={e => setInterviewsTabsText(e.target.value)} />
        </div>
        <div className="field">
          <label>Events Tabs (comma-separated)</label>
          <input value={eventsTabsText} onChange={e => setEventsTabsText(e.target.value)} />
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Service account: {status?.config?.serviceAccountEmail || 'Not detected'}
        </div>

        <div className="quick-actions">
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button className="btn btn-ghost" onClick={testConnection} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button className="btn btn-ghost" onClick={syncNow} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Run Sync Now'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent Sync Runs</div>
        {!runs.length && <div style={{ color: 'var(--text-muted)' }}>No sync runs yet.</div>}
        {runs.slice(0, 20).map(run => (
          <div
            key={run.id}
            className="contact-row"
            style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
          >
            <div className="contact-info">
              <div className="contact-name">{run.direction}</div>
              <div className="contact-meta">{new Date(run.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge ${run.status === 'ok' ? 'badge-green' : 'badge-red'}`}>{run.status}</span>
              {run.errorText && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360 }}>
                  {run.errorText}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
