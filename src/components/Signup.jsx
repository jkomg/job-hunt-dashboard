import { useEffect, useState } from 'react'

export default function Signup({ inviteToken, onSignup, onBackToLogin }) {
  const [invite, setInvite] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadInvite() {
      setLoadingInvite(true)
      setError('')
      try {
        const r = await fetch(`/api/signup/invite/${encodeURIComponent(inviteToken)}`, { credentials: 'include' })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Could not load invite')
        if (!active) return
        setInvite(data.invite || null)
      } catch (e) {
        if (!active) return
        setInvite(null)
        setError(e.message || 'Could not load invite')
      } finally {
        if (active) setLoadingInvite(false)
      }
    }
    loadInvite()
    return () => { active = false }
  }, [inviteToken])

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch(`/api/signup/invite/${encodeURIComponent(inviteToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Could not create account')
      if (typeof onSignup === 'function') onSignup()
    } catch (e) {
      setError(e.message || 'Could not create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card signup-card">
        <h1>Join Job Hunt<span style={{ color: 'var(--accent)' }}>.</span></h1>
        <p className="sub">Invite-only account setup</p>
        {error && <div className="error-msg">{error}</div>}
        {loadingInvite ? (
          <div className="loading"><div className="spin" />Checking your invite…</div>
        ) : invite ? (
          <>
            <div className="form-intro" style={{ marginBottom: 18 }}>
              <div className="form-intro-title">You were invited</div>
              <div className="form-intro-copy">
                Create your account for <strong>{invite.organizationName || invite.organizationId}</strong>.
              </div>
            </div>
            <div className="helper-grid signup-summary-grid">
              <div className="helper-card">
                <div className="helper-card-title">Email</div>
                <div className="helper-card-copy">{invite.email}</div>
              </div>
              <div className="helper-card">
                <div className="helper-card-title">Role</div>
                <div className="helper-card-copy">{invite.role}</div>
              </div>
            </div>
            <form onSubmit={submit}>
              <div className="field">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  placeholder="choose a username"
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="at least 10 characters"
                />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </>
        ) : null}
        <button type="button" className="btn btn-ghost btn-full signup-back-btn" onClick={onBackToLogin}>
          Back to sign in
        </button>
      </div>
    </div>
  )
}
