import { useEffect, useMemo, useRef, useState } from 'react'

const BUNDLE_VERSION = String(import.meta.env.VITE_DEPLOY_VERSION || 'dev')

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

function describeAuditAction(log) {
  const md = log?.metadata || {}
  if (log?.action === 'admin.user.created') {
    const username = md.username || log.targetUsername || log.targetUserId || 'unknown'
    const role = md.role || 'job_seeker'
    return `Created user ${username} (${role})`
  }
  if (log?.action === 'admin.staff_assignment.created') {
    const staff = md.staffUsername || md.staffUserId || 'unknown'
    const seeker = md.jobSeekerUsername || md.jobSeekerUserId || 'unknown'
    return `Assigned ${seeker} to ${staff}`
  }
  if (log?.action === 'admin.staff_assignment.deleted') {
    const staff = md.staffUsername || md.staffUserId || 'unknown'
    const seeker = md.jobSeekerUsername || md.jobSeekerUserId || 'unknown'
    return `Removed assignment ${seeker} from ${staff}`
  }
  return log?.action || 'unknown'
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
  const [healthMeta, setHealthMeta] = useState(null)
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
  const [adminUsers, setAdminUsers] = useState([])
  const [assignedUsers, setAssignedUsers] = useState([])
  const [staffAssignments, setStaffAssignments] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [newUsername, setNewUsername] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState('job_seeker')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  const [assignStaffUserId, setAssignStaffUserId] = useState('')
  const [assignJobSeekerUserId, setAssignJobSeekerUserId] = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [removingAssignmentId, setRemovingAssignmentId] = useState('')

  const healthState = status?.health?.status || 'unknown'
  const healthColor = useMemo(() => {
    if (healthState === 'healthy') return 'var(--green)'
    if (healthState === 'needs_attention') return 'var(--yellow)'
    return 'var(--text-muted)'
  }, [healthState])
  const serverDeployVersion = String(healthMeta?.deployVersion || '')
  const hasVersionMismatch = !!serverDeployVersion && serverDeployVersion !== BUNDLE_VERSION
  const usersById = useMemo(() => {
    const map = new Map()
    for (const user of adminUsers) map.set(Number(user.id), user)
    return map
  }, [adminUsers])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [statusRes, runsRes, gmailRes] = await Promise.all([
        api('/api/sheets/status'),
        api('/api/sheets/sync/runs'),
        api('/api/gmail/status')
      ])
      const healthRes = await api('/api/health')
      setStatus(statusRes)
      setRuns(runsRes || [])
      setGmailStatus(gmailRes || null)
      setHealthMeta(healthRes || null)

      const cfg = statusRes?.config || {}
      setEnabled(cfg.enabled !== false)
      setSheetId(cfg.sheetId || '')
      setPipelineTabsText(tabsToText(cfg.pipelineTabs || ['Jobs & Applications', 'Found']))
      setContactsTabsText(tabsToText(cfg.contactsTabs || ['Networking Tracker']))
      setInterviewsTabsText(tabsToText(cfg.interviewsTabs || ['Interview Tracker']))
      setEventsTabsText(tabsToText(cfg.eventsTabs || ['Events']))

      if (me?.isAdmin) {
        const [usersRes, assignmentsRes, auditRes] = await Promise.all([
          api('/api/admin/users'),
          api('/api/admin/staff-assignments'),
          api('/api/admin/audit-log?limit=60')
        ])
        setAdminUsers(usersRes?.users || [])
        setStaffAssignments(assignmentsRes?.assignments || [])
        setAuditLogs(auditRes?.logs || [])
      } else {
        setAdminUsers([])
        setStaffAssignments([])
        setAuditLogs([])
      }

      if (me?.isAdmin || me?.role === 'staff') {
        const assignedRes = await api('/api/staff/assigned-users')
        setAssignedUsers(assignedRes?.users || [])
      } else {
        setAssignedUsers([])
      }
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

  async function createUser() {
    setCreatingUser(true)
    setError(null)
    setSuccess('')
    try {
      const username = newUsername.trim().toLowerCase()
      const password = newUserPassword.trim()
      const email = newUserEmail.trim().toLowerCase()
      if (!username) throw new Error('Username is required')
      if (!password || password.length < 10) throw new Error('Temporary password must be at least 10 characters')
      await api('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          email: email || null,
          role: newUserRole
        })
      })
      setSuccess('User created.')
      setNewUsername('')
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('job_seeker')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setCreatingUser(false)
    }
  }

  async function createAssignment() {
    setSavingAssignment(true)
    setError(null)
    setSuccess('')
    try {
      const staffUserId = Number(assignStaffUserId)
      const jobSeekerUserId = Number(assignJobSeekerUserId)
      if (!staffUserId || !jobSeekerUserId) throw new Error('Select both staff and job seeker users')
      await api('/api/admin/staff-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffUserId, jobSeekerUserId })
      })
      setSuccess('Staff assignment saved.')
      setAssignStaffUserId('')
      setAssignJobSeekerUserId('')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setSavingAssignment(false)
    }
  }

  async function removeAssignment(assignment) {
    setRemovingAssignmentId(assignment.id)
    setError(null)
    setSuccess('')
    try {
      await api('/api/admin/staff-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffUserId: assignment.staffUserId,
          jobSeekerUserId: assignment.jobSeekerUserId
        })
      })
      setSuccess('Staff assignment removed.')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setRemovingAssignmentId('')
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

  const staffCandidates = adminUsers.filter(user => user.role === 'staff' || user.role === 'admin')
  const jobSeekerCandidates = adminUsers.filter(user => user.role === 'job_seeker')

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <div className="subtitle">Google Sheets sync setup, health, and troubleshooting</div>
      </div>

      {success && <div className="success-msg">{success}</div>}
      <ErrorCallout error={error} />

      <div className="card mb-16">
        <div className="card-title">Build Info</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Frontend bundle: <code>{BUNDLE_VERSION}</code></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Server deploy: <code>{serverDeployVersion || 'unknown'}</code></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Auth mode: <code>{healthMeta?.authMode || 'unknown'}</code></div>
        {hasVersionMismatch && (
          <div className="error-msg" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Version mismatch detected</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              Your browser is running an older frontend bundle than the server deploy. Reload now to avoid stale-session issues.
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>
              Reload now
            </button>
          </div>
        )}
      </div>

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
            Role: {me?.role || 'job_seeker'} {me?.isAdmin ? '• Admin' : ''}
          </div>
        </div>
      </div>

      {(me?.isAdmin || me?.role === 'staff') && (
        <div className="card mb-16">
          <div className="card-title">Assigned Users</div>
          {!assignedUsers.length && (
            <div style={{ color: 'var(--text-muted)' }}>
              {me?.isAdmin ? 'No users in this organization yet.' : 'No users assigned to you yet.'}
            </div>
          )}
          {!!assignedUsers.length && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Password Reset</th>
                </tr>
              </thead>
              <tbody>
                {assignedUsers.map(user => (
                  <tr key={`assigned-${user.id}`}>
                    <td>{user.username}</td>
                    <td>{user.email || '—'}</td>
                    <td>{user.role}</td>
                    <td>{user.mustChangePassword ? 'Required' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {me?.isAdmin && (
        <div className="card mb-16">
          <div className="card-title">Team Access</div>
          <div className="field">
            <label>Username</label>
            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="new user username" />
          </div>
          <div className="field">
            <label>Email (optional)</label>
            <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
              <option value="job_seeker">job_seeker</option>
              <option value="staff">staff</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="field">
            <label>Temporary Password</label>
            <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="at least 10 characters" />
          </div>
          <div className="quick-actions" style={{ marginBottom: 14 }}>
            <button className="btn btn-primary" onClick={createUser} disabled={creatingUser}>
              {creatingUser ? 'Creating…' : 'Create User'}
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Password Reset</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map(user => (
                <tr key={`org-user-${user.id}`}>
                  <td>{user.username}</td>
                  <td>{user.email || '—'}</td>
                  <td>{user.role}</td>
                  <td>{user.mustChangePassword ? 'Required' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {me?.isAdmin && (
        <div className="card mb-16">
          <div className="card-title">Staff Assignments</div>
          <div className="settings-grid">
            <div className="field">
              <label>Staff User</label>
              <select value={assignStaffUserId} onChange={e => setAssignStaffUserId(e.target.value)}>
                <option value="">Select staff user</option>
                {staffCandidates.map(user => (
                  <option key={`staff-${user.id}`} value={user.id}>{user.username} ({user.role})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Job Seeker</label>
              <select value={assignJobSeekerUserId} onChange={e => setAssignJobSeekerUserId(e.target.value)}>
                <option value="">Select job seeker</option>
                {jobSeekerCandidates.map(user => (
                  <option key={`seeker-${user.id}`} value={user.id}>{user.username}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="quick-actions" style={{ marginBottom: 14 }}>
            <button className="btn btn-primary" onClick={createAssignment} disabled={savingAssignment}>
              {savingAssignment ? 'Saving…' : 'Assign User'}
            </button>
          </div>
          {!staffAssignments.length && <div style={{ color: 'var(--text-muted)' }}>No assignments yet.</div>}
          {!!staffAssignments.length && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Job Seeker</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staffAssignments.map(assignment => (
                  <tr key={assignment.id}>
                    <td>{assignment.staffUsername || assignment.staffUserId}</td>
                    <td>{assignment.jobSeekerUsername || assignment.jobSeekerUserId}</td>
                    <td>{formatDateTime(new Date(assignment.updatedAt).toISOString())}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeAssignment(assignment)}
                        disabled={removingAssignmentId === assignment.id}
                      >
                        {removingAssignmentId === assignment.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {me?.isAdmin && (
        <div className="card mb-16">
          <div className="card-title">Audit Log</div>
          {!auditLogs.length && <div style={{ color: 'var(--text-muted)' }}>No audit activity yet.</div>}
          {!!auditLogs.length && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => {
                  const actor = log.actorUserId ? usersById.get(Number(log.actorUserId)) : null
                  const target = log.targetUserId ? usersById.get(Number(log.targetUserId)) : null
                  return (
                    <tr key={log.id}>
                      <td>{formatDateTime(new Date(log.createdAt).toISOString())}</td>
                      <td title={log.action}>{describeAuditAction(log)}</td>
                      <td>{actor?.username || log.actorUserId || 'system'}</td>
                      <td>{target?.username || log.targetUserId || log.metadata?.username || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

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
