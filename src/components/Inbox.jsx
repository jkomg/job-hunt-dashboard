import { useEffect, useMemo, useRef, useState } from 'react'
import MessageMarkdown from './MessageMarkdown.jsx'

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
  const replyRef = useRef(null)

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

  function applyMarkdown(prefix, suffix = '') {
    const el = replyRef.current
    if (!el) return
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const raw = String(messageBody || '')
    const selected = raw.slice(start, end) || 'text'
    const next = `${raw.slice(0, start)}${prefix}${selected}${suffix}${raw.slice(end)}`
    setMessageBody(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + prefix.length + selected.length + suffix.length
      el.setSelectionRange(caret, caret)
    })
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
        <div className="card chat-shell">
          <div className="chat-thread-list">
            {threads.map(t => {
              const active = selectedThreadId === t.id
              return (
                <button key={t.id} className={`chat-thread-item${active ? ' active' : ''}`} onClick={() => setSelectedThreadId(t.id)}>
                  <div style={{ fontWeight: 600 }}>{t.topic}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.status === 'closed' ? 'Closed' : 'Open'} · {fmt(t.updatedAt || t.createdAt)}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="chat-main">
            <div className="chat-header">
              <strong>{selectedThread?.topic || 'Thread'}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{selectedThread?.status === 'closed' ? 'Closed' : 'Open'}</span>
            </div>
            <div className="chat-messages">
              {messages.map(m => {
                const mine = String(m.authorUserId) === String(selectedThread?.jobSeekerUserId)
                return (
                  <div key={m.id} className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
                    <div className="chat-line">
                      <div className="chat-author-col">{m.authorUsername || m.authorUserId}</div>
                      <div className={`chat-bubble ${mine ? 'mine' : ''}`}>
                        <div className="chat-meta">{fmt(m.createdAt)}</div>
                        <MessageMarkdown text={m.body} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          {selectedThread?.status !== 'closed' && (
            <div className="chat-composer">
              <div className="quick-actions" style={{ marginBottom: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => applyMarkdown('**', '**')} type="button">Bold</button>
                <button className="btn btn-ghost btn-sm" onClick={() => applyMarkdown('*', '*')} type="button">Italic</button>
                <button className="btn btn-ghost btn-sm" onClick={() => applyMarkdown('- ')} type="button">Bullet</button>
                <button className="btn btn-ghost btn-sm" onClick={() => applyMarkdown('[label](', ')')} type="button">Link</button>
              </div>
              <div className="field">
                <label>Reply</label>
                <textarea ref={replyRef} rows={4} value={messageBody} onChange={e => setMessageBody(e.target.value)} />
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
        </div>
      )}
    </div>
  )
}
