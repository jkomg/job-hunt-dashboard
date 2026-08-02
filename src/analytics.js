const sentThisSession = new Set()

export function trackEvent(eventName, metadata = null) {
  if (!eventName || sentThisSession.has(eventName)) return
  sentThisSession.add(eventName)
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventName, metadata })
  }).catch(() => {})
}
