import { useState } from 'react'
import { Icon } from '../ui-icons.jsx'

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
  const [showSheetsDetails, setShowSheetsDetails] = useState(false)
  const isAdmin = !!me?.canManageOrg || ['admin', 'org_admin'].includes(me?.role)
  const isStaff = me?.role === 'staff'
  const setupProfile = isAdmin
    ? {
        eyebrow: 'Partner workspace setup',
        title: 'Welcome to your operations hub',
        intro: 'Set up your profile, then review the portfolio your team will manage.',
        steps: [
          'Finish your profile and land on the portfolio briefing.',
          'Invite job hunters and staff from User Management.',
          'Connect coaches to job hunters in Assignments.',
          'Use Operations to review tasks, threads, and intervention signals.'
        ],
        next: [
          'You land on the portfolio briefing.',
          'Switch to All Candidates to see program-wide momentum.',
          'Open User Management to invite your team and job hunters.',
          'Use Guides for the recommended partner workflow.'
        ]
      }
    : isStaff
      ? {
          eyebrow: 'Coach workspace setup',
          title: 'Welcome to your support workspace',
          intro: 'Set up your profile, then focus on the people and interventions assigned to you.',
          steps: [
            'Finish your profile and land on your coach briefing.',
            'Review assigned job hunters and their momentum signals.',
            'Work your task and conversation queues.',
            'Use Guides for the team’s shared operating rhythm.'
          ],
          next: [
            'You land on your coach briefing.',
            'Review the candidates assigned to you.',
            'Open Tasks and Threads for today’s interventions.',
            'Use Guides whenever you need the team playbook.'
          ]
        }
      : {
          eyebrow: 'Personal workspace setup',
          title: 'Welcome to Job Hunt',
          intro: 'Two quick details, then you can start building momentum.',
          steps: [
            'Finish setup and land on your Briefing.',
            'Add the jobs you are already pursuing in Pipeline.',
            'Add the people tied to your search in Outreach.',
            'Use Briefing in the morning and Check-in at the end of the day.'
          ],
          next: [
            'You land on your daily briefing.',
            'Open Pipeline for jobs and Outreach for people.',
            'Use Briefing in the morning and Check-in at the end of the day.',
            'Open Settings later for integrations and preferences.'
          ]
        }

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
    <div className="login-wrap setup-wrap">
      <div className="login-card setup-card">
        <div className="setup-eyebrow">{setupProfile.eyebrow}</div>
        <h1>{setupProfile.title}<span style={{ color: 'var(--accent)' }}>.</span></h1>
        <p className="sub">{setupProfile.intro}</p>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <form onSubmit={completeSetup}>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">Start with these four things</div>
            <div className="setup-start-list">
              {setupProfile.steps.map((step, index) => <div key={step}><strong>{index + 1}.</strong> {step}</div>)}
            </div>
          </div>

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
            <div className="card-title">{isAdmin ? 'Program data sync (optional)' : 'Google Sheets sync (optional)'}</div>
            <div className="setup-optional-note">
              {isAdmin
                ? 'Skip this for now unless your program spreadsheet and service account are already prepared. You can configure it later in Operations.'
                : 'Skip this if you just want to start using the app. You can always connect Sheets later in Settings.'}
            </div>
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
                <div className="setup-tip" style={{ marginBottom: 12 }}>
                  <Icon name="info" />
                  <span>Only do this now if your sheet setup is ready. Otherwise, finish setup first and connect it later.</span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ marginBottom: 12 }}
                  onClick={() => setShowSheetsDetails(v => !v)}
                >
                  <Icon name={showSheetsDetails ? 'chevron-up' : 'chevron-down'} />
                  {showSheetsDetails ? 'Hide sheet details' : 'Show sheet details'}
                </button>
                {showSheetsDetails && (
                  <>
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
                  </>
                )}
                <button className="btn btn-ghost btn-full" type="button" onClick={testSheetsConnection} disabled={testing || loading}>
                  {testing ? 'Testing connection…' : 'Test Google connection'}
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">Your first five minutes</div>
            <div className="setup-next-list">
              {setupProfile.next.map((step, index) => <div key={step}><span>{index + 1}</span>{step}</div>)}
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
