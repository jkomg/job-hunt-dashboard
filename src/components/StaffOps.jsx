import { useEffect, useMemo, useState } from 'react'

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

export default function StaffOps() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [queue, setQueue] = useState({ summary: {}, candidates: [], recommendations: [], tasks: [] })
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
    type: 'research',
    priority: 'normal',
    dueDate: '',
    notes: ''
  })
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')
  const [taskDueFilter, setTaskDueFilter] = useState('all')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api('/api/staff/queue')
      setQueue(data)
      if (!selectedCandidateId && data.candidates?.length) {
        setSelectedCandidateId(String(data.candidates[0].id))
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
      if (taskDueFilter === 'all') return true
      if (!task.dueAt) return taskDueFilter === 'no_due'
      if (taskDueFilter === 'no_due') return false
      const due = Number(task.dueAt)
      if (taskDueFilter === 'overdue') return due < startToday.getTime() && task.status !== 'done'
      if (taskDueFilter === 'today') return due >= startToday.getTime() && due < endToday.getTime() && task.status !== 'done'
      if (taskDueFilter === 'upcoming') return due >= endToday.getTime() && task.status !== 'done'
      return true
    })
  }, [candidateTasks, taskStatusFilter, taskPriorityFilter, taskDueFilter])

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
          type: taskForm.type,
          priority: taskForm.priority,
          dueAt: taskForm.dueDate ? new Date(`${taskForm.dueDate}T12:00:00`).getTime() : null,
          notes: taskForm.notes
        })
      })
      setTaskForm({ type: 'research', priority: 'normal', dueDate: '', notes: '' })
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
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Candidates</div>
        {!queue.candidates?.length && <div style={{ color: 'var(--text-muted)' }}>No candidates assigned yet.</div>}
        {!!queue.candidates?.length && (
          <div className="tabs">
            {queue.candidates.map(c => (
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
        </div>
        <div className="settings-grid">
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
        <button className="btn btn-primary" onClick={createTask} disabled={savingTask || !taskForm.notes.trim() || !selectedCandidateId}>
          {savingTask ? 'Creating…' : 'Create Task'}
        </button>

        <div style={{ marginTop: 14 }}>
          {!filteredCandidateTasks.length && <div style={{ color: 'var(--text-muted)' }}>No tasks match current filters.</div>}
          {!!filteredCandidateTasks.length && (
            <table className="data-table">
              <thead>
                <tr>
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
    </div>
  )
}
