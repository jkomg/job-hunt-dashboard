import { useState, useEffect } from 'react'

export const THEMES = [
  { id: 'system', label: 'System', icon: '💻' },
  { id: 'dark',   label: 'Dark',   icon: '🌑' },
  { id: 'dim',    label: 'Dim',    icon: '🌘' },
  { id: 'light',  label: 'Light',  icon: '☀️' },
]

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.dataset.theme = theme
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Keep system theme in sync if OS setting changes
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return [theme, setTheme]
}
