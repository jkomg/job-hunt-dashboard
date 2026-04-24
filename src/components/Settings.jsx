import { useEffect, useMemo, useRef, useState } from 'react'

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

function formatDateTime(iso) {
  if (!iso) return 'Never'
  const ts = new Date(iso)
  if (!Number.isFinite(ts.getTime())) return String(iso)
  return `${ts.toLocaleString()} (${timeAgo(iso)})`
}

function describeRun(run) {
  if (!run?.summary) return 'No summary yet.'
  const summary = run.summary
  const merged = (summary && typeof summary === 'object' && (summary.inbound || summary.outbound))
    ? {
      ...(summary.inbound || {}),
      ...(summary.outbound || {})
    }
    : summary
  const parts = []
  if (Number.isFinite(Number(merged.updatedRows))) parts.push(`${merged.updatedRows} updated`)
  if (Number.isFinite(Number(merged.imported))) parts.push(`${merged.imported} imported`)
  if (Number.isFinite(Number(merged.linkedExisting))) parts.push(`${merged.linkedExisting} linked`)
  if (Number.isFinite(Number(merged.skippedUnchanged))) parts.push(`${merged.skippedUnchanged} skipped`)
  if (Number.isFinite(Number(merged.conflicts)) && Number(merged.conflicts) > 0) parts.push(`${merged.conflicts} conflicts`)
  if (Number.isFinite(Number(merged.missingLinkedRecords)) && Number(merged.missingLinkedRecords) > 0) {
    parts.push(`${merged.missingLinkedRecords} missing`)
  }
  return parts.length ? parts.join(' • ') : 'No summary details.'
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

export default function Settings({ me, onProfileUpdated }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [reconcilingInterviews, setReconcilingInterviews] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [exportingDbFile, setExportingDbFile] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [gmailStatus, setGmailStatus] = useState(null)
  const [gmailConnecting, setGmailConnecting] = useState(false)
  const [gmailImporting, setGmailImporting] = useState(false)
  const [status, setStatus] = useState(null)
  const [runs, setRuns] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [displayName, setDisplayName] = useState(me?.displayName || '')
  const backupFileInputRef = useRef(null)

  const [enabled, setEnabled] = useState(true)
  const [sheetId, setSheetId] = useState('')
  const [pipelineTabsText, setPipelineTabsText] = useState('Jobs & Applications, Found')
  const [contactsTabsText, setContactsTabsText] = useState('Networking Tracker')
  const [interviewsTabsText, setInterviewsTabsText] = useState('Interview Tracker')
  const [eventsTabsText, setEventsTabsText] = useState('Events')
  const [downloadingLogs, setDownloadingLogs] = useState(false)

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
      const [statusRes, runsRes, gmailRes] = await Promise.all([
        api('/api/sheets/status'),
        api('/api/sheets/sync/runs'),
        api('/api/gmail/status')
      ])
      setStatus(statusRes)
      setRuns(runsRes || [])
      setGmailStatus(gmailRes || null)

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

  useEffect(() => {
    setDisplayName(me?.displayName || '')
  }, [me?.displayName])

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

  async function saveProfile() {
    setSavingProfile(true)
    setError(null)
    setSuccess('')
    try {
      if (!displayName.trim()) {
        throw new Error('Display name cannot be empty')
      }
      await api('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() })
      })
      setSuccess('Profile updated.')
      if (typeof onProfileUpdated === 'function') onProfileUpdated()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setSavingProfile(false)
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
      const result = await api('/api/sheets/sync', { method: 'POST' })
      const conflicts = Number(result?.pipeline?.outbound?.conflicts || 0)
        + Number(result?.contacts?.conflicts || 0)
        + Number(result?.interviews?.conflicts || 0)
        + Number(result?.events?.conflicts || 0)
      setSuccess(
        conflicts > 0
          ? `Sync completed with ${conflicts} conflict${conflicts === 1 ? '' : 's'} (skipped to avoid overwrites).`
          : 'Sync completed successfully.'
      )
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  async function downloadSyncLogs() {
    setDownloadingLogs(true)
    setError(null)
    setSuccess('')
    try {
      const res = await fetch('/api/sheets/sync/logs.csv', { credentials: 'include' })
      if (!res.ok) {
        let payload = null
        try {
          payload = await res.json()
        } catch {
          payload = null
        }
        throw new Error(payload?.error || `Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sync-logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setSuccess('Sync logs downloaded.')
    } catch (e) {
      setError({ error: e.message || 'Could not download sync logs' })
    } finally {
      setDownloadingLogs(false)
    }
  }

  async function reconcileInterviews() {
    setReconcilingInterviews(true)
    setError(null)
    setSuccess('')
    try {
      const result = await api('/api/interviews/reconcile', { method: 'POST' })
      setSuccess(
        `Interview repair complete: ${result.created} created, ${result.alreadyExists} already linked, ${result.skipped} skipped.`
      )
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setReconcilingInterviews(false)
    }
  }

  async function connectGmail() {
    setGmailConnecting(true)
    setError(null)
    setSuccess('')
    try {
      const result = await api('/api/gmail/auth-url', { method: 'POST' })
      window.location.href = result.url
    } catch (e) {
      setError(e.payload || { error: e.message })
      setGmailConnecting(false)
    }
  }

  async function disconnectGmail() {
    setError(null)
    setSuccess('')
    try {
      await api('/api/gmail/disconnect', { method: 'POST' })
      setSuccess('Gmail disconnected.')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    }
  }

  async function importFromGmail() {
    setGmailImporting(true)
    setError(null)
    setSuccess('')
    try {
      const result = await api('/api/gmail/import-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMessages: 80 })
      })
      setSuccess(`Gmail import complete: ${result.created} new events, ${result.deduped} already imported.`)
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setGmailImporting(false)
      await load()
    }
  }

  async function exportBackup() {
    setExportingBackup(true)
    setError(null)
    setSuccess('')
    try {
      const snapshot = await api('/api/admin/backup/export')
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `job-hunt-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setSuccess('Backup exported.')
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setExportingBackup(false)
    }
  }

  async function exportDbFile() {
    setExportingDbFile(true)
    setError(null)
    setSuccess('')
    try {
      const res = await fetch('/api/admin/backup/export-db', { credentials: 'include' })
      if (!res.ok) {
        let payload = null
        try {
          payload = await res.json()
        } catch {
          payload = null
        }
        throw new Error(payload?.error || `Could not export .db file (${res.status})`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `job-hunt-backup-${new Date().toISOString().slice(0, 10)}.db`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setSuccess('Database file exported.')
    } catch (e) {
      setError({ error: e.message || 'Could not export database file' })
    } finally {
      setExportingDbFile(false)
    }
  }

  function chooseBackupFile() {
    backupFileInputRef.current?.click()
  }

  async function restoreBackupFromFile(evt) {
    const file = evt.target.files?.[0]
    evt.target.value = ''
    if (!file) return

    setRestoringBackup(true)
    setError(null)
    setSuccess('')
    try {
      const text = await file.text()
      const snapshot = JSON.parse(text)
      await api('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot })
      })
      setSuccess('Backup restored. Refreshing status…')
      await load()
      if (typeof onProfileUpdated === 'function') onProfileUpdated()
    } catch (e) {
      setError(e.payload || { error: e.message || 'Invalid backup file' })
    } finally {
      setRestoringBackup(false)
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
        <div className="card-title">Profile</div>
        <div className="field">
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="How your name appears on the dashboard"
          />
        </div>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Admin: {me?.isAdmin ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Sync Health</div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: healthColor }}>
            {healthState === 'healthy' ? 'Healthy' : healthState === 'needs_attention' ? 'Needs attention' : 'Unknown'}
          </strong>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Last success: {formatDateTime(status?.health?.lastSuccessAt)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Last error: {status?.health?.lastErrorAt ? formatDateTime(status.health.lastErrorAt) : 'None'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Last saved locally: {formatDateTime(status?.freshness?.localLastSavedAt)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Last synced to Google: {formatDateTime(status?.freshness?.googleLastSyncedAt)}
        </div>
        {status?.health?.lastError?.details && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Last error detail: {status.health.lastError.details}
          </div>
        )}
      </div>

      <div className="card mb-16">
        <div className="card-title">Sync Details</div>
        {[
          ['Pipeline', status?.entities?.pipeline],
          ['Networking', status?.entities?.contacts],
          ['Interviews', status?.entities?.interviews],
          ['Events', status?.entities?.events]
        ].map(([label, run]) => (
          <div key={label} className="contact-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="contact-info">
              <div className="contact-name">{label}</div>
              <div className="contact-meta">{run?.createdAt ? formatDateTime(run.createdAt) : 'No sync run yet'}</div>
            </div>
            <div style={{ textAlign: 'right', maxWidth: 360 }}>
              <span className={`badge ${run?.status === 'ok' ? 'badge-green' : run?.status === 'error' ? 'badge-red' : ''}`}>
                {run?.status || 'unknown'}
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {describeRun(run)}
              </div>
            </div>
          </div>
        ))}
        <div className="quick-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={downloadSyncLogs} disabled={downloadingLogs}>
            {downloadingLogs ? 'Downloading…' : 'Download Sync Logs (CSV)'}
          </button>
        </div>
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
          <button className="btn btn-ghost" onClick={reconcileInterviews} disabled={reconcilingInterviews}>
            {reconcilingInterviews ? 'Repairing…' : 'Repair Interviews from Pipeline'}
          </button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Email Event Import (Gmail)</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
          Imports interview/calendar invite events from Gmail into the Events section.
        </div>
        {!gmailStatus?.configured && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
            Gmail import is not configured on this deployment yet.
          </div>
        )}
        {gmailStatus?.configured && (
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Connection: <strong>{gmailStatus.connected ? `Connected (${gmailStatus.email || 'Unknown account'})` : 'Not connected'}</strong>
          </div>
        )}
        <div className="quick-actions">
          <button
            className="btn btn-primary"
            onClick={connectGmail}
            disabled={gmailConnecting || !gmailStatus?.configured}
          >
            {gmailConnecting ? 'Connecting…' : gmailStatus?.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={importFromGmail}
            disabled={gmailImporting || !gmailStatus?.connected}
          >
            {gmailImporting ? 'Importing…' : 'Import Events from Gmail'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={disconnectGmail}
            disabled={!gmailStatus?.connected}
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Backup & Restore</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
          Export your current app data to a JSON file and restore it later.
        </div>
        <div className="quick-actions" style={{ marginBottom: 14 }}>
          <button className="btn btn-primary" onClick={exportBackup} disabled={exportingBackup || !me?.isAdmin}>
            {exportingBackup ? 'Exporting…' : 'Export Backup'}
          </button>
          <button className="btn btn-ghost" onClick={exportDbFile} disabled={exportingDbFile || !me?.isAdmin}>
            {exportingDbFile ? 'Exporting…' : 'Export DB File (.db)'}
          </button>
          <button className="btn btn-ghost" onClick={chooseBackupFile} disabled={restoringBackup || !me?.isAdmin}>
            {restoringBackup ? 'Restoring…' : 'Restore Backup'}
          </button>
          <input
            ref={backupFileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={restoreBackupFromFile}
          />
        </div>
        {!me?.isAdmin && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
            Backup and restore are available to admin users only.
          </div>
        )}
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          `.db` export works only in local SQLite mode (for example `DATABASE_URL=file:./data/app.db`).
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
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
