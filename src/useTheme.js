import { useState, useEffect } from 'react'

export function useTheme() {
  const [mode, setModeState] = useState(() => localStorage.getItem('theme-mode') || 'light')
  const [accent, setAccentState] = useState(() => localStorage.getItem('theme-accent') || 'indigo')

  function setMode(v) {
    setModeState(v)
    localStorage.setItem('theme-mode', v)
  }

  function setAccent(v) {
    setAccentState(v)
    localStorage.setItem('theme-accent', v)
  }

  return { mode, accent, setMode, setAccent }
}
