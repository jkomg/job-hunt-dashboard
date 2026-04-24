import { useState } from 'react'

function textToTabs(value) {
  return String(value || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
}

async function parseJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export default function SetupWizard({ me, onComplete, onLogout }) {
  const [displayName, setDisplayName] = useState(me?.displayName || '')
  const [username, setUsername] = useState(me?.username || '')
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [connectSheets, setConnectSheets] = useState(false)
  const [sheetId, setSheetId] = useState('')
  const [pipelineTabsText, setPipelineTabsText] = useState('Jobs & Applications, Found')
  const [contactsTabsText, setContactsTabsText] = useState('Networking Tracker')
  const [interviewsTabsText, setInterviewsTabsText] = useState('Interview Tracker')
  const [eventsTabsText, setEventsTabsText] = useState('Events')

  async function saveSheetsConfig(enabled) {
    const res = await fetch('/api/sheets/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        enabled,
        sheetId,
        pipelineTabs: textToTabs(pipelineTabsText),
        contactsTabs: textToTabs(contactsTabsText),
        interviewsTabs: textToTabs(interviewsTabsText),
        eventsTabs: textToTabs(eventsTabsText)
      })
    })
    const data = await parseJson(res)
    if (!res.ok) {
      throw new Error(data?.error || `Could not save sync settings (${res.status})`)
    }
  }

  async function testSheetsConnection() {
    setTesting(true)
    setError('')
    setSuccess('')
    try {
      await saveSheetsConfig(true)
      const res = await fetch('/api/sheets/test-connection', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await parseJson(res)
      if (!res.ok) {
        throw new Error(data?.error || `Connection test failed (${res.status})`)
      }
      setSuccess(`Connection OK: ${data.spreadsheetTitle || data.spreadsheetId}`)
    } catch (e) {
      setError(e.message || 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  async function completeSetup(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!displayName.trim()) {
      setError('Please enter your name.')
      return
    }
    if (!username.trim()) {
      setError('Please set a username.')
      return
    }

    setLoading(true)
    try {
      if (connectSheets) {
        await saveSheetsConfig(true)
      } else {
        await saveSheetsConfig(false)
      }

      const r = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username.trim().toLowerCase()
        })
      })
      const data = await parseJson(r)
      if (!r.ok) {
        setError(data.error || 'Could not complete setup')
        return
      }
      onComplete()
    } catch (e) {
      setError(e.message || 'Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Welcome to Job Hunt<span style={{ color: 'var(--accent)' }}>.</span></h1>
        <p className="sub">Quick setup (about 2 minutes)</p>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

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

          <div className="field">
            <label>Username (used for local sign in)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="jason"
              autoComplete="username"
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Use 3-32 characters: letters, numbers, dot, dash, or underscore.
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">Google Sheets Sync (optional)</div>
            <div className="check-row" style={{ marginBottom: 10 }}>
              <input
                id="connect-sheets-onboarding"
                type="checkbox"
                checked={connectSheets}
                onChange={e => setConnectSheets(e.target.checked)}
              />
              <label htmlFor="connect-sheets-onboarding">Connect my Google Sheet now</label>
            </div>
            {!connectSheets && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                You can skip this and set it up later in Settings.
              </div>
            )}
            {connectSheets && (
              <div>
                <div className="field">
                  <label>Google Sheet URL or ID</label>
                  <input
                    type="text"
                    value={sheetId}
                    onChange={e => setSheetId(e.target.value)}
                    placeholder="Paste your Remote Rebellion sheet URL here"
                  />
                </div>
                <div className="field">
                  <label>Pipeline Tabs (comma-separated)</label>
                  <input value={pipelineTabsText} onChange={e => setPipelineTabsText(e.target.value)} />
                </div>
                <div className="field">
                  <label>Networking Tabs (comma-separated)</label>
                  <input value={contactsTabsText} onChange={e => setContactsTabsText(e.target.value)} />
                </div>
                <div className="field">
                  <label>Interview Tabs (comma-separated)</label>
                  <input value={interviewsTabsText} onChange={e => setInterviewsTabsText(e.target.value)} />
                </div>
                <div className="field">
                  <label>Events Tabs (comma-separated)</label>
                  <input value={eventsTabsText} onChange={e => setEventsTabsText(e.target.value)} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                  Before testing: share your sheet with the service account email shown in Settings, or test will fail.
                </div>
                <button className="btn btn-ghost btn-full" type="button" onClick={testSheetsConnection} disabled={testing || loading}>
                  {testing ? 'Testing connection…' : 'Test Google connection'}
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">What happens next</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <div>1. You land on your daily briefing.</div>
              <div>2. Use Today Queue to focus interviews and follow-ups first.</div>
              <div>3. Open Settings any time to adjust sync and troubleshooting.</div>
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
