import { useState } from 'react'

export default function ForcePasswordChange({ onDone, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }

    setSaving(true)
    try {
      const r = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error || 'Could not change password')
        return
      }
      onDone()
    } catch {
      setError('Could not connect to server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Change Password<span style={{ color: 'var(--accent)' }}>.</span></h1>
        <p className="sub">This temporary admin account must set a new password before continuing.</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={onLogout}>
          Sign out
        </button>
      </div>
    </div>
  )
}
