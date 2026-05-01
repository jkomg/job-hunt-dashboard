import { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import ForcePasswordChange from './components/ForcePasswordChange.jsx'
import SetupWizard from './components/SetupWizard.jsx'
import Dashboard from './components/Dashboard.jsx'
import Pipeline from './components/Pipeline.jsx'
import Contacts from './components/Contacts.jsx'
import DailyCheckin from './components/DailyCheckin.jsx'
import Interviews from './components/Interviews.jsx'
import Events from './components/Events.jsx'
import Inbox from './components/Inbox.jsx'
import Templates from './components/Templates.jsx'
import Watchlist from './components/Watchlist.jsx'
import Settings from './components/Settings.jsx'
import StaffOps from './components/StaffOps.jsx'
import { useTheme, THEMES } from './useTheme.js'

const JOB_SEEKER_NAV = [
  { id: 'dashboard',   label: 'Briefing',   icon: '☀️' },
  { id: 'checkin',     label: 'Check-in',   icon: '✅' },
  { id: 'pipeline',    label: 'Pipeline',   icon: '🎯' },
  { id: 'contacts',    label: 'Outreach',   icon: '👥' },
  { id: 'interviews',  label: 'Interviews', icon: '📞' },
  { id: 'inbox',       label: 'Inbox',      icon: '💬' },
  { id: 'events',      label: 'Events',     icon: '🗓️' },
  { id: 'templates',   label: 'Templates',  icon: '✉️' },
  { id: 'watchlist',   label: 'Watchlist',  icon: '🔭' },
  { id: 'settings',    label: 'Settings',   icon: '⚙️' },
]

const STAFF_NAV = [
  { id: 'dashboard', label: 'Briefing', icon: '☀️' },
  { id: 'staff_ops', label: 'Staff Ops', icon: '🧭' },
  { id: 'settings',  label: 'Settings', icon: '⚙️' }
]

export default function App() {
  const [authed, setAuthed] = useState(null)
  const [me, setMe] = useState(null)
  const [view, setView] = useState('dashboard')
  const [navIntent, setNavIntent] = useState(null)
  const [theme, setTheme] = useTheme()

  function navigate(nextView, intent = null) {
    setView(nextView)
    setNavIntent(intent ? { ...intent, _ts: Date.now() } : { _ts: Date.now() })
  }

  async function refreshMe() {
    try {
      const r = await fetch('/api/me', { credentials: 'include' })
      if (!r.ok) {
        setAuthed(false)
        setMe(null)
        return
      }
      const data = await r.json()
      setMe(data)
      setAuthed(true)
    } catch {
      setAuthed(false)
      setMe(null)
    }
  }

  useEffect(() => {
    refreshMe()
  }, [])

  const isStaffLike = me?.role === 'staff' || me?.isAdmin
  const navItems = isStaffLike ? STAFF_NAV : JOB_SEEKER_NAV

  useEffect(() => {
    if (authed !== true || !me?.onboardingComplete || me?.mustChangePassword) return
    const navIds = new Set(navItems.map(n => n.id))
    if (!navIds.has(view)) {
      setView(isStaffLike ? 'settings' : 'dashboard')
    }
  }, [authed, me, isStaffLike, navItems, view])

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    setAuthed(false)
    setMe(null)
  }

  if (authed === null) {
    return <div className="loading"><div className="spin" />Loading…</div>
  }

  if (!authed) {
    return <Login onLogin={refreshMe} />
  }

  if (me?.mustChangePassword) {
    return <ForcePasswordChange onDone={refreshMe} onLogout={logout} />
  }

  if (!me?.onboardingComplete) {
    return <SetupWizard me={me} onComplete={refreshMe} onLogout={logout} />
  }

  return (
    <div className="app">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">Job Hunt<span>.</span></div>
        <nav>
          {navItems.map(n => (
            <button
              key={n.id}
              className={`nav-item${view === n.id ? ' active' : ''}`}
              onClick={() => navigate(n.id)}
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

        {view === 'dashboard'  && <Dashboard onNavigate={navigate} me={me} />}
        {isStaffLike && view === 'staff_ops' && <StaffOps me={me} />}
        {!isStaffLike && view === 'checkin'    && <DailyCheckin />}
        {!isStaffLike && view === 'pipeline'   && <Pipeline navIntent={navIntent} />}
        {!isStaffLike && view === 'contacts'   && <Contacts />}
        {!isStaffLike && view === 'interviews' && <Interviews />}
        {!isStaffLike && view === 'inbox'      && <Inbox />}
        {!isStaffLike && view === 'events'     && <Events />}
        {!isStaffLike && view === 'templates'  && <Templates />}
        {!isStaffLike && view === 'watchlist'  && <Watchlist />}
        {view === 'settings'   && <Settings me={me} onProfileUpdated={refreshMe} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {navItems.map(n => (
          <button
            key={n.id}
            className={`bottom-nav-item${view === n.id ? ' active' : ''}`}
            onClick={() => navigate(n.id)}
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
