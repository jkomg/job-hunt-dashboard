import { useState } from 'react'

export default function SetupWizard({ me, onComplete, onLogout }) {
  const [displayName, setDisplayName] = useState(me?.displayName || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function completeSetup(e) {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)
    try {
      const r = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: displayName.trim() })
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data.error || 'Could not complete setup')
        return
      }
      onComplete()
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Welcome to Job Hunt<span style={{ color: 'var(--accent)' }}>.</span></h1>
        <p className="sub">Quick setup (takes under a minute)</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={completeSetup}>
          <div className="field">
            <label>What should we call you on the dashboard?</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoFocus
              autoComplete="name"
            />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">What happens next</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <div>1. You land on your daily briefing.</div>
              <div>2. Open <strong>Settings</strong> to connect Google Sheets.</div>
              <div>3. Run <strong>Test Connection</strong> once and you’re set.</div>
            </div>
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Finish setup'}
          </button>
        </form>

        <button
          className="btn btn-ghost btn-full"
          style={{ marginTop: 10 }}
          onClick={onLogout}
          disabled={loading}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
