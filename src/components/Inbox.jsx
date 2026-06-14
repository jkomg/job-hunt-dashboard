import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Icon } from '../ui-icons.jsx'

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
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initials(str) {
  return (str || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Inbox() {
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [messages, setMessages] = useState([])
  const [messageBody, setMessageBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const msgEndRef = useRef(null)

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

  useEffect(() => {
    if (msgEndRef.current) {
      msgEndRef.current.parentElement.scrollTop = msgEndRef.current.parentElement.scrollHeight
    }
  }, [messages.length, selectedThreadId])

  const selectedThread = useMemo(
    () => threads.find(t => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  )

  async function send() {
    if (!messageBody.trim() || !selectedThreadId || selectedThread?.status === 'closed') return
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

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
  }

  if (loading) return <div className="loading"><div className="spin" />Loading inbox…</div>

  const unreadCount = 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <div className="sub">
            {threads.length} THREAD{threads.length !== 1 ? 'S' : ''}
            {unreadCount > 0 ? ` · ${unreadCount} UNREAD` : ''}
          </div>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      {threads.length === 0 ? (
        <div className="placeholder">
          <div className="placeholder-inner">
            <div className="placeholder-icn"><Icon name="inbox" /></div>
            <p>No messages yet. Your support staff can reach you here.</p>
          </div>
        </div>
      ) : (
        <div className="inbox-layout">
          <div className="inbox-list">
            <div className="inbox-list-head">
              <span className="inbox-list-title">Messages</span>
            </div>
            <div className="inbox-threads">
              {threads.map(t => (
                <button
                  key={t.id}
                  className={'thread-row' + (t.id === selectedThreadId ? ' sel' : '')}
                  onClick={() => setSelectedThreadId(t.id)}
                >
                  <div className="thread-avatar">{initials(t.topic || t.id)}</div>
                  <div className="thread-body">
                    <div className="thread-top">
                      <span className="thread-sender">{t.staffUsername || 'Staff'}</span>
                      <span className="thread-time">{t.updatedAt ? fmt(t.updatedAt) : ''}</span>
                    </div>
                    <div className="thread-subject">{t.topic || 'Thread'}</div>
                    <div className="thread-preview">{t.status === 'closed' ? 'Closed' : 'Open'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="inbox-conv">
            {selectedThread ? (
              <>
                <div className="conv-head">
                  <div className="conv-head-top">
                    <div className="conv-head-info">
                      <div className="conv-subject">{selectedThread.topic || 'Thread'}</div>
                      <div className="conv-meta">
                        {selectedThread.staffUsername ? `${selectedThread.staffUsername} · ` : ''}
                        {selectedThread.status === 'closed' ? 'Closed thread' : 'Open thread'}
                      </div>
                    </div>
                    {selectedThread.status === 'closed' && <span className="chip chip-gray">Closed</span>}
                  </div>
                </div>

                <div className="conv-messages">
                  {messages.map(m => {
                    const isYou = m.authorRole === 'job_seeker' || m.fromJobSeeker
                    return (
                      <div key={m.id} className={'msg-row ' + (isYou ? 'you' : 'them')}>
                        <div className="msg-avatar">{initials(m.authorUsername || (isYou ? 'Me' : 'Staff'))}</div>
                        <div className="msg-content">
                          <div className="msg-name">{m.authorUsername || (isYou ? 'You' : 'Staff')} · {fmt(m.createdAt)}</div>
                          <div className="msg-bubble">
                            <div className="inbox-message-body">
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                                }}
                              >
                                {m.body}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={msgEndRef} />
                </div>

                {selectedThread.status === 'closed' ? (
                  <div className="conv-closed"><Icon name="x" /> This thread is closed</div>
                ) : (
                  <div className="conv-reply">
                    <div className="reply-field">
                      <textarea
                        className="reply-input"
                        placeholder={`Reply… (⌘↵ to send)`}
                        value={messageBody}
                        onChange={e => setMessageBody(e.target.value)}
                        onKeyDown={handleKey}
                        rows={2}
                      />
                      <button className="btn btn-primary" onClick={send} disabled={sending || !messageBody.trim()}>
                        <Icon name="send" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="conv-empty">
                <Icon name="inbox" />
                <div>Select a thread to read</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
