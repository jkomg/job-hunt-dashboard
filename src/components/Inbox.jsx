import { useEffect, useMemo, useState } from 'react'

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

function fmt(ts) {
  if (!ts) return '—'
  const d = new Date(Number(ts))
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString()
}

export default function Inbox() {
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [messages, setMessages] = useState([])
  const [messageBody, setMessageBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function loadThreads() {
    setLoading(true)
    setError('')
    try {
      const d = await api('/api/member/threads')
      const list = d.threads || []
      setThreads(list)
      setSelectedThreadId(prev => list.find(t => t.id === prev)?.id || list[0]?.id || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadThreads() }, [])
  useEffect(() => {
    async function loadMessages() {
      if (!selectedThreadId) { setMessages([]); return }
      try {
        const d = await api(`/api/member/threads/${selectedThreadId}/messages`)
        setMessages(d.messages || [])
      } catch (e) {
        setError(e.message)
      }
    }
    loadMessages()
  }, [selectedThreadId])

  const selectedThread = useMemo(
    () => threads.find(t => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  )

  async function send() {
    setSending(true)
    setError('')
    try {
      await api(`/api/member/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: messageBody })
      })
      setMessageBody('')
      const d = await api(`/api/member/threads/${selectedThreadId}/messages`)
      setMessages(d.messages || [])
      await loadThreads()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="loading"><div className="spin" />Loading inbox…</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inbox</h1>
          <div className="subtle">Messages from your support staff.</div>
        </div>
      </div>
      {error && <div className="error-msg mb-16">{error}</div>}
      {!threads.length && <div className="card">No messages yet.</div>}
      {!!threads.length && (
        <div className="card">
          <div className="tabs">
            {threads.map(t => (
              <button key={t.id} className={`tab ${selectedThreadId === t.id ? 'active' : ''}`} onClick={() => setSelectedThreadId(t.id)}>
                {t.topic} {t.status === 'closed' ? '• closed' : ''}
              </button>
            ))}
          </div>
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead><tr><th>When</th><th>From</th><th>Message</th></tr></thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id}>
                  <td>{fmt(m.createdAt)}</td>
                  <td>{m.authorUsername || m.authorUserId}</td>
                  <td>{m.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedThread?.status !== 'closed' && (
            <div style={{ marginTop: 10 }}>
              <div className="field">
                <label>Reply</label>
                <textarea rows={3} value={messageBody} onChange={e => setMessageBody(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={send} disabled={sending || !messageBody.trim()}>
                {sending ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
          )}
          {selectedThread?.status === 'closed' && (
            <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>This thread is closed.</div>
          )}
        </div>
      )}
    </div>
  )
}
