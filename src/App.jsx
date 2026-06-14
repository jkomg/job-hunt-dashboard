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
import { Icon } from './ui-icons.jsx'
import { useTheme } from './useTheme.js'

const JOB_SEEKER_GROUPS = [
  {
    label: 'TODAY',
    items: [
      { id: 'dashboard',  label: 'Briefing',   icon: 'sunrise',       ico: 'oklch(0.60 0.22 252)' },
      { id: 'checkin',    label: 'Check-in',   icon: 'circle-check',  ico: 'oklch(0.60 0.17 200)' },
    ]
  },
  {
    label: 'SEARCH',
    items: [
      { id: 'pipeline',   label: 'Pipeline',   icon: 'columns',       ico: 'oklch(0.56 0.21 258)' },
      { id: 'contacts',   label: 'Outreach',   icon: 'users',         ico: 'oklch(0.64 0.16 232)' },
      { id: 'interviews', label: 'Interviews', icon: 'phone',         ico: 'oklch(0.58 0.22 244)' },
      { id: 'events',     label: 'Events',     icon: 'calendar',      ico: 'oklch(0.56 0.19 272)' },
      { id: 'watchlist',  label: 'Watchlist',  icon: 'eye',           ico: 'oklch(0.60 0.14 214)' },
    ]
  },
  {
    label: 'COMMS',
    items: [
      { id: 'inbox',      label: 'Inbox',      icon: 'message',       ico: 'oklch(0.58 0.20 246)' },
      { id: 'templates',  label: 'Templates',  icon: 'mail',          ico: 'oklch(0.54 0.13 262)' },
    ]
  },
]

const STAFF_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { id: 'dashboard',      label: 'Briefing',    icon: 'sunrise',        ico: 'oklch(0.60 0.22 252)' },
      { id: 'operations',     label: 'Operations',  icon: 'clipboard-list', ico: 'oklch(0.56 0.21 258)' },
    ]
  },
  {
    label: 'WORK',
    items: [
      { id: 'staff_tasks',    label: 'Tasks',       icon: 'list-checks',    ico: 'oklch(0.60 0.17 200)' },
      { id: 'staff_threads',  label: 'Threads',     icon: 'message-square', ico: 'oklch(0.64 0.16 232)' },
    ]
  },
]

const ADMIN_GROUPS = [
  {
    label: 'ADMIN',
    items: [
      { id: 'dashboard',          label: 'Briefing',        icon: 'sunrise',        ico: 'oklch(0.70 0.18 60)'  },
      { id: 'admin_operations',   label: 'Operations',      icon: 'zap',            ico: 'oklch(0.60 0.18 28)'  },
      { id: 'admin_users',        label: 'User Mgmt',       icon: 'users',          ico: 'oklch(0.56 0.22 268)' },
      { id: 'admin_assignments',  label: 'Assignments',     icon: 'link',           ico: 'oklch(0.62 0.14 300)' },
    ]
  },
]

const SETTINGS_ITEM = { id: 'settings', label: 'Settings', icon: 'settings', ico: 'oklch(0.52 0.06 258)' }

const MOBILE_NAV_ITEMS_SEEKER = [
  { id: 'dashboard',  label: 'Briefing',   icon: 'sunrise'      },
  { id: 'pipeline',   label: 'Pipeline',   icon: 'columns'      },
  { id: 'contacts',   label: 'Outreach',   icon: 'users'        },
  { id: 'inbox',      label: 'Inbox',      icon: 'message'      },
  { id: 'settings',   label: 'Settings',   icon: 'settings'     },
]

const MOBILE_NAV_ITEMS_STAFF = [
  { id: 'dashboard',     label: 'Briefing',   icon: 'sunrise'        },
  { id: 'operations',    label: 'Ops',        icon: 'clipboard-list' },
  { id: 'staff_tasks',   label: 'Tasks',      icon: 'list-checks'    },
  { id: 'staff_threads', label: 'Threads',    icon: 'message-square' },
  { id: 'settings',      label: 'Settings',   icon: 'settings'       },
]

function Sidebar({ view, go, groups, staffBadges, isStaffLike, me, onLogout }) {
  const allItems = groups.flatMap(g => g.items)
  const activeItem = allItems.find(it => it.id === view) || SETTINGS_ITEM

  function getBadge(id) {
    if (!isStaffLike) return 0
    if (id === 'staff_tasks') return staffBadges.tasksOpen
    if (id === 'staff_threads') return staffBadges.threadsOpen
    return 0
  }

  const initials = (me?.displayName || me?.username || '?').slice(0, 2).toUpperCase()
  const roleName = me?.isAdmin ? 'Admin' : me?.role === 'staff' ? 'Staff' : 'Job Seeker'

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Icon name="briefcase" /></div>
        <div className="brand-name">Job Hunt<span> ·</span></div>
      </div>

      <button className="cmdk" onClick={() => {}}>
        <Icon name="search" />
        <span>Quick jump…</span>
        <kbd>⌘K</kbd>
      </button>

      <nav className="nav">
        {groups.map(group => (
          <div key={group.label} className="nav-group">
            <div className="nav-group-label">{group.label}</div>
            {group.items.map(it => {
              const badge = getBadge(it.id)
              return (
                <button
                  key={it.id}
                  className={'nav-item' + (view === it.id ? ' active' : '')}
                  style={{ '--ico-color': it.ico }}
                  onClick={() => go(it.id)}
                >
                  <span className="nav-ico"><Icon name={it.icon} /></span>
                  <span>{it.label}</span>
                  {!!badge && <span className={'nav-badge' + (badge > 0 ? ' alert' : '')}>{badge}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="identity-chip" title={`role=${me?.role} org=${me?.organizationId || 'unknown'}`}>
          <strong>{me?.username || '?'}</strong>
          <span>{me?.role || 'unknown'}</span>
          {me?.organizationId && <span>{me.organizationId}</span>}
        </div>
        <button
          className={'nav-item' + (view === 'settings' ? ' active' : '')}
          style={{ '--ico-color': SETTINGS_ITEM.ico }}
          onClick={() => go('settings')}
        >
          <span className="nav-ico"><Icon name="settings" /></span>
          <span>Settings</span>
        </button>
        <div className="profile" onClick={onLogout} title="Sign out">
          <div className="avatar">{initials}</div>
          <div className="profile-info">
            <div className="profile-name">{me?.displayName || me?.username}</div>
            <div className="profile-role">{roleName}</div>
          </div>
          <Icon name="log-out" />
        </div>
      </div>
    </aside>
  )
}

function MobileNav({ view, go, items, staffBadges, isStaffLike }) {
  function getBadge(id) {
    if (!isStaffLike) return 0
    if (id === 'staff_tasks') return staffBadges.tasksOpen
    if (id === 'staff_threads') return staffBadges.threadsOpen
    return 0
  }

  return (
    <nav className="bottom-nav">
      {items.map(it => {
        const badge = getBadge(it.id)
        return (
          <button
            key={it.id}
            className={'bnav-item' + (view === it.id ? ' active' : '')}
            onClick={() => go(it.id)}
          >
            {!!badge && <span className="bnav-badge">{badge}</span>}
            <Icon name={it.icon} />
            <span>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(null)
  const [me, setMe] = useState(null)
  const [view, setView] = useState('dashboard')
  const [navIntent, setNavIntent] = useState(null)
  const [staffBadges, setStaffBadges] = useState({ tasksOpen: 0, threadsOpen: 0 })
  const { mode, accent, setMode, setAccent } = useTheme()

  function navigate(nextView, intent = null) {
    setView(nextView)
    setNavIntent(intent ? { ...intent, _ts: Date.now() } : { _ts: Date.now() })
  }

  async function refreshMe() {
    try {
      const r = await fetch('/api/me', { credentials: 'include' })
      if (!r.ok) { setAuthed(false); setMe(null); return }
      const data = await r.json()
      setMe(data)
      setAuthed(true)
    } catch {
      setAuthed(false)
      setMe(null)
    }
  }

  useEffect(() => { refreshMe() }, [])

  const isAdminOnly = me?.isAdmin && me?.role === 'admin'
  const isStaff = me?.role === 'staff'
  const isStaffLike = isStaff || isAdminOnly
  const navGroups = isAdminOnly ? ADMIN_GROUPS : (isStaff ? STAFF_GROUPS : JOB_SEEKER_GROUPS)
  const mobileItems = isStaff ? MOBILE_NAV_ITEMS_STAFF : MOBILE_NAV_ITEMS_SEEKER
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
      } catch { /* ignore */ }
    }
    loadBadges()
    const id = setInterval(loadBadges, 60000)
    return () => { active = false; clearInterval(id) }
  }, [authed, isStaffLike])

  useEffect(() => {
    if (authed !== true || !me?.onboardingComplete || me?.mustChangePassword) return
    if (view === 'staff_ops') setView('operations')
    if (!allNavIds.has(view)) setView(isStaffLike ? 'operations' : 'dashboard')
  }, [authed, me, isStaffLike])

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    setAuthed(false)
    setMe(null)
  }

  if (authed === null) {
    return (
      <div className="stage" data-mode={mode} data-accent={accent}>
        <div className="loading"><div className="spin" />Loading…</div>
      </div>
    )
  }

  if (!authed) return <Login onLogin={refreshMe} />
  if (me?.mustChangePassword) return <ForcePasswordChange onDone={refreshMe} onLogout={logout} />
  if (!me?.onboardingComplete) return <SetupWizard me={me} onComplete={refreshMe} onLogout={logout} />

  return (
    <div className="stage" data-mode={mode} data-accent={accent} data-nav="full">
      <Sidebar
        view={view}
        go={navigate}
        groups={navGroups}
        staffBadges={staffBadges}
        isStaffLike={isStaffLike}
        me={me}
        onLogout={logout}
      />

      <main className="main">
        {view === 'dashboard'      && <Dashboard onNavigate={navigate} me={me} />}
        {isStaff && view === 'operations'     && <StaffOps me={me} mode="operations" />}
        {isStaff && view === 'staff_tasks'    && <StaffOps me={me} mode="tasks" />}
        {isStaff && view === 'staff_threads'  && <StaffOps me={me} mode="threads" />}
        {!isStaffLike && view === 'checkin'       && <DailyCheckin />}
        {!isStaffLike && view === 'pipeline'      && <Pipeline navIntent={navIntent} />}
        {!isStaffLike && view === 'contacts'      && <Contacts />}
        {!isStaffLike && view === 'interviews'    && <Interviews />}
        {!isStaffLike && view === 'inbox'         && <Inbox />}
        {!isStaffLike && view === 'events'        && <Events />}
        {!isStaffLike && view === 'templates'     && <Templates />}
        {!isStaffLike && view === 'watchlist'     && <Watchlist />}
        {(view === 'settings' || view === 'admin_operations' || view === 'admin_users' || view === 'admin_assignments') && (
          <Settings
            me={me}
            onProfileUpdated={refreshMe}
            onNavigate={navigate}
            settingsMode={settingsMode}
            themeMode={mode}
            accent={accent}
            onModeChange={setMode}
            onAccentChange={setAccent}
          />
        )}
      </main>

      <MobileNav
        view={view}
        go={navigate}
        items={mobileItems}
        staffBadges={staffBadges}
        isStaffLike={isStaffLike}
      />
    </div>
  )
}
