import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui-icons.jsx'

const COMMANDS = [
  { id: 'dashboard', label: 'Briefing', description: 'See what deserves attention today', icon: 'sunrise' },
  { id: 'checkin', label: 'Check-in', description: 'Log activity and plan tomorrow', icon: 'circle-check' },
  { id: 'pipeline', label: 'Pipeline', description: 'Review roles and next actions', icon: 'columns' },
  { id: 'contacts', label: 'Outreach', description: 'Keep relationships moving', icon: 'users' },
  { id: 'interviews', label: 'Interviews', description: 'Prepare for upcoming conversations', icon: 'phone' },
  { id: 'guides', label: 'Guides', description: 'Get a short walkthrough', icon: 'book-open' },
  { id: 'settings', label: 'Settings', description: 'Manage your workspace', icon: 'settings' },
]

export default function QuickJump({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const filtered = COMMANDS.filter(command => {
    const haystack = `${command.label} ${command.description}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  useEffect(() => {
    if (!open) return
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  if (!open) return null

  function choose(id) {
    onNavigate(id)
    onClose()
  }

  return (
    <div className="quick-jump-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="quick-jump" role="dialog" aria-modal="true" aria-labelledby="quick-jump-title">
        <div className="quick-jump-head">
          <div>
            <div id="quick-jump-title" className="quick-jump-title">Quick jump</div>
            <div className="quick-jump-sub">Go straight to the next place you need to work.</div>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onClose} aria-label="Close quick jump">
            <Icon name="x" />
          </button>
        </div>
        <input
          ref={inputRef}
          className="quick-jump-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && filtered[0]) choose(filtered[0].id)
          }}
          placeholder="Search destinations…"
          aria-label="Search destinations"
        />
        <div className="quick-jump-list" role="listbox" aria-label="Destinations">
          {filtered.map(command => (
            <button
              type="button"
              key={command.id}
              className="quick-jump-item"
              onClick={() => choose(command.id)}
              role="option"
            >
              <span className="quick-jump-icon"><Icon name={command.icon} /></span>
              <span className="quick-jump-copy"><strong>{command.label}</strong><small>{command.description}</small></span>
              <Icon name="arrow-right" />
            </button>
          ))}
          {!filtered.length && <div className="quick-jump-empty">No destinations match “{query}”.</div>}
        </div>
        <div className="quick-jump-foot"><kbd>Enter</kbd> open · <kbd>Esc</kbd> close</div>
      </div>
    </div>
  )
}
