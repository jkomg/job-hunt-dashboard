const sentThisSession = new Set()
const SESSION_EVENTS = new Set(['app_open'])

export function trackEvent(eventName, metadata = null) {
  if (!eventName) return
  if (SESSION_EVENTS.has(eventName)) {
    if (sentThisSession.has(eventName)) return
    sentThisSession.add(eventName)
  }
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventName, metadata })
  }).catch(() => {})
}
