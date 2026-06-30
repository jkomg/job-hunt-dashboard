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
import Guides from './components/Guides.jsx'
import { useTheme, THEMES } from './useTheme.js'

const JOB_SEEKER_NAV = [
  { id: 'dashboard',   label: 'Today',      icon: '☀️' },
  { id: 'checkin',     label: 'Check-in',   icon: '✅' },
  { id: 'pipeline',    label: 'Pipeline',   icon: '🎯' },
  { id: 'contacts',    label: 'Outreach',   icon: '👥' },
  { id: 'interviews',  label: 'Interviews', icon: '📞' },
  { id: 'inbox',       label: 'Inbox',      icon: '💬' },
  { id: 'events',      label: 'Events',     icon: '🗓️' },
  { id: 'templates',   label: 'Templates',  icon: '✉️' },
  { id: 'watchlist',   label: 'Watchlist',  icon: '🔭' },
  { id: 'guides',      label: 'Guides',     icon: '📚' },
  { id: 'settings',    label: 'Settings',   icon: '⚙️' },
]

const STAFF_NAV = [
  { id: 'dashboard', label: 'Today', icon: '☀️' },
  { id: 'operations', label: 'Operations', icon: '🧭' },
  { id: 'guides', label: 'Guides', icon: '📚' },
  { id: 'settings',  label: 'Settings', icon: '⚙️' }
]

const ADMIN_NAV = [
  { id: 'dashboard', label: 'Today', icon: '☀️' },
  { id: 'admin_operations', label: 'Operations', icon: '🧭' },
  { id: 'admin_users', label: 'User Management', icon: '👤' },
  { id: 'admin_assignments', label: 'Assignments', icon: '🔗' },
  { id: 'guides', label: 'Guides', icon: '📚' },
  { id: 'settings',  label: 'Settings', icon: '⚙️' }
]

export default function App() {
  const [authed, setAuthed] = useState(null)
  const [me, setMe] = useState(null)
  const [view, setView] = useState('dashboard')
  const [navIntent, setNavIntent] = useState(null)
  const [staffBadges, setStaffBadges] = useState({ tasksOpen: 0, threadsOpen: 0 })
  const [memberBadges, setMemberBadges] = useState({ inboxOpenThreads: 0 })
  const [pipelineBadgeCount, setPipelineBadgeCount] = useState(0)
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

  const isAdminOnly = me?.isAdmin && me?.role === 'admin'
  const isStaff = me?.role === 'staff'
  const isStaffLike = isStaff || isAdminOnly
  const navItems = isAdminOnly ? ADMIN_NAV : (isStaff ? STAFF_NAV : JOB_SEEKER_NAV)
  const settingsMode = view === 'admin_operations'
    ? 'admin_operations'
    : view === 'admin_users'
      ? 'admin_users'
      : view === 'admin_assignments'
        ? 'admin_assignments'
        : 'settings'

  useEffect(() => {
    if (!authed || !isStaffLike) return
    let active = true
    async function loadBadges() {
      try {
        const r = await fetch('/api/staff/queue', { credentials: 'include' })
        if (!r.ok) return
        const data = await r.json()
        const summary = data?.summary || {}
        if (!active) return
        setStaffBadges({
          tasksOpen: Number(summary.tasksTodo || 0) + Number(summary.tasksInProgress || 0),
          threadsOpen: Number(summary.threadsOpen || 0)
        })
      } catch {
        // ignore badge refresh errors
      }
    }
    loadBadges()
    const id = setInterval(loadBadges, 60000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [authed, isStaffLike])

  useEffect(() => {
    if (!authed || isStaffLike || !me?.id) return
    let active = true
    const seenKey = `pipeline_seen_ids_user_${me.id}`
    async function loadPipelineBadge() {
      try {
        const r = await fetch('/api/pipeline', { credentials: 'include' })
        if (!r.ok) return
        const rows = await r.json()
        const ids = Array.isArray(rows) ? rows.map(x => String(x?.id || '')).filter(Boolean) : []
        let seen = []
        try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]') } catch { seen = [] }
        const seenSet = new Set((Array.isArray(seen) ? seen : []).map(String))
        const unseen = ids.filter(id => !seenSet.has(id))
        if (!active) return
        setPipelineBadgeCount(unseen.length)
      } catch {
        // ignore pipeline badge refresh errors
      }
    }
    loadPipelineBadge()
    const id = setInterval(loadPipelineBadge, 60000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [authed, isStaffLike, me?.id])

  useEffect(() => {
    if (isStaffLike || view !== 'pipeline' || !me?.id) return
    const seenKey = `pipeline_seen_ids_user_${me.id}`
    fetch('/api/pipeline', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const ids = Array.isArray(rows) ? rows.map(x => String(x?.id || '')).filter(Boolean) : []
        localStorage.setItem(seenKey, JSON.stringify(ids))
        setPipelineBadgeCount(0)
      })
      .catch(() => {})
  }, [view, isStaffLike, me?.id])

  useEffect(() => {
    if (!authed || isStaffLike) return
    let active = true
    async function loadMemberBadges() {
      try {
        const r = await fetch('/api/member/threads', { credentials: 'include' })
        if (!r.ok) return
        const data = await r.json()
        const threads = Array.isArray(data?.threads) ? data.threads : []
        if (!active) return
        setMemberBadges({
          inboxOpenThreads: threads.filter(t => t.status === 'open').length
        })
      } catch {
        // ignore member badge refresh errors
      }
    }
    loadMemberBadges()
    const id = setInterval(loadMemberBadges, 60000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [authed, isStaffLike])

  useEffect(() => {
    if (authed !== true || !me?.onboardingComplete || me?.mustChangePassword) return
    if (view === 'staff_ops') setView('operations')
    if (view === 'staff_tasks' || view === 'staff_threads') setView('operations')
    const navIds = new Set(navItems.map(n => n.id))
    if (!navIds.has(view)) {
      setView(isStaff ? 'operations' : (isStaffLike ? 'settings' : 'dashboard'))
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
          {navItems.map(n => {
            const badge = isStaffLike
              ? ((n.id === 'operations' || n.id === 'admin_operations') ? (staffBadges.tasksOpen + staffBadges.threadsOpen) : 0)
              : (n.id === 'inbox' ? memberBadges.inboxOpenThreads : (n.id === 'pipeline' ? pipelineBadgeCount : 0))
            return (
            <button
              key={n.id}
              className={`nav-item${view === n.id ? ' active' : ''}`}
              onClick={() => navigate(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
              {!!badge && <span className="nav-badge">{badge}</span>}
            </button>
            )
          })}
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
        <div className="identity-chip" title={`username=${me?.username || 'unknown'} role=${me?.role || 'unknown'} org=${me?.organizationId || 'unknown'}`}>
          <strong>{me?.username || 'unknown'}</strong>
          <span>{me?.role || 'unknown'}</span>
          <span>{me?.organizationId || 'unknown-org'}</span>
        </div>

        {view === 'dashboard'  && <Dashboard onNavigate={navigate} me={me} />}
        {isStaff && view === 'operations' && <StaffOps me={me} mode="operations" navIntent={navIntent} />}
        {!isStaffLike && view === 'checkin'    && <DailyCheckin />}
        {!isStaffLike && view === 'pipeline'   && <Pipeline navIntent={navIntent} />}
        {!isStaffLike && view === 'contacts'   && <Contacts />}
        {!isStaffLike && view === 'interviews' && <Interviews />}
        {!isStaffLike && view === 'inbox'      && <Inbox />}
        {!isStaffLike && view === 'events'     && <Events />}
        {!isStaffLike && view === 'templates'  && <Templates />}
        {!isStaffLike && view === 'watchlist'  && <Watchlist />}
        {view === 'guides' && <Guides />}
        {(view === 'settings' || view === 'admin_operations' || view === 'admin_users' || view === 'admin_assignments')
          && <Settings me={me} onProfileUpdated={refreshMe} onNavigate={navigate} mode={settingsMode} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {navItems.map(n => {
          const badge = isStaffLike
            ? ((n.id === 'operations' || n.id === 'admin_operations') ? (staffBadges.tasksOpen + staffBadges.threadsOpen) : 0)
            : (n.id === 'inbox' ? memberBadges.inboxOpenThreads : (n.id === 'pipeline' ? pipelineBadgeCount : 0))
          return (
          <button
            key={n.id}
            className={`bottom-nav-item${view === n.id ? ' active' : ''}`}
            onClick={() => navigate(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {!!badge && <span className="nav-badge">{badge}</span>}
            {view === n.id && <div className="bnav-dot" />}
          </button>
          )
        })}
      </nav>
    </div>
  )
}
