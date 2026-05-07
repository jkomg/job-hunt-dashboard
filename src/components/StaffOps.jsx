import { useEffect, useMemo, useRef, useState } from 'react'

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

function fmt(ts) {
  if (!ts) return '—'
  const d = new Date(Number(ts))
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—'
}

function rel(ts) {
  if (!ts) return 'never'
  const d = new Date(Number(ts))
  if (!Number.isFinite(d.getTime())) return 'unknown'
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function SignalBadges({ signals }) {
  if (!signals) return null
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {signals.interviewActive && <span className="badge badge-red">Interview</span>}
      {signals.staleFollowUps && <span className="badge badge-yellow">Stale</span>}
      {signals.noRecentActivity && <span className="badge badge-blue">Inactive 7d</span>}
      {signals.rrPostedRecently && <span className="badge badge-green">RR 72h</span>}
    </span>
  )
}

export default function StaffOps({ me, mode = 'operations' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [queue, setQueue] = useState({ summary: {}, candidates: [], staffUsers: [], recommendations: [], tasks: [] })
  const [unassigned, setUnassigned] = useState([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [candidateSignalFilter, setCandidateSignalFilter] = useState('all')
  const [staffScope, setStaffScope] = useState(() => {
    try { return localStorage.getItem('staff_scope') || 'assigned' } catch { return 'assigned' }
  })

  // new candidate form
  const [showNewCandidate, setShowNewCandidate] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creatingCandidate, setCreatingCandidate] = useState(false)

  // self-assign
  const [selfAssignId, setSelfAssignId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // rec form
  const [recForm, setRecForm] = useState({ company: '', role: '', jobUrl: '', source: '', fitNote: '' })
  const [savingRec, setSavingRec] = useState(false)
  const [postingRecId, setPostingRecId] = useState('')
  const [notifyOnPost, setNotifyOnPost] = useState(true)

  // task form
  const [taskForm, setTaskForm] = useState({ assigneeUserId: '', type: 'research', priority: 'normal', dueDate: '', notes: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('open')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')
  const [taskDueFilter, setTaskDueFilter] = useState('all')

  // threads
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [threadMessages, setThreadMessages] = useState([])
  const [threadTopic, setThreadTopic] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageVisibility, setMessageVisibility] = useState('shared_with_candidate')
  const [creatingThread, setCreatingThread] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [threadStatusFilter, setThreadStatusFilter] = useState('open')
  const [threadActivityFilter, setThreadActivityFilter] = useState('all')

  // candidate support summary
  const [candidateSupportSummary, setCandidateSupportSummary] = useState(null)
  const summaryReqRef = useRef(0)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const staffQuery = (me?.isAdmin && staffScope === 'assigned') ? '?scope=assigned' : ''
      const [data, unassignedData] = await Promise.all([
        api(`/api/staff/queue${staffQuery}`),
        api('/api/staff/unassigned-candidates')
      ])
      setQueue(data)
      setUnassigned(unassignedData.candidates || [])
      if (!selectedCandidateId && data.candidates?.length) {
        setSelectedCandidateId(String(data.candidates[0].id))
      }
      if (me?.isAdmin && !taskForm.assigneeUserId) {
        const first = (data.staffUsers || [])[0]
        if (first?.id) setTaskForm(prev => ({ ...prev, assigneeUserId: String(first.id) }))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [me?.isAdmin, staffScope])
  useEffect(() => {
    try { localStorage.setItem('staff_scope', staffScope) } catch {}
  }, [staffScope])

  useEffect(() => {
    if (!selectedCandidateId) { setThreads([]); setSelectedThreadId(''); setThreadMessages([]); return }
    setThreads([]); setSelectedThreadId(''); setThreadMessages([])
    api(`/api/staff/candidates/${selectedCandidateId}/threads`)
      .then(d => { const list = d.threads || []; setThreads(list); setSelectedThreadId(list[0]?.id || '') })
      .catch(e => setError(e.message))
  }, [selectedCandidateId])

  useEffect(() => {
    if (!selectedThreadId) { setThreadMessages([]); return }
    api(`/api/staff/threads/${selectedThreadId}/messages`)
      .then(d => setThreadMessages(d.messages || []))
      .catch(e => setError(e.message))
  }, [selectedThreadId])

  useEffect(() => {
    if (!selectedCandidateId) { setCandidateSupportSummary(null); return }
    const reqId = ++summaryReqRef.current
    api(`/api/staff/candidates/${selectedCandidateId}/support-summary`)
      .then(d => { if (reqId === summaryReqRef.current) setCandidateSupportSummary(d.supportSummary || null) })
      .catch(e => { if (reqId === summaryReqRef.current) { setCandidateSupportSummary(null); setError(e.message) } })
  }, [selectedCandidateId])

  const candidateSignals = queue.candidateSignals || {}

  const visibleCandidates = useMemo(() => {
    const all = queue.candidates || []
    if (candidateSignalFilter === 'all') return all
    return all.filter(c => {
      const s = candidateSignals[Number(c.id)] || {}
      if (candidateSignalFilter === 'interview_active') return !!s.interviewActive
      if (candidateSignalFilter === 'stale_followups') return !!s.staleFollowUps
      if (candidateSignalFilter === 'no_recent_activity') return !!s.noRecentActivity
      if (candidateSignalFilter === 'rr_posted_recently') return !!s.rrPostedRecently
      return true
    })
  }, [queue.candidates, candidateSignals, candidateSignalFilter])

  useEffect(() => {
    if (!visibleCandidates.length) return
    if (!visibleCandidates.find(c => String(c.id) === String(selectedCandidateId))) {
      setSelectedCandidateId(String(visibleCandidates[0].id))
    }
  }, [visibleCandidates])

  const selectedCandidate = useMemo(
    () => (queue.candidates || []).find(c => String(c.id) === String(selectedCandidateId)) || null,
    [queue.candidates, selectedCandidateId]
  )
  const selectedCandidateSignals = useMemo(() => candidateSignals[Number(selectedCandidateId)] || null, [candidateSignals, selectedCandidateId])
  const signalSummary = useMemo(() => {
    const values = Object.values(candidateSignals || {})
    return {
      interviewActive: values.filter(s => s?.interviewActive).length,
      staleFollowUps: values.filter(s => s?.staleFollowUps).length,
      inactive7d: values.filter(s => s?.noRecentActivity).length,
      rrPosted72h: values.filter(s => s?.rrPostedRecently).length
    }
  }, [candidateSignals])

  const candidateRecommendations = useMemo(() => {
    const id = Number(selectedCandidateId)
    return (queue.recommendations || []).filter(r => Number(r.jobSeekerUserId) === id)
  }, [queue.recommendations, selectedCandidateId])

  const candidateTasks = useMemo(() => {
    const id = Number(selectedCandidateId)
    return (queue.tasks || []).filter(t => Number(t.relatedUserId) === id)
  }, [queue.tasks, selectedCandidateId])

  const filteredTasks = useMemo(() => {
    const now = Date.now()
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0)
    const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1)
    return candidateTasks.filter(t => {
      if (taskStatusFilter === 'open' && t.status === 'done') return false
      if (taskStatusFilter !== 'open' && taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false
      if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false
      if (taskDueFilter === 'all') return true
      if (!t.dueAt) return taskDueFilter === 'no_due'
      if (taskDueFilter === 'no_due') return false
      const due = Number(t.dueAt)
      if (taskDueFilter === 'overdue') return due < startToday.getTime() && t.status !== 'done'
      if (taskDueFilter === 'today') return due >= startToday.getTime() && due < endToday.getTime() && t.status !== 'done'
      if (taskDueFilter === 'upcoming') return due >= endToday.getTime() && t.status !== 'done'
      return true
    })
  }, [candidateTasks, taskStatusFilter, taskPriorityFilter, taskDueFilter])

  const selectedThread = useMemo(() => threads.find(t => t.id === selectedThreadId) || null, [threads, selectedThreadId])

  const filteredThreads = useMemo(() => {
    const staleMs = 48 * 60 * 60 * 1000
    return threads.filter(t => {
      if (threadStatusFilter === 'open' && t.status === 'closed') return false
      if (threadStatusFilter !== 'open' && threadStatusFilter !== 'all' && t.status !== threadStatusFilter) return false
      const updatedAt = Number(t.updatedAt || t.createdAt || 0)
      const isStale = t.status === 'open' && updatedAt > 0 && (Date.now() - updatedAt) > staleMs
      if (threadActivityFilter === 'stale' && !isStale) return false
      if (threadActivityFilter === 'fresh' && isStale) return false
      return true
    }).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
  }, [threads, threadStatusFilter, threadActivityFilter])

  async function createCandidate() {
    setCreatingCandidate(true); setError(''); setSuccess('')
    try {
      const res = await api('/api/staff/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, email: newEmail || undefined })
      })
      setSuccess(`Candidate "${res.username}" created and assigned to you.`)
      setNewUsername(''); setNewPassword(''); setNewEmail('')
      setShowNewCandidate(false)
      await load()
      setSelectedCandidateId(String(res.id))
    } catch (e) { setError(e.message) }
    finally { setCreatingCandidate(false) }
  }

  async function selfAssign() {
    if (!selfAssignId) return
    setAssigning(true); setError(''); setSuccess('')
    try {
      await api('/api/staff/self-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobSeekerUserId: Number(selfAssignId) })
      })
      setSuccess('Assigned successfully.')
      setSelfAssignId('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setAssigning(false) }
  }

  async function createRecommendation() {
    setSavingRec(true); setError(''); setSuccess('')
    try {
      await api('/api/staff/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobSeekerUserId: Number(selectedCandidateId), ...recForm })
      })
      setRecForm({ company: '', role: '', jobUrl: '', source: '', fitNote: '' })
      setSuccess('Recommendation saved as draft.')
      await load()
    } catch (e) { setError(e.message) }
    finally { setSavingRec(false) }
  }

  async function postToPipeline(rec) {
    setPostingRecId(rec.id); setError(''); setSuccess('')
    try {
      const result = await api(`/api/staff/recommendations/${rec.id}/post-to-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyCandidate: notifyOnPost })
      })
      setSuccess(result?.notification ? 'Posted and notified candidate.' : 'Posted to pipeline.')
      await load()
    } catch (e) { setError(e.message) }
    finally { setPostingRecId('') }
  }

  async function createTask() {
    setSavingTask(true); setError(''); setSuccess('')
    try {
      await api('/api/staff/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relatedUserId: selectedCandidateId ? Number(selectedCandidateId) : null,
          assigneeUserId: me?.isAdmin && taskForm.assigneeUserId ? Number(taskForm.assigneeUserId) : undefined,
          type: taskForm.type,
          priority: taskForm.priority,
          dueAt: taskForm.dueDate ? new Date(`${taskForm.dueDate}T12:00:00`).getTime() : null,
          notes: taskForm.notes
        })
      })
      setTaskForm(prev => ({ ...prev, type: 'research', priority: 'normal', dueDate: '', notes: '' }))
      setSuccess('Task created.')
      await load()
    } catch (e) { setError(e.message) }
    finally { setSavingTask(false) }
  }

  async function updateTaskStatus(task, status) {
    setUpdatingTaskId(task.id); setError(''); setSuccess('')
    try {
      await api(`/api/staff/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      await load()
    } catch (e) { setError(e.message) }
    finally { setUpdatingTaskId('') }
  }

  async function reassignTask(task, assigneeUserId) {
    setUpdatingTaskId(task.id); setError('')
    try {
      await api(`/api/staff/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigneeUserId: Number(assigneeUserId) }) })
      await load()
    } catch (e) { setError(e.message) }
    finally { setUpdatingTaskId('') }
  }

  async function createThread() {
    setCreatingThread(true); setError(''); setSuccess('')
    try {
      await api(`/api/staff/candidates/${selectedCandidateId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: threadTopic })
      })
      setThreadTopic('')
      const d = await api(`/api/staff/candidates/${selectedCandidateId}/threads`)
      setThreads(d.threads || [])
      setSelectedThreadId((d.threads || [])[0]?.id || '')
      setSuccess('Thread created.')
    } catch (e) { setError(e.message) }
    finally { setCreatingThread(false) }
  }

  async function sendMessage() {
    setSendingMessage(true); setError(''); setSuccess('')
    try {
      await api(`/api/staff/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: messageBody, visibility: messageVisibility })
      })
      setMessageBody('')
      const d = await api(`/api/staff/threads/${selectedThreadId}/messages`)
      setThreadMessages(d.messages || [])
    } catch (e) { setError(e.message) }
    finally { setSendingMessage(false) }
  }

  async function updateThreadStatus(status) {
    if (!selectedThread) return
    try {
      await api(`/api/staff/threads/${selectedThread.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const d = await api(`/api/staff/candidates/${selectedCandidateId}/threads`)
      setThreads(d.threads || [])
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="loading"><div className="spin" />Loading staff workspace…</div>

  const showQueueSummary = mode === 'operations'
  const showRecommendations = mode === 'operations'
  const showTasks = mode === 'operations' || mode === 'tasks'
  const showThreads = mode === 'operations' || mode === 'threads'
  const title = mode === 'tasks' ? 'Tasks' : mode === 'threads' ? 'Threads' : 'Operations'
  const isAllScope = queue.summary?.scope === 'all'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <div className="subtle">Assigned-candidate workspace for recommendations, tasks, and conversations.</div>
        </div>
      </div>
      {me?.isAdmin && (
        <div className="quick-actions mb-16">
          <button className={`btn btn-sm ${staffScope === 'assigned' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStaffScope('assigned')}>My Queue</button>
          <button className={`btn btn-sm ${staffScope === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStaffScope('all')}>All Candidates</button>
        </div>
      )}
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
        Viewing: {queue.summary?.scope === 'all' ? 'All Candidates' : 'My Assigned Candidates'}
      </div>

      {error && <div className="error-msg mb-16">{error}</div>}
      {success && <div className="success-msg mb-16">{success}</div>}

      {/* Queue Summary */}
      {showQueueSummary && <div className="card mb-16">
        <div className="card-title">Queue Summary</div>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">{isAllScope ? 'Total Candidates' : 'Assigned Candidates'}</div><div className="stat-value">{queue.summary?.candidates || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Unposted Recs</div><div className="stat-value">{queue.summary?.recommendationsDraft || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Posted to Pipelines</div><div className="stat-value">{queue.summary?.recommendationsPosted || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Tasks Open</div><div className="stat-value">{(queue.summary?.tasksTodo || 0) + (queue.summary?.tasksInProgress || 0)}</div></div>
          <div className="stat-card"><div className="stat-label">Open Threads</div><div className="stat-value">{queue.summary?.threadsOpen || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Stale Threads</div><div className="stat-value">{queue.summary?.threadsStale48h || 0}</div></div>
        </div>
        <div className="stats-grid" style={{ marginTop: 10 }}>
          <div className="stat-card"><div className="stat-label">Interview Active</div><div className="stat-value">{signalSummary.interviewActive}</div></div>
          <div className="stat-card"><div className="stat-label">Stale Follow-Ups</div><div className="stat-value">{signalSummary.staleFollowUps}</div></div>
          <div className="stat-card"><div className="stat-label">Inactive 7d</div><div className="stat-value">{signalSummary.inactive7d}</div></div>
          <div className="stat-card"><div className="stat-label">RR Posted 72h</div><div className="stat-value">{signalSummary.rrPosted72h}</div></div>
        </div>
      </div>}

      {/* Candidates */}
      <div className="card mb-16">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Candidates</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNewCandidate(v => !v)}>
            {showNewCandidate ? 'Cancel' : '+ New Candidate'}
          </button>
        </div>

        {showNewCandidate && (
          <div style={{ background: 'var(--bg-alt)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Create Candidate Account</div>
            <div className="settings-grid">
              <div className="field">
                <label>Username</label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="jane.doe" />
              </div>
              <div className="field">
                <label>Temp Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="10+ characters" />
              </div>
              <div className="field">
                <label>Email (optional)</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={createCandidate}
              disabled={creatingCandidate || !newUsername.trim() || newPassword.length < 10}>
              {creatingCandidate ? 'Creating…' : 'Create & Assign'}
            </button>
          </div>
        )}

        {!!unassigned.length && (
          <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Assign Existing Candidate to Me</label>
              <select value={selfAssignId} onChange={e => setSelfAssignId(e.target.value)}>
                <option value="">— pick a candidate —</option>
                {unassigned.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </div>
            <button className="btn btn-ghost" onClick={selfAssign} disabled={assigning || !selfAssignId}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        )}

        {/* Candidate overview table */}
        {!!(queue.candidates || []).length && (
          <table className="data-table" style={{ marginBottom: 14 }}>
            <thead>
              <tr>
                <th>
                  <select value={candidateSignalFilter} onChange={e => setCandidateSignalFilter(e.target.value)}
                    style={{ fontSize: 12, background: 'transparent', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                    <option value="all">All Candidates</option>
                    <option value="interview_active">Interview Active</option>
                    <option value="stale_followups">Stale Follow-ups</option>
                    <option value="no_recent_activity">Inactive 7d+</option>
                    <option value="rr_posted_recently">RR Post 72h</option>
                  </select>
                </th>
                <th>Queue</th>
                <th>Stale</th>
                <th>Follow-ups Due</th>
                <th>Last Check-in</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {visibleCandidates.map(c => {
                const sig = candidateSignals[Number(c.id)] || {}
                const sum = c.supportSummary || {}
                const isSelected = String(c.id) === String(selectedCandidateId)
                return (
                  <tr key={c.id}
                    onClick={() => setSelectedCandidateId(String(c.id))}
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--bg-alt)' : undefined, fontWeight: isSelected ? 600 : undefined }}>
                    <td>{c.username}</td>
                    <td>{sum.queueSize ?? '—'}</td>
                    <td>{sum.staleTotal ?? '—'}</td>
                    <td>{sum.duePipelineFollowUps ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sum.lastCheckInDate ? `${sum.lastCheckInDate}` : 'none'}</td>
                    <td><SignalBadges signals={sig} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!!(queue.candidates || []).length && !visibleCandidates.length && (
          <div style={{ color: 'var(--text-muted)' }}>No candidates match this filter.</div>
        )}
        {!(queue.candidates || []).length && (
          <div style={{ color: 'var(--text-muted)' }}>No candidates assigned yet. Create or assign one above.</div>
        )}
      </div>

      {/* Candidate context — everything below is scoped to selected candidate */}
      {!!selectedCandidate && (
        <div style={{ background: 'var(--bg-alt)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>Working on: {selectedCandidate.username}</span>
          <SignalBadges signals={selectedCandidateSignals} />
          {candidateSupportSummary && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Last check-in: {candidateSupportSummary.lastCheckInDate || 'none'} ({rel(candidateSupportSummary.lastCheckInAt)})
              {' · '}Queue: {candidateSupportSummary.queueSize || 0}
              {' · '}Stale: {candidateSupportSummary.staleTotal || 0}
              {' · '}Follow-ups due: {candidateSupportSummary.duePipelineFollowUps || 0}
            </span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <select value={selectedCandidateId} onChange={e => setSelectedCandidateId(e.target.value)}
              style={{ fontSize: 13 }}>
              {(queue.candidates || []).map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Research & Recommend */}
      {showRecommendations && !!selectedCandidateId && (
        <div className="card mb-16">
          <div className="card-title">Research &amp; Recommend</div>
          <div className="settings-grid">
            <div className="field"><label>Company</label><input value={recForm.company} onChange={e => setRecForm({ ...recForm, company: e.target.value })} /></div>
            <div className="field"><label>Role</label><input value={recForm.role} onChange={e => setRecForm({ ...recForm, role: e.target.value })} /></div>
            <div className="field"><label>Job URL</label><input value={recForm.jobUrl} onChange={e => setRecForm({ ...recForm, jobUrl: e.target.value })} /></div>
            <div className="field"><label>Source</label><input value={recForm.source} onChange={e => setRecForm({ ...recForm, source: e.target.value })} /></div>
          </div>
          <div className="field"><label>Fit Note</label><textarea rows={2} value={recForm.fitNote} onChange={e => setRecForm({ ...recForm, fitNote: e.target.value })} /></div>
          <div className="quick-actions" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={createRecommendation}
              disabled={savingRec || !recForm.company.trim()}>
              {savingRec ? 'Saving…' : 'Save as Draft'}
            </button>
          </div>

          {!candidateRecommendations.length && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recommendations yet for {selectedCandidate?.username}.</div>}
          {!!candidateRecommendations.length && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={notifyOnPost} onChange={e => setNotifyOnPost(e.target.checked)} />
                  Notify candidate in Inbox when posting
                </label>
              </div>
              <table className="data-table">
                <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {candidateRecommendations.map(rec => (
                    <tr key={rec.id}>
                      <td>{rec.company}</td>
                      <td>{rec.role || '—'}</td>
                      <td><span className={`badge ${rec.status === 'posted' ? 'badge-green' : ''}`}>{rec.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(rec.updatedAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm"
                          disabled={rec.status === 'posted' || postingRecId === rec.id}
                          onClick={() => postToPipeline(rec)}>
                          {postingRecId === rec.id ? 'Posting…' : rec.status === 'posted' ? 'Posted ✓' : 'Post to Pipeline'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Tasks */}
      {showTasks && !!selectedCandidateId && (
        <>
          <div className="card mb-16">
            <div className="card-title">New Task</div>
            <div className="settings-grid">
              {me?.isAdmin && (
                <div className="field">
                  <label>Assign To</label>
                  <select value={taskForm.assigneeUserId} onChange={e => setTaskForm({ ...taskForm, assigneeUserId: e.target.value })}>
                    <option value="">Select staff</option>
                    {(queue.staffUsers || []).map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label>Type</label>
                <select value={taskForm.type} onChange={e => setTaskForm({ ...taskForm, type: e.target.value })}>
                  <option value="research">Research</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="interview_prep">Interview Prep</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="field">
                <label>Due Date</label>
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="field"><label>Notes</label><textarea rows={2} value={taskForm.notes} onChange={e => setTaskForm({ ...taskForm, notes: e.target.value })} /></div>
            <button className="btn btn-primary" onClick={createTask}
              disabled={savingTask || !taskForm.notes.trim() || (me?.isAdmin && !taskForm.assigneeUserId)}>
              {savingTask ? 'Creating…' : 'Create Task'}
            </button>
          </div>

          <div className="card mb-16">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="card-title" style={{ margin: 0 }}>Tasks — {selectedCandidate?.username}</div>
              <select value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="open">Open</option>
                <option value="all">All</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="all">Any Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <select value={taskDueFilter} onChange={e => setTaskDueFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="all">Any Due</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="no_due">No Due Date</option>
              </select>
            </div>
            {!filteredTasks.length && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tasks match these filters.</div>}
            {!!filteredTasks.length && (
              <table className="data-table">
                <thead><tr>
                  {me?.isAdmin && <th>Assignee</th>}
                  <th>Type</th><th>Priority</th><th>Status</th><th>Due</th><th>Notes</th><th />
                </tr></thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id}>
                      {me?.isAdmin && (
                        <td>
                          <select value={String(task.assigneeUserId || '')} disabled={updatingTaskId === task.id}
                            onChange={e => reassignTask(task, e.target.value)}>
                            {(queue.staffUsers || []).map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                          </select>
                        </td>
                      )}
                      <td>{task.type}</td>
                      <td>{task.priority}</td>
                      <td><span className={`badge ${task.status === 'done' ? 'badge-green' : task.status === 'in_progress' ? 'badge-yellow' : ''}`}>{task.status}</span></td>
                      <td style={{ fontSize: 12 }}>
                        {fmt(task.dueAt)}
                        {task.dueAt && task.status !== 'done' && Number(task.dueAt) < Date.now() && (
                          <span className="badge badge-red" style={{ marginLeft: 4 }}>Overdue</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 200, fontSize: 13 }}>{task.notes || '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {task.status !== 'in_progress' && task.status !== 'done' && (
                          <button className="btn btn-ghost btn-sm" disabled={updatingTaskId === task.id} onClick={() => updateTaskStatus(task, 'in_progress')}>Start</button>
                        )}
                        {task.status !== 'done' && (
                          <button className="btn btn-ghost btn-sm" disabled={updatingTaskId === task.id} onClick={() => updateTaskStatus(task, 'done')}>Done</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Threads */}
      {showThreads && !!selectedCandidateId && (
        <>
          <div className="card mb-16">
            <div className="card-title">New Thread</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
              Threads are conversations about a candidate — shared with them or internal staff-only notes.
            </div>
            <div className="settings-grid">
              <div className="field">
                <label>Topic</label>
                <input value={threadTopic} onChange={e => setThreadTopic(e.target.value)} placeholder="e.g. Interview prep, follow-up strategy…" />
              </div>
              <div className="field">
                <label>&nbsp;</label>
                <button className="btn btn-primary" onClick={createThread} disabled={creatingThread || !threadTopic.trim()}>
                  {creatingThread ? 'Creating…' : 'Create Thread'}
                </button>
              </div>
            </div>
          </div>

          <div className="card mb-16">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="card-title" style={{ margin: 0 }}>Threads — {selectedCandidate?.username}</div>
              <select value={threadStatusFilter} onChange={e => setThreadStatusFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="open">Open</option>
                <option value="all">All</option>
                <option value="closed">Closed</option>
              </select>
              <select value={threadActivityFilter} onChange={e => setThreadActivityFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="all">Any Activity</option>
                <option value="stale">Stale 48h+</option>
                <option value="fresh">Fresh &lt; 48h</option>
              </select>
            </div>

            {!filteredThreads.length && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No threads yet.</div>}
            {!!filteredThreads.length && (
              <table className="data-table" style={{ marginBottom: 12 }}>
                <thead><tr><th>Topic</th><th>Status</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {filteredThreads.map(t => {
                    const updatedAt = Number(t.updatedAt || t.createdAt || 0)
                    const isStale = t.status === 'open' && updatedAt > 0 && (Date.now() - updatedAt) > 48 * 60 * 60 * 1000
                    const active = selectedThreadId === t.id
                    return (
                      <tr key={t.id} style={{ background: active ? 'var(--bg-alt)' : undefined }}>
                        <td style={{ fontWeight: active ? 600 : 500 }}>{t.topic}</td>
                        <td>
                          <span className={`badge ${t.status === 'closed' ? 'badge-yellow' : 'badge-green'}`}>
                            {t.status === 'closed' ? 'Closed' : 'Open'}
                          </span>
                          {isStale && <span className="badge badge-red" style={{ marginLeft: 6 }}>Stale</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rel(updatedAt || t.createdAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedThreadId(t.id)}>
                            {active ? 'Viewing' : 'Open'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {!!selectedThreadId && (
              <div>
                <div className="quick-actions" style={{ marginBottom: 10 }}>
                  {selectedThread?.status !== 'closed'
                    ? <button className="btn btn-ghost btn-sm" onClick={() => updateThreadStatus('closed')}>Close Thread</button>
                    : <button className="btn btn-ghost btn-sm" onClick={() => updateThreadStatus('open')}>Reopen Thread</button>
                  }
                </div>

                {selectedThread?.status === 'closed' && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>Thread is closed — reopen to send messages.</div>
                )}

                <div className="field"><label>Message</label><textarea rows={3} value={messageBody} onChange={e => setMessageBody(e.target.value)} /></div>
                <div className="settings-grid" style={{ marginBottom: 10 }}>
                  <div className="field">
                    <label>Visibility</label>
                    <select value={messageVisibility} onChange={e => setMessageVisibility(e.target.value)}>
                      <option value="shared_with_candidate">Shared with candidate</option>
                      <option value="internal_staff">Internal staff only</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>&nbsp;</label>
                    <button className="btn btn-primary" onClick={sendMessage}
                      disabled={sendingMessage || !messageBody.trim() || selectedThread?.status === 'closed'}>
                      {sendingMessage ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>

                {!!threadMessages.length && (
                  <table className="data-table">
                    <thead><tr><th>When</th><th>Author</th><th>Visibility</th><th>Message</th></tr></thead>
                    <tbody>
                      {threadMessages.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(m.createdAt)}</td>
                          <td>{m.authorUsername || m.authorUserId}</td>
                          <td><span className={`badge ${m.visibility === 'internal_staff' ? 'badge-yellow' : ''}`}>{m.visibility === 'internal_staff' ? 'Internal' : 'Shared'}</span></td>
                          <td style={{ fontSize: 13 }}>{m.body}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
