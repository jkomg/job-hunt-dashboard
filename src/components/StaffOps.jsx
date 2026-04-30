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
  const [postingRecId, setPostingRecId] = useState('')
  const [form, setForm] = useState({
    company: '',
    role: '',
    jobUrl: '',
    source: '',
    fitNote: ''
  })

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
    </div>
  )
}
