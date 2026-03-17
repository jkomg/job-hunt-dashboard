import { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Pipeline from './components/Pipeline.jsx'
import Contacts from './components/Contacts.jsx'
import DailyCheckin from './components/DailyCheckin.jsx'
import { useTheme, THEMES } from './useTheme.js'

const NAV = [
  { id: 'dashboard', label: 'Briefing', icon: '☀️' },
  { id: 'checkin',   label: 'Check-in', icon: '✅' },
  { id: 'pipeline',  label: 'Pipeline', icon: '🎯' },
  { id: 'contacts',  label: 'Outreach', icon: '👥' },
]

export default function App() {
  const [authed, setAuthed] = useState(null)
  const [view, setView] = useState('dashboard')
  const [theme, setTheme] = useTheme()

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
    return <div className="loading"><div className="spin" />Loading…</div>
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="app">
      {/* Desktop sidebar */}
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
          {/* Theme picker */}
          <div className="theme-picker">
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`theme-btn${theme === t.id ? ' active' : ''}`}
                onClick={() => setTheme(t.id)}
                title={t.label}
              >
                <span className="theme-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <button className="logout-btn" onClick={logout}>
            <span>↩</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        {/* Mobile theme picker — dots in top-right corner */}
        <div className="theme-picker-mobile">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-dot${theme === t.id ? ' active' : ''}`}
              data-t={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
            />
          ))}
        </div>

        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'checkin'   && <DailyCheckin />}
        {view === 'pipeline'  && <Pipeline />}
        {view === 'contacts'  && <Contacts />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`bottom-nav-item${view === n.id ? ' active' : ''}`}
            onClick={() => setView(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {view === n.id && <div className="bnav-dot" />}
          </button>
        ))}
      </nav>
    </div>
  )
}
