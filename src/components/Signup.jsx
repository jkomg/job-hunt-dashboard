import { useEffect, useState } from 'react'

function formatInviteExpiry(iso) {
  if (!iso) return 'Unknown'
  const ts = new Date(iso)
  if (!Number.isFinite(ts.getTime())) return String(iso)
  return ts.toLocaleString()
}

function passwordChecks(password) {
  const raw = String(password || '')
  return [{ label: 'At least 10 characters', ok: raw.length >= 10 }]
}

export default function Signup({ inviteToken, onSignup, onBackToLogin }) {
  const [invite, setInvite] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [inviteErrorCode, setInviteErrorCode] = useState('')

  const checks = passwordChecks(password)
  const passwordReady = checks.every(check => check.ok)
  const usernameReady = /^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase())

  useEffect(() => {
    let active = true
    async function loadInvite() {
      setLoadingInvite(true)
      setError('')
      setInviteErrorCode('')
      try {
        const r = await fetch(`/api/signup/invite/${encodeURIComponent(inviteToken)}`, { credentials: 'include' })
        const data = await r.json()
        if (!r.ok) {
          const err = new Error(data.error || 'Could not load invite')
          err.code = data.code || ''
          throw err
        }
        if (!active) return
        setInvite(data.invite || null)
      } catch (e) {
        if (!active) return
        setInvite(null)
        setError(e.message || 'Could not load invite')
        setInviteErrorCode(String(e.code || ''))
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
    const nextUsername = username.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
      setError('Username must be 3-32 characters and use only letters, numbers, dots, dashes, or underscores.')
      setSubmitting(false)
      return
    }
    if (!passwordReady) {
      setError('Choose a stronger password before continuing.')
      setSubmitting(false)
      return
    }
    try {
      const r = await fetch(`/api/signup/invite/${encodeURIComponent(inviteToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: nextUsername, password })
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
            <div className="form-intro signup-hero" style={{ marginBottom: 18 }}>
              <div className="form-intro-title">You were invited to {invite.organizationName || invite.organizationId}</div>
              <div className="form-intro-copy">
                Create your account to join the workspace, finish setup, and start using the app right away.
              </div>
            </div>
            <div className="helper-grid signup-summary-grid">
              <div className="helper-card">
                <div className="helper-card-title">Email on invite</div>
                <div className="helper-card-copy">{invite.email}</div>
              </div>
              <div className="helper-card">
                <div className="helper-card-title">Starting role</div>
                <div className="helper-card-copy">{invite.role}</div>
              </div>
              <div className="helper-card">
                <div className="helper-card-title">Invite expires</div>
                <div className="helper-card-copy">{formatInviteExpiry(invite.expiresAt)}</div>
              </div>
              <div className="helper-card">
                <div className="helper-card-title">What happens next</div>
                <div className="helper-card-copy">You’ll be signed in immediately, then finish the normal first-time setup flow.</div>
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
                <div className="field-note">Use 3-32 characters: letters, numbers, dots, dashes, or underscores.</div>
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
                <div className="signup-password-checks">
                  {checks.map(check => (
                    <div key={check.label} className={'signup-password-check' + (check.ok ? ' ok' : '')}>
                      <span>{check.ok ? '✓' : '•'}</span>
                      <span>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={submitting || !usernameReady || !passwordReady}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </>
        ) : (
          <div className="signup-empty-state">
            <div className="form-intro-title">
              {inviteErrorCode === 'INVITE_USED' && 'This invite was already used'}
              {inviteErrorCode === 'INVITE_EXPIRED' && 'This invite expired'}
              {inviteErrorCode === 'INVITE_CANCELED' && 'This invite was canceled'}
              {!['INVITE_USED', 'INVITE_EXPIRED', 'INVITE_CANCELED'].includes(inviteErrorCode) && 'This invite is unavailable'}
            </div>
            <div className="form-intro-copy">
              {inviteErrorCode === 'INVITE_USED' && 'Ask your admin for a fresh signup link if you still need access.'}
              {inviteErrorCode === 'INVITE_EXPIRED' && 'Ask your admin to generate a new signup link.'}
              {inviteErrorCode === 'INVITE_CANCELED' && 'This link is no longer active. Ask your admin if you still need access.'}
              {!['INVITE_USED', 'INVITE_EXPIRED', 'INVITE_CANCELED'].includes(inviteErrorCode) && 'The invite link may be invalid or no longer active.'}
            </div>
          </div>
        )}
        <button type="button" className="btn btn-ghost btn-full signup-back-btn" onClick={onBackToLogin}>
          Back to sign in
        </button>
      </div>
    </div>
  )
}
