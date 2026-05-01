import { useEffect, useMemo, useRef, useState } from 'react'

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

function formatDateTime(ts) {
  if (!ts) return '—'
  const d = new Date(Number(ts))
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString()
}

function formatRelative(ts) {
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

export default function StaffOps({ me }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [queue, setQueue] = useState({ summary: {}, candidates: [], staffUsers: [], recommendations: [], tasks: [] })
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [savingRec, setSavingRec] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [postingRecId, setPostingRecId] = useState('')
  const [updatingTaskId, setUpdatingTaskId] = useState('')
  const [form, setForm] = useState({
    company: '',
    role: '',
    jobUrl: '',
    source: '',
    fitNote: ''
  })
  const [taskForm, setTaskForm] = useState({
    assigneeUserId: '',
    type: 'research',
    priority: 'normal',
    dueDate: '',
    notes: ''
  })
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')
  const [taskDueFilter, setTaskDueFilter] = useState('all')
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('all')
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [threadMessages, setThreadMessages] = useState([])
  const [creatingThread, setCreatingThread] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [threadTopic, setThreadTopic] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageVisibility, setMessageVisibility] = useState('shared_with_candidate')
  const [threadStatusFilter, setThreadStatusFilter] = useState('all')
  const [threadStaleFilter, setThreadStaleFilter] = useState('all')
  const [candidateSignalFilter, setCandidateSignalFilter] = useState('all')
  const [candidateSupportSummary, setCandidateSupportSummary] = useState(null)
  const candidateSummaryRequestRef = useRef(0)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api('/api/staff/queue')
      setQueue(data)
      if (!selectedCandidateId && data.candidates?.length) {
        setSelectedCandidateId(String(data.candidates[0].id))
      }
      if (me?.isAdmin && !taskForm.assigneeUserId) {
        const first = (data.staffUsers || [])[0]
        if (first?.id) {
          setTaskForm(prev => ({ ...prev, assigneeUserId: String(first.id) }))
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    async function loadThreads() {
      if (!selectedCandidateId) {
        setThreads([])
        setSelectedThreadId('')
        setThreadMessages([])
        return
      }
      // Clear previous candidate context immediately to prevent stale sends.
      setThreads([])
      setSelectedThreadId('')
      setThreadMessages([])
      try {
        const d = await api(`/api/staff/candidates/${selectedCandidateId}/threads`)
        const list = d.threads || []
        setThreads(list)
        if (!list.find(t => t.id === selectedThreadId)) {
          setSelectedThreadId(list[0]?.id || '')
        }
      } catch (e) {
        setError(e.message)
      }
    }
    loadThreads()
  }, [selectedCandidateId])

  useEffect(() => {
    async function loadMessages() {
      if (!selectedThreadId) {
        setThreadMessages([])
        return
      }
      try {
        const d = await api(`/api/staff/threads/${selectedThreadId}/messages`)
        setThreadMessages(d.messages || [])
      } catch (e) {
        setError(e.message)
      }
    }
    loadMessages()
  }, [selectedThreadId])

  useEffect(() => {
    async function loadCandidateSummary() {
      if (!selectedCandidateId) {
        setCandidateSupportSummary(null)
        return
      }
      const requestId = ++candidateSummaryRequestRef.current
      try {
        const d = await api(`/api/staff/candidates/${selectedCandidateId}/support-summary`)
        if (requestId !== candidateSummaryRequestRef.current) return
        setCandidateSupportSummary(d.supportSummary || null)
      } catch (e) {
        if (requestId !== candidateSummaryRequestRef.current) return
        setCandidateSupportSummary(null)
        setError(e.message)
      }
    }
    loadCandidateSummary()
  }, [selectedCandidateId])

  const candidateRecommendations = useMemo(() => {
    const id = Number(selectedCandidateId)
    return (queue.recommendations || []).filter(r => Number(r.jobSeekerUserId) === id)
  }, [queue.recommendations, selectedCandidateId])
  const candidateTasks = useMemo(() => {
    const id = Number(selectedCandidateId)
    return (queue.tasks || []).filter(t => Number(t.relatedUserId) === id)
  }, [queue.tasks, selectedCandidateId])
  const filteredCandidateTasks = useMemo(() => {
    const startToday = new Date()
    startToday.setHours(0, 0, 0, 0)
    const endToday = new Date(startToday)
    endToday.setDate(endToday.getDate() + 1)
    return candidateTasks.filter(task => {
      if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false
      if (taskPriorityFilter !== 'all' && task.priority !== taskPriorityFilter) return false
      if (taskAssigneeFilter !== 'all' && Number(task.assigneeUserId) !== Number(taskAssigneeFilter)) return false
      if (taskDueFilter === 'all') return true
      if (!task.dueAt) return taskDueFilter === 'no_due'
      if (taskDueFilter === 'no_due') return false
      const due = Number(task.dueAt)
      if (taskDueFilter === 'overdue') return due < startToday.getTime() && task.status !== 'done'
      if (taskDueFilter === 'today') return due >= startToday.getTime() && due < endToday.getTime() && task.status !== 'done'
      if (taskDueFilter === 'upcoming') return due >= endToday.getTime() && task.status !== 'done'
      return true
    })
  }, [candidateTasks, taskStatusFilter, taskPriorityFilter, taskDueFilter, taskAssigneeFilter])
  const selectedThread = useMemo(
    () => (threads || []).find(t => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  )
  const filteredThreads = useMemo(() => {
    const staleMs = 48 * 60 * 60 * 1000
    return (threads || []).filter(t => {
      const isStale = (Date.now() - Number(t.updatedAt || 0)) > staleMs
      if (threadStatusFilter !== 'all' && t.status !== threadStatusFilter) return false
      if (threadStaleFilter === 'stale' && !isStale) return false
      if (threadStaleFilter === 'fresh' && isStale) return false
      return true
    })
  }, [threads, threadStatusFilter, threadStaleFilter])
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
  const selectedCandidateSignals = useMemo(() => {
    return candidateSignals[Number(selectedCandidateId)] || null
  }, [candidateSignals, selectedCandidateId])

  useEffect(() => {
    if (!visibleCandidates.length) return
    if (!visibleCandidates.find(c => String(c.id) === String(selectedCandidateId))) {
      setSelectedCandidateId(String(visibleCandidates[0].id))
    }
  }, [visibleCandidates, selectedCandidateId])

  async function createRecommendation() {
    setSavingRec(true)
    setError('')
    setSuccess('')
    try {
      await api('/api/staff/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobSeekerUserId: Number(selectedCandidateId),
          company: form.company,
          role: form.role,
          jobUrl: form.jobUrl,
          source: form.source,
          fitNote: form.fitNote
        })
      })
      setForm({ company: '', role: '', jobUrl: '', source: '', fitNote: '' })
      setSuccess('Recommendation saved.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingRec(false)
    }
  }

  async function postToPipeline(rec) {
    setPostingRecId(rec.id)
    setError('')
    setSuccess('')
    try {
      await api(`/api/staff/recommendations/${rec.id}/post-to-pipeline`, { method: 'POST' })
      setSuccess('Posted to candidate pipeline.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setPostingRecId('')
    }
  }

  async function createTask() {
    setSavingTask(true)
    setError('')
    setSuccess('')
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
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingTask(false)
    }
  }

  async function updateTaskStatus(task, status) {
    setUpdatingTaskId(task.id)
    setError('')
    setSuccess('')
    try {
      await api(`/api/staff/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      setSuccess('Task updated.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setUpdatingTaskId('')
    }
  }

  async function createThread() {
    setCreatingThread(true)
    setError('')
    setSuccess('')
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
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingThread(false)
    }
  }

  async function sendMessage() {
    setSendingMessage(true)
    setError('')
    setSuccess('')
    try {
      await api(`/api/staff/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: messageBody, visibility: messageVisibility })
      })
      setMessageBody('')
      const d = await api(`/api/staff/threads/${selectedThreadId}/messages`)
      setThreadMessages(d.messages || [])
      setSuccess('Message sent.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSendingMessage(false)
    }
  }

  async function updateThreadStatus(status) {
    if (!selectedThread) return
    setError('')
    setSuccess('')
    try {
      await api(`/api/staff/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const d = await api(`/api/staff/candidates/${selectedCandidateId}/threads`)
      setThreads(d.threads || [])
      setSuccess(`Thread marked ${status}.`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function reassignTask(task, assigneeUserId) {
    setUpdatingTaskId(task.id)
    setError('')
    setSuccess('')
    try {
      await api(`/api/staff/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeUserId: Number(assigneeUserId) })
      })
      setSuccess('Task reassigned.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setUpdatingTaskId('')
    }
  }

  if (loading) {
    return <div className="loading"><div className="spin" />Loading staff workspace…</div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff Ops</h1>
          <div className="subtle">Research jobs, distribute opportunities, and track assigned candidate support.</div>
        </div>
      </div>

      {error && <div className="error-msg mb-16">{error}</div>}
      {success && <div className="success-msg mb-16">{success}</div>}

      <div className="card mb-16">
        <div className="card-title">Queue Summary</div>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Candidates</div><div className="stat-value">{queue.summary?.candidates || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Draft Recs</div><div className="stat-value">{queue.summary?.recommendationsDraft || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Posted Recs</div><div className="stat-value">{queue.summary?.recommendationsPosted || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Tasks Todo</div><div className="stat-value">{queue.summary?.tasksTodo || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Open Threads</div><div className="stat-value">{queue.summary?.threadsOpen || 0}</div></div>
          <div className="stat-card"><div className="stat-label">Stale Threads (48h+)</div><div className="stat-value">{queue.summary?.threadsStale48h || 0}</div></div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Candidates</div>
        <div className="settings-grid">
          <div className="field">
            <label>Focus Filter</label>
            <select value={candidateSignalFilter} onChange={e => setCandidateSignalFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="interview_active">interview_active</option>
              <option value="stale_followups">stale_followups</option>
              <option value="no_recent_activity">no_recent_activity_7d</option>
              <option value="rr_posted_recently">new_rr_jobs_72h</option>
            </select>
          </div>
        </div>
        {!queue.candidates?.length && <div style={{ color: 'var(--text-muted)' }}>No candidates assigned yet.</div>}
        {!!visibleCandidates.length && (
          <div className="tabs">
            {visibleCandidates.map(c => (
              <button
                key={c.id}
                className={`tab ${String(c.id) === String(selectedCandidateId) ? 'active' : ''}`}
                onClick={() => setSelectedCandidateId(String(c.id))}
              >
                {c.username}
              </button>
            ))}
          </div>
        )}
        {!!queue.candidates?.length && !visibleCandidates.length && (
          <div style={{ color: 'var(--text-muted)' }}>No candidates match this filter.</div>
        )}
        {!!selectedCandidateId && !!selectedCandidateSignals && (
          <div className="quick-actions" style={{ marginTop: 8 }}>
            {selectedCandidateSignals.interviewActive && <span className="badge badge-red">Interview Active</span>}
            {selectedCandidateSignals.staleFollowUps && <span className="badge badge-yellow">Stale Follow-ups</span>}
            {selectedCandidateSignals.noRecentActivity && <span className="badge badge-blue">No Check-in 7d+</span>}
            {selectedCandidateSignals.rrPostedRecently && <span className="badge badge-green">RR Post 72h</span>}
          </div>
        )}
        {!!selectedCandidateId && !!candidateSupportSummary && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
              Last check-in: {candidateSupportSummary.lastCheckInDate || 'none'} ({formatRelative(candidateSupportSummary.lastCheckInAt)})
            </div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-label">Queue</div><div className="stat-value">{candidateSupportSummary.queueSize || 0}</div></div>
              <div className="stat-card"><div className="stat-label">Stale</div><div className="stat-value">{candidateSupportSummary.staleTotal || 0}</div></div>
              <div className="stat-card"><div className="stat-label">Follow-ups Due</div><div className="stat-value">{candidateSupportSummary.duePipelineFollowUps || 0}</div></div>
              <div className="stat-card"><div className="stat-label">Interview Actions</div><div className="stat-value">{(candidateSupportSummary.dueInterviewActions || 0) + (candidateSupportSummary.upcomingInterviews || 0)}</div></div>
            </div>
            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Top candidate queue items</div>
            {!candidateSupportSummary.topQueue?.length && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active queue items.</div>
            )}
            {!!candidateSupportSummary.topQueue?.length && (
              <div style={{ marginTop: 6 }}>
                {candidateSupportSummary.topQueue.map(item => (
                  <div key={`queue-${item.id}`} className="contact-row" style={{ padding: '6px 0' }}>
                    <div className="contact-info">
                      <div className="contact-name">{item.title}</div>
                      <div className="contact-meta">{item.type || 'queue_item'} {item.dueDate ? `· due ${item.dueDate}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card mb-16">
        <div className="card-title">Job Research</div>
        <div className="settings-grid">
          <div className="field">
            <label>Company</label>
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="field">
            <label>Role</label>
            <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          </div>
          <div className="field">
            <label>Job URL</label>
            <input value={form.jobUrl} onChange={e => setForm({ ...form, jobUrl: e.target.value })} />
          </div>
          <div className="field">
            <label>Source</label>
            <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Fit Note</label>
          <textarea rows={3} value={form.fitNote} onChange={e => setForm({ ...form, fitNote: e.target.value })} />
        </div>
        <button
          className="btn btn-primary"
          onClick={createRecommendation}
          disabled={savingRec || !selectedCandidateId || !form.company.trim()}
        >
          {savingRec ? 'Saving…' : 'Save Recommendation'}
        </button>
      </div>

      <div className="card mb-16">
        <div className="card-title">Distribution</div>
        {!candidateRecommendations.length && <div style={{ color: 'var(--text-muted)' }}>No recommendations for this candidate yet.</div>}
        {!!candidateRecommendations.length && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidateRecommendations.map(rec => (
                <tr key={rec.id}>
                  <td>{rec.company}</td>
                  <td>{rec.role || '—'}</td>
                  <td>{rec.status}</td>
                  <td>{formatDateTime(rec.updatedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={rec.status === 'posted' || postingRecId === rec.id}
                      onClick={() => postToPipeline(rec)}
                    >
                      {postingRecId === rec.id ? 'Posting…' : rec.status === 'posted' ? 'Posted' : 'Post to Pipeline'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mb-16">
        <div className="card-title">Tasks</div>
        <div className="settings-grid">
          <div className="field">
            <label>Status Filter</label>
            <select value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="todo">todo</option>
              <option value="in_progress">in_progress</option>
              <option value="done">done</option>
            </select>
          </div>
          <div className="field">
            <label>Priority Filter</label>
            <select value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="urgent">urgent</option>
              <option value="high">high</option>
              <option value="normal">normal</option>
              <option value="low">low</option>
            </select>
          </div>
          <div className="field">
            <label>Due Filter</label>
            <select value={taskDueFilter} onChange={e => setTaskDueFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="overdue">overdue</option>
              <option value="today">due_today</option>
              <option value="upcoming">upcoming</option>
              <option value="no_due">no_due_date</option>
            </select>
          </div>
          {me?.isAdmin && (
            <div className="field">
              <label>Assignee Filter</label>
              <select value={taskAssigneeFilter} onChange={e => setTaskAssigneeFilter(e.target.value)}>
                <option value="all">all</option>
                {(queue.staffUsers || []).map(u => (
                  <option key={`assignee-filter-${u.id}`} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="settings-grid">
          {me?.isAdmin && (
            <div className="field">
              <label>Assign To</label>
              <select value={taskForm.assigneeUserId} onChange={e => setTaskForm({ ...taskForm, assigneeUserId: e.target.value })}>
                <option value="">Select staff</option>
                {(queue.staffUsers || []).map(u => (
                  <option key={`assign-to-${u.id}`} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Type</label>
            <select value={taskForm.type} onChange={e => setTaskForm({ ...taskForm, type: e.target.value })}>
              <option value="research">research</option>
              <option value="follow_up">follow_up</option>
              <option value="interview_prep">interview_prep</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </div>
          <div className="field">
            <label>Due Date</label>
            <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={taskForm.notes} onChange={e => setTaskForm({ ...taskForm, notes: e.target.value })} />
        </div>
        <button
          className="btn btn-primary"
          onClick={createTask}
          disabled={savingTask || !taskForm.notes.trim() || !selectedCandidateId || (me?.isAdmin && !taskForm.assigneeUserId)}
        >
          {savingTask ? 'Creating…' : 'Create Task'}
        </button>

        <div style={{ marginTop: 14 }}>
          {!filteredCandidateTasks.length && <div style={{ color: 'var(--text-muted)' }}>No tasks match current filters.</div>}
          {!!filteredCandidateTasks.length && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Assignee</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredCandidateTasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      {me?.isAdmin ? (
                        <select
                          value={String(task.assigneeUserId || '')}
                          disabled={updatingTaskId === task.id}
                          onChange={e => reassignTask(task, e.target.value)}
                        >
                          {(queue.staffUsers || []).map(u => (
                            <option key={`reassign-${task.id}-${u.id}`} value={u.id}>{u.username}</option>
                          ))}
                        </select>
                      ) : (task.assigneeUsername || task.assigneeUserId)}
                    </td>
                    <td>{task.type}</td>
                    <td>{task.priority}</td>
                    <td>{task.status}</td>
                    <td>
                      {formatDateTime(task.dueAt)}
                      {task.dueAt && task.status !== 'done' && Number(task.dueAt) < Date.now() && (
                        <span className="badge badge-red" style={{ marginLeft: 6 }}>Overdue</span>
                      )}
                    </td>
                    <td>{task.notes || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {task.status !== 'in_progress' && (
                        <button className="btn btn-ghost btn-sm" disabled={updatingTaskId === task.id} onClick={() => updateTaskStatus(task, 'in_progress')}>
                          Start
                        </button>
                      )}
                      {task.status !== 'done' && (
                        <button className="btn btn-ghost btn-sm" disabled={updatingTaskId === task.id} onClick={() => updateTaskStatus(task, 'done')}>
                          Done
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Candidate Threads</div>
        <div className="settings-grid">
          <div className="field">
            <label>Status Filter</label>
            <select value={threadStatusFilter} onChange={e => setThreadStatusFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <div className="field">
            <label>Freshness Filter</label>
            <select value={threadStaleFilter} onChange={e => setThreadStaleFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="stale">stale_48h_plus</option>
              <option value="fresh">fresh_under_48h</option>
            </select>
          </div>
        </div>
        <div className="settings-grid">
          <div className="field">
            <label>New Thread Topic</label>
            <input value={threadTopic} onChange={e => setThreadTopic(e.target.value)} placeholder="Follow-up strategy, interview prep, etc." />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={createThread} disabled={creatingThread || !selectedCandidateId || !threadTopic.trim()}>
              {creatingThread ? 'Creating…' : 'Create Thread'}
            </button>
          </div>
        </div>

        {!filteredThreads.length && <div style={{ color: 'var(--text-muted)' }}>No threads match current filters.</div>}
        {!!filteredThreads.length && (
          <div className="tabs">
            {filteredThreads.map(t => (
              <button key={t.id} className={`tab ${selectedThreadId === t.id ? 'active' : ''}`} onClick={() => setSelectedThreadId(t.id)}>
                {t.topic} {t.status === 'closed' ? '• closed' : ''}
              </button>
            ))}
          </div>
        )}

        {!!selectedThreadId && (
          <div style={{ marginTop: 10 }}>
            <div className="quick-actions" style={{ marginBottom: 10 }}>
              {selectedThread?.status !== 'closed' && (
                <button className="btn btn-ghost btn-sm" onClick={() => updateThreadStatus('closed')}>
                  Close Thread
                </button>
              )}
              {selectedThread?.status === 'closed' && (
                <button className="btn btn-ghost btn-sm" onClick={() => updateThreadStatus('open')}>
                  Reopen Thread
                </button>
              )}
            </div>
            <div className="field">
              <label>Message</label>
              <textarea rows={3} value={messageBody} onChange={e => setMessageBody(e.target.value)} />
            </div>
            <div className="settings-grid">
              <div className="field">
                <label>Visibility</label>
                <select value={messageVisibility} onChange={e => setMessageVisibility(e.target.value)}>
                  <option value="shared_with_candidate">shared_with_candidate</option>
                  <option value="internal_staff">internal_staff</option>
                </select>
              </div>
              <div className="field">
                <label>&nbsp;</label>
                <button className="btn btn-primary" onClick={sendMessage} disabled={sendingMessage || !messageBody.trim() || selectedThread?.status === 'closed'}>
                  {sendingMessage ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </div>
            {selectedThread?.status === 'closed' && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
                Thread is closed. Reopen to send a new message.
              </div>
            )}
            <table className="data-table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Author</th>
                  <th>Visibility</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {threadMessages.map(m => (
                  <tr key={m.id}>
                    <td>{formatDateTime(m.createdAt)}</td>
                    <td>{m.authorUsername || m.authorUserId}</td>
                    <td>{m.visibility}</td>
                    <td>{m.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
