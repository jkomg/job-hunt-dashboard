import { useEffect, useMemo, useRef, useState } from 'react'

const BUNDLE_VERSION = String(import.meta.env.VITE_DEPLOY_VERSION || 'dev')
const EXPECTED_SCHEDULER_JOBS = [
  { name: 'job-hunt-daily-sheets-sync', cadence: 'daily', purpose: 'Google Sheets sync' },
  { name: 'job-hunt-daily-backup-export', cadence: 'daily', purpose: 'Backup export to GCS' }
]

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
  const source = summary?.source || merged?.source
  if (source && Number.isFinite(Number(source.updatedRows))) {
    parts.push(`${Number(source.updatedRows)} source updates`)
  }
  if (source && Number.isFinite(Number(source.mismatchedRows)) && Number(source.mismatchedRows) > 0) {
    parts.push(`${Number(source.mismatchedRows)} source mismatches`)
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

function parseSchedulerFromSnapshot(summaryText) {
  const text = String(summaryText || '')
  if (!text) return { jobCount: null, jobs: [], status: null }
  const lines = text.split('\n')
  const sectionIdx = lines.findIndex(line => line.trim().toLowerCase() === '## cloud scheduler jobs')
  if (sectionIdx < 0) return { jobCount: null, jobs: [], status: 'not_found' }
  const slice = lines.slice(sectionIdx + 1, sectionIdx + 80)
  const jobCountLine = slice.find(line => line.trim().startsWith('- job_count:'))
  const statusLine = slice.find(line => line.trim().startsWith('- status:'))
  const jobCount = jobCountLine ? Number(String(jobCountLine.split(':').slice(1).join(':')).trim()) : null
  const jobs = []

  // Support markdown-style pipe tables if present.
  const pipeTableLines = slice
    .filter(line => line.trim().startsWith('|') && line.includes('|'))
    .map(line => line.trim())
  if (pipeTableLines.length) {
    for (const line of pipeTableLines) {
      if (line.toLowerCase().includes('name') && line.toLowerCase().includes('schedule')) continue
      if (/^\|\s*-+\s*\|/.test(line)) continue
      const cols = line.split('|').map(v => v.trim()).filter(Boolean)
      if (cols.length >= 3) {
        jobs.push({ name: cols[0], schedule: cols[1], state: cols[2] })
      }
    }
  } else {
    // Parse gcloud table output: whitespace-delimited columns (name, schedule, state).
    for (const raw of slice) {
      const line = String(raw || '').trim()
      if (!line || line.startsWith('- ')) continue
      const lower = line.toLowerCase()
      if (lower.startsWith('name') && lower.includes('schedule') && lower.includes('state')) continue
      if (/^[-\s|]+$/.test(line)) continue
      const cols = line.split(/\s{2,}/).map(v => v.trim()).filter(Boolean)
      if (cols.length >= 3) {
        jobs.push({ name: cols[0], schedule: cols[1], state: cols[2] })
      }
    }
  }
  return { jobCount: Number.isFinite(jobCount) ? jobCount : null, jobs, status: statusLine ? statusLine.replace(/^- status:\s*/i, '') : null }
}

function schedulerCoverageSummary(schedulerInfo) {
  const names = new Set((schedulerInfo?.jobs || []).map(j => String(j.name || '').trim()).filter(Boolean))
  const checks = EXPECTED_SCHEDULER_JOBS.map(job => ({
    ...job,
    configured: names.has(job.name)
  }))
  return {
    checks,
    configured: checks.filter(c => c.configured).length,
    total: checks.length
  }
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

export default function Settings({ me, onProfileUpdated, onNavigate, mode = 'settings' }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [testing, setTesting] = useState(false)
  const [checkingSchema, setCheckingSchema] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [reconcilingInterviews, setReconcilingInterviews] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [exportingDbFile, setExportingDbFile] = useState(false)
  const [runningCostSnapshot, setRunningCostSnapshot] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [gmailStatus, setGmailStatus] = useState(null)
  const [gmailConnecting, setGmailConnecting] = useState(false)
  const [gmailImporting, setGmailImporting] = useState(false)
  const [status, setStatus] = useState(null)
  const [costSnapshots, setCostSnapshots] = useState([])
  const [schemaReport, setSchemaReport] = useState(null)
  const [runs, setRuns] = useState([])
  const [healthMeta, setHealthMeta] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [copyingDiagnostics, setCopyingDiagnostics] = useState(false)
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
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState('')
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState('')
  const [togglingMustResetUserId, setTogglingMustResetUserId] = useState('')
  const [staffResettingPasswordUserId, setStaffResettingPasswordUserId] = useState('')
  const [assignStaffUserId, setAssignStaffUserId] = useState('')
  const [assignJobSeekerUserId, setAssignJobSeekerUserId] = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [removingAssignmentId, setRemovingAssignmentId] = useState('')
  const [showRuns, setShowRuns] = useState(false)
  const canOpenPipelineCleanup = !(me?.role === 'staff' || me?.isAdmin)
  const isAdminOperationsMode = mode === 'admin_operations'
  const isAdminUsersMode = mode === 'admin_users'
  const isAdminAssignmentsMode = mode === 'admin_assignments'
  const showAccountSettings = mode === 'settings'
  const showOperations = mode === 'settings' || isAdminOperationsMode
  const showUserManagement = mode === 'settings' || isAdminUsersMode
  const showAssignments = mode === 'settings' || isAdminAssignmentsMode
  const showAssignedUsers = mode === 'settings' || isAdminUsersMode || isAdminAssignmentsMode

  const healthState = status?.health?.status || 'unknown'
  const healthColor = useMemo(() => {
    if (healthState === 'healthy') return 'var(--green)'
    if (healthState === 'needs_attention') return 'var(--yellow)'
    return 'var(--text-muted)'
  }, [healthState])
  const serverDeployVersion = String(healthMeta?.deployVersion || '')
  const hasVersionMismatch = !!serverDeployVersion && serverDeployVersion !== BUNDLE_VERSION
  const diagnosticsText = [
    `timestamp=${new Date().toISOString()}`,
    `frontend_bundle=${BUNDLE_VERSION}`,
    `server_deploy=${serverDeployVersion || 'unknown'}`,
    `auth_mode=${healthMeta?.authMode || 'unknown'}`,
    `role=${me?.role || 'unknown'}`,
    `is_admin=${me?.isAdmin ? 'true' : 'false'}`
  ].join('\n')

  async function copyDiagnostics() {
    setCopyingDiagnostics(true)
    setError(null)
    setSuccess('')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticsText)
      } else {
        throw new Error('Clipboard API unavailable')
      }
      setSuccess('Diagnostics copied.')
    } catch {
      setError({
        error: 'Could not access clipboard automatically.',
        fixSteps: [
          'Select and copy the diagnostics text manually from Settings > Build Info.',
          'Paste it in your support report.'
        ]
      })
    } finally {
      setCopyingDiagnostics(false)
    }
  }
  const usersById = useMemo(() => {
    const map = new Map()
    for (const user of adminUsers) map.set(Number(user.id), user)
    return map
  }, [adminUsers])
  const opsStatusRows = useMemo(() => {
    const lastByDirection = {}
    for (const run of runs || []) {
      if (!run?.direction) continue
      if (!lastByDirection[run.direction]) lastByDirection[run.direction] = run
    }
    const rows = [
      {
        key: 'sheets-outbound',
        label: 'Sheets Sync (Outbound)',
        status: lastByDirection.outbound?.status || 'unknown',
        when: lastByDirection.outbound?.createdAt || null,
        detail: describeRun(lastByDirection.outbound)
      },
      {
        key: 'sheets-inbound',
        label: 'Sheets Sync (Inbound)',
        status: lastByDirection.inbound?.status || 'unknown',
        when: lastByDirection.inbound?.createdAt || null,
        detail: describeRun(lastByDirection.inbound)
      },
      {
        key: 'contacts-sync',
        label: 'Networking Sync',
        status: lastByDirection.contacts?.status || 'unknown',
        when: lastByDirection.contacts?.createdAt || null,
        detail: describeRun(lastByDirection.contacts)
      },
      {
        key: 'interviews-sync',
        label: 'Interviews Sync',
        status: lastByDirection.interviews?.status || 'unknown',
        when: lastByDirection.interviews?.createdAt || null,
        detail: describeRun(lastByDirection.interviews)
      },
      {
        key: 'events-sync',
        label: 'Events Sync',
        status: lastByDirection.events?.status || 'unknown',
        when: lastByDirection.events?.createdAt || null,
        detail: describeRun(lastByDirection.events)
      },
      {
        key: 'cost-snapshot',
        label: 'Cost Snapshot',
        status: costSnapshots?.length ? 'ok' : 'unknown',
        when: costSnapshots?.[0]?.created_at ? new Date(costSnapshots[0].created_at).toISOString() : null,
        detail: costSnapshots?.length ? 'Latest snapshot available.' : 'No snapshot yet.'
      }
    ]
    return rows
  }, [runs, costSnapshots])
  const opsFailures = useMemo(
    () => (runs || []).filter(run => run?.status === 'error').slice(0, 5),
    [runs]
  )
  const schedulerInfo = useMemo(
    () => parseSchedulerFromSnapshot(costSnapshots?.[0]?.summary_text || ''),
    [costSnapshots]
  )
  const schedulerCoverage = useMemo(
    () => schedulerCoverageSummary(schedulerInfo),
    [schedulerInfo]
  )
  const deploymentProfile = useMemo(() => {
    const authMode = String(healthMeta?.authMode || 'unknown')
    const deployVersion = String(healthMeta?.deployVersion || 'unknown')
    const isProductionLike = deployVersion !== 'dev' && deployVersion !== 'unknown'
    const riskFlags = []
    if (!isProductionLike) riskFlags.push('Server deploy version is not pinned (dev/unknown).')
    if (authMode === 'none') riskFlags.push('Auth mode is disabled.')
    return { authMode, deployVersion, isProductionLike, riskFlags }
  }, [healthMeta])

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
        const [usersRes, assignmentsRes, auditRes, costRes] = await Promise.all([
          api('/api/admin/users'),
          api('/api/admin/staff-assignments'),
          api('/api/admin/audit-log?limit=60'),
          api('/api/admin/cost-snapshots?limit=10')
        ])
        setAdminUsers(usersRes?.users || [])
        setStaffAssignments(assignmentsRes?.assignments || [])
        setAuditLogs(auditRes?.logs || [])
        setCostSnapshots(costRes?.snapshots || [])
      } else {
        setAdminUsers([])
        setStaffAssignments([])
        setAuditLogs([])
        setCostSnapshots([])
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

  async function changeUserRole(userId, role) {
    setUpdatingRoleUserId(String(userId))
    setError(null)
    setSuccess('')
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      setSuccess('User role updated.')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setUpdatingRoleUserId('')
    }
  }

  async function resetUserPassword(user) {
    const password = window.prompt(`Set temporary password for ${user.username} (min 10 chars):`)
    if (!password) return
    setResettingPasswordUserId(String(user.id))
    setError(null)
    setSuccess('')
    try {
      await api(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      setSuccess(`Password reset for ${user.username}. They will be forced to change it on login.`)
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setResettingPasswordUserId('')
    }
  }

  async function toggleForceReset(user) {
    setTogglingMustResetUserId(String(user.id))
    setError(null)
    setSuccess('')
    try {
      await api(`/api/admin/users/${user.id}/password-policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mustChangePassword: !user.mustChangePassword })
      })
      setSuccess(`Password reset policy updated for ${user.username}.`)
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setTogglingMustResetUserId('')
    }
  }

  async function staffResetAssignedUserPassword(user) {
    const password = window.prompt(`Set temporary password for ${user.username} (min 10 chars):`)
    if (!password) return
    setStaffResettingPasswordUserId(String(user.id))
    setError(null)
    setSuccess('')
    try {
      await api(`/api/staff/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      setSuccess(`Password reset for ${user.username}. They will be forced to change it on login.`)
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setStaffResettingPasswordUserId('')
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
      const sourceSummary = result?.pipeline?.outbound?.source || {}
      const sourceWarnings = Number(sourceSummary.mismatchedRows || 0)
        + Number(sourceSummary.blankLocalRows || 0)
        + Number(sourceSummary.blankSheetRows || 0)
      const sourceMessage = Number(sourceSummary.updatedRows || 0) > 0 || sourceWarnings > 0
        ? ` Source: ${Number(sourceSummary.updatedRows || 0)} updated${sourceWarnings > 0 ? `, ${sourceWarnings} warning${sourceWarnings === 1 ? '' : 's'}` : ''}.`
        : ''
      setSuccess(
        conflicts > 0
          ? `Sync completed with ${conflicts} conflict${conflicts === 1 ? '' : 's'} (skipped to avoid overwrites).${sourceMessage}`
          : `Sync completed successfully.${sourceMessage}`
      )
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  async function checkSchema() {
    setCheckingSchema(true)
    setError(null)
    setSuccess('')
    try {
      const result = await api('/api/sheets/schema-check')
      setSchemaReport(result)
      setSuccess('Schema check complete.')
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setCheckingSchema(false)
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
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setExportingBackup(false)
    }
  }

  async function runCostSnapshotNow() {
    setRunningCostSnapshot(true)
    setError(null)
    setSuccess('')
    try {
      await api('/api/admin/cost-snapshots/run', { method: 'POST' })
      setSuccess('Cost snapshot collected.')
      await load()
    } catch (e) {
      setError(e.payload || { error: e.message })
    } finally {
      setRunningCostSnapshot(false)
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
  const pageTitle = isAdminOperationsMode
    ? 'Operations'
    : isAdminUsersMode
      ? 'User Management'
      : isAdminAssignmentsMode
        ? 'Assignments'
        : 'Settings'
  const pageSubtitle = isAdminOperationsMode
    ? 'Sync, health, audit, and runtime operations'
    : isAdminUsersMode
      ? 'Create users, roles, and password policy'
      : isAdminAssignmentsMode
        ? 'Staff-to-job-seeker ownership mapping'
        : 'Profile, integrations, and administration'

  return (
    <div>
      <div className="page-header">
        <h1>{pageTitle}</h1>
        <div className="subtitle">{pageSubtitle}</div>
      </div>
      {me?.isAdmin && showAccountSettings && (
        <div className="quick-actions" style={{ marginBottom: 10 }}>
          <a className="btn btn-ghost btn-sm" href="#settings-profile">Profile</a>
          <a className="btn btn-ghost btn-sm" href="#settings-integrations">Integrations</a>
          <a className="btn btn-ghost btn-sm" href="#settings-users">User Management</a>
          <a className="btn btn-ghost btn-sm" href="#settings-assignments">Assignments</a>
          <a className="btn btn-ghost btn-sm" href="#settings-ops">Operations</a>
          <a className="btn btn-ghost btn-sm" href="#settings-backups">Backups</a>
        </div>
      )}

      {success && <div className="success-msg">{success}</div>}
      <ErrorCallout error={error} />

      {/* ── Build Info ── */}
      {showAccountSettings && <div className="card mb-16" id="settings-profile">
        <div className="card-title">Build Info</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Frontend bundle: <code>{BUNDLE_VERSION}</code></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Server deploy: <code>{serverDeployVersion || 'unknown'}</code></div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Auth mode: <code>{healthMeta?.authMode || 'unknown'}</code></div>
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={copyDiagnostics} disabled={copyingDiagnostics}>
            {copyingDiagnostics ? 'Copying…' : 'Copy Diagnostics'}
          </button>
        </div>
        <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-muted)' }}>{diagnosticsText}</pre>
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
      </div>}

      {/* ── Profile ── */}
      {showAccountSettings && <div className="card mb-16" id="settings-integrations">
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
      </div>}

      {/* ── Google Sheets Sync (merged: health + details + config + runs) ── */}
      {showOperations && <div className="card mb-16" id="settings-ops">
        <div className="card-title">Google Sheets Sync</div>

        {/* Health summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <strong style={{ color: healthColor }}>
            {healthState === 'healthy' ? 'Healthy' : healthState === 'needs_attention' ? 'Needs attention' : 'Unknown'}
          </strong>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Last success: {formatDateTime(status?.health?.lastSuccessAt)}
          </span>
          {status?.health?.lastErrorAt && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              · Last error: {formatDateTime(status.health.lastErrorAt)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Saved locally: {formatDateTime(status?.freshness?.localLastSavedAt)}
          {' · '}Synced to Google: {formatDateTime(status?.freshness?.googleLastSyncedAt)}
        </div>
        {status?.health?.lastError?.details && (
          <div style={{ fontSize: 12, color: 'var(--red, #c0392b)', marginBottom: 8 }}>
            Last error: {status.health.lastError.details}
          </div>
        )}

        {/* Per-entity status */}
        <div style={{ margin: '12px 0', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {[
            ['Pipeline', status?.entities?.pipeline],
            ['Networking', status?.entities?.contacts],
            ['Interviews', status?.entities?.interviews],
            ['Events', status?.entities?.events]
          ].map(([label, run]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {run?.createdAt ? formatDateTime(run.createdAt) : 'No sync run yet'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${run?.status === 'ok' ? 'badge-green' : run?.status === 'error' ? 'badge-red' : ''}`}>
                  {run?.status || 'unknown'}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{describeRun(run)}</div>
                {!!run?.summary?.source && (Number(run.summary.source.mismatchedRows || 0) > 0 || Number(run.summary.source.blankLocalRows || 0) > 0 || Number(run.summary.source.blankSheetRows || 0) > 0) && (
                  <div style={{ fontSize: 12, color: 'var(--yellow)', marginTop: 2 }}>
                    Source warnings:
                    {' '}mismatch {Number(run.summary.source.mismatchedRows || 0)}
                    {' · '}blank local {Number(run.summary.source.blankLocalRows || 0)}
                    {' · '}blank sheet {Number(run.summary.source.blankSheetRows || 0)}
                    {' '}· Review Job Source values in Pipeline and re-run sync.
                    {canOpenPipelineCleanup ? (
                      <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('pipeline', { mode: 'source_missing' })}>
                          Fix Missing Sources
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('pipeline', { mode: 'source_custom' })}>
                          Review Custom Sources
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        Use candidate Pipeline views to resolve source warnings.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Connection config */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 4 }}>
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
            <button className="btn btn-ghost" onClick={checkSchema} disabled={checkingSchema}>
              {checkingSchema ? 'Checking…' : 'Check Sheet Mapping'}
            </button>
            <button className="btn btn-ghost" onClick={reconcileInterviews} disabled={reconcilingInterviews}>
              {reconcilingInterviews ? 'Repairing…' : 'Repair Interviews from Pipeline'}
            </button>
          </div>
        </div>

        {/* Schema check results */}
        {!!schemaReport && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Schema Check</div>
            {[
              ['Pipeline', schemaReport?.entities?.pipeline?.tabs || []],
              ['Networking', schemaReport?.entities?.contacts?.tabs || []],
              ['Interviews', schemaReport?.entities?.interviews?.tabs || []],
              ['Events', schemaReport?.entities?.events?.tabs || []]
            ].map(([sectionLabel, tabs]) => (
              <div key={`schema-${sectionLabel}`} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{sectionLabel}</div>
                {!tabs.length && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tabs configured.</div>}
                {tabs.map(tab => (
                  <div key={`schema-${sectionLabel}-${tab.tabName}`} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span style={{ color: 'var(--text)' }}>{tab.tabName}</span>
                    {`: core ${tab.coreMappedCount ?? 0}/${tab.coreTotal ?? 0} • total ${tab.mappedCount}/${tab.totalFields}`}
                    {tab.coreMissing?.length > 0 ? ` • Missing core: ${tab.coreMissing.join(', ')}` : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Recent runs — collapsible */}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Recent Runs {runs.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({runs.length})</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={downloadSyncLogs} disabled={downloadingLogs}>
                {downloadingLogs ? 'Downloading…' : 'Download CSV'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRuns(v => !v)}>
                {showRuns ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {showRuns && (
            <div style={{ marginTop: 8 }}>
              {!runs.length && <div style={{ color: 'var(--text-muted)' }}>No sync runs yet.</div>}
              {runs.slice(0, 20).map(run => (
                <div
                  key={run.id}
                  className="contact-row"
                  style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}
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
          )}
        </div>
      </div>}

      {/* ── Email Event Import (Gmail) ── */}
      {showOperations && <div className="card mb-16">
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
      </div>}

      {/* ── Assigned Users (staff/admin) ── */}
      {(me?.isAdmin || me?.role === 'staff') && showAssignedUsers && (
        <div className="card mb-16" id="settings-assigned-users">
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignedUsers.map(user => (
                  <tr key={`assigned-${user.id}`}>
                    <td>{user.username}</td>
                    <td>{user.email || '—'}</td>
                    <td>{user.role}</td>
                    <td>{user.mustChangePassword ? 'Required' : 'No'}</td>
                    <td>
                      {me?.role === 'staff' && user.role === 'job_seeker' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => staffResetAssignedUserPassword(user)}
                          disabled={staffResettingPasswordUserId === String(user.id)}
                        >
                          {staffResettingPasswordUserId === String(user.id) ? 'Resetting…' : 'Reset Password'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Admin: Team Access ── */}
      {me?.isAdmin && showUserManagement && (
        <div className="card mb-16" id="settings-users">
          <div className="card-title">User Management</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
            Create users, change roles, reset passwords, and control force-reset policy.
          </div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Create User</div>
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
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Manage Existing Users</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Password Reset</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map(user => (
                <tr key={`org-user-${user.id}`}>
                  <td>{user.username}</td>
                  <td>{user.email || '—'}</td>
                  <td>
                    <select
                      value={user.role}
                      disabled={updatingRoleUserId === String(user.id) || user.username === me?.username}
                      onChange={(e) => changeUserRole(user.id, e.target.value)}
                    >
                      <option value="job_seeker">job_seeker</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>{user.mustChangePassword ? 'Required' : 'No'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => resetUserPassword(user)}
                      disabled={resettingPasswordUserId === String(user.id)}
                    >
                      {resettingPasswordUserId === String(user.id) ? 'Resetting…' : 'Reset Password'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => toggleForceReset(user)}
                      disabled={togglingMustResetUserId === String(user.id)}
                    >
                      {togglingMustResetUserId === String(user.id)
                        ? 'Saving…'
                        : (user.mustChangePassword ? 'Clear Force Reset' : 'Force Reset')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Admin: Staff Assignments ── */}
      {me?.isAdmin && showAssignments && (
        <div className="card mb-16" id="settings-assignments">
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

      {/* ── Admin: Audit Log ── */}
      {me?.isAdmin && showOperations && (
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

      {me?.isAdmin && showOperations && (
        <div className="card mb-16">
          <div className="card-title">Admin Ops Status</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
            Quick view of background/operational job health from recent run history.
          </div>
          <div className="quick-actions" style={{ marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={syncNow} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Run Sheets Sync Now'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportBackup} disabled={exportingBackup}>
              {exportingBackup ? 'Exporting…' : 'Export Backup Now'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={runCostSnapshotNow} disabled={runningCostSnapshot}>
              {runningCostSnapshot ? 'Running…' : 'Run Cost Snapshot'}
            </button>
          </div>
          <table className="data-table" style={{ marginBottom: 10 }}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {opsStatusRows.map(row => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>
                    <span className={`badge ${row.status === 'ok' ? 'badge-green' : row.status === 'error' ? 'badge-red' : ''}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{formatDateTime(row.when)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Recent Failures</div>
          {!opsFailures.length && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No recent failed runs.</div>}
          {!!opsFailures.length && (
            <div>
              {opsFailures.map(run => (
                <div key={`ops-fail-${run.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{run.direction}</strong> · {formatDateTime(run.createdAt)}
                  {run.errorText ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{run.errorText}</div> : null}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 12, marginBottom: 6 }}>Scheduler Jobs (from latest cost snapshot)</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Use this to verify scheduled sync/backup cadence; refresh via “Run Cost Snapshot”.
          </div>
          {schedulerInfo.status && schedulerInfo.status !== 'not_found' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Status: {schedulerInfo.status}</div>
          )}
          {Number.isFinite(Number(schedulerInfo.jobCount)) && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Job count: {schedulerInfo.jobCount}
            </div>
          )}
          {!schedulerInfo.jobs.length && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              No scheduler job details found in the latest snapshot yet.
            </div>
          )}
          {!!schedulerInfo.jobs.length && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Schedule</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {schedulerInfo.jobs.map(job => (
                  <tr key={`scheduler-${job.name}-${job.schedule}`}>
                    <td>{job.name}</td>
                    <td>{job.schedule}</td>
                    <td>
                      <span className={`badge ${String(job.state).toUpperCase() === 'ENABLED' ? 'badge-green' : ''}`}>
                        {job.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 12, marginBottom: 6 }}>
            Scheduler Coverage ({schedulerCoverage.configured}/{schedulerCoverage.total})
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Expected Job</th>
                <th>Purpose</th>
                <th>Cadence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedulerCoverage.checks.map(job => (
                <tr key={`scheduler-check-${job.name}`}>
                  <td>{job.name}</td>
                  <td>{job.purpose}</td>
                  <td>{job.cadence}</td>
                  <td>
                    <span className={`badge ${job.configured ? 'badge-green' : ''}`}>
                      {job.configured ? 'configured' : 'missing'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {me?.isAdmin && showOperations && (
        <div className="card mb-16">
          <div className="card-title">Deployment Profile</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
            Lightweight production guardrails check (dev/prod split readiness).
          </div>
          <table className="data-table" style={{ marginBottom: 10 }}>
            <tbody>
              <tr>
                <th style={{ width: 220 }}>Server Deploy Version</th>
                <td>{deploymentProfile.deployVersion}</td>
              </tr>
              <tr>
                <th>Auth Mode</th>
                <td>{deploymentProfile.authMode}</td>
              </tr>
              <tr>
                <th>Profile Status</th>
                <td>
                  <span className={`badge ${deploymentProfile.riskFlags.length ? '' : 'badge-green'}`}>
                    {deploymentProfile.riskFlags.length ? 'needs attention' : 'ready'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          {!deploymentProfile.riskFlags.length && (
            <div style={{ color: 'var(--green)', fontSize: 12 }}>No immediate deployment profile risks detected.</div>
          )}
          {!!deploymentProfile.riskFlags.length && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Risks to address:</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', fontSize: 12 }}>
                {deploymentProfile.riskFlags.map(flag => (
                  <li key={`deploy-risk-${flag}`}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {me?.isAdmin && showOperations && (
        <div className="card mb-16">
          <div className="card-title">Cost Snapshot</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
            Snapshot includes Cloud Run scaling, scheduler jobs, artifact image count, logging exclusions, and budgets (when permitted).
          </div>
          <div className="quick-actions" style={{ marginBottom: 12 }}>
            <button className="btn btn-ghost" onClick={runCostSnapshotNow} disabled={runningCostSnapshot}>
              {runningCostSnapshot ? 'Running…' : 'Run Snapshot Now'}
            </button>
          </div>
          {!costSnapshots.length && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No snapshots yet.</div>
          )}
          {!!costSnapshots.length && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                Latest: {formatDateTime(new Date(costSnapshots[0].created_at).toISOString())}
              </div>
              <pre style={{ maxHeight: 320, overflow: 'auto', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {costSnapshots[0].summary_text}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Backup & Restore (admin only) ── */}
      {showOperations && <div className="card" id="settings-backups">
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
      </div>}
    </div>
  )
}
