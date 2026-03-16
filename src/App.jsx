import { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Pipeline from './components/Pipeline.jsx'
import Contacts from './components/Contacts.jsx'
import DailyCheckin from './components/DailyCheckin.jsx'

const NAV = [
  { id: 'dashboard', label: 'Morning Briefing', icon: '☀️' },
  { id: 'checkin',   label: 'Daily Check-in',  icon: '✅' },
  { id: 'pipeline',  label: 'Job Pipeline',    icon: '🎯' },
  { id: 'contacts',  label: 'Outreach',        icon: '👥' },
]

export default function App() {
  const [authed, setAuthed] = useState(null) // null=loading, false=logged out, true=logged in
  const [view, setView] = useState('dashboard')

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => setAuthed(r.ok))
      .catch(() => setAuthed(false))
  }, [])

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    setAuthed(false)
  }

  if (authed === null) {
    return (
      <div className="loading">
        <div className="spin" />
        Loading…
      </div>
    )
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">Job Hunt<span>.</span></div>
        <nav>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item${view === n.id ? ' active' : ''}`}
              onClick={() => setView(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <span>↩</span> Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'checkin'   && <DailyCheckin />}
        {view === 'pipeline'  && <Pipeline />}
        {view === 'contacts'  && <Contacts />}
      </main>
    </div>
  )
}
