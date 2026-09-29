function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function icsDate(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}${match[2]}${match[3]}`
  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10).replaceAll('-', '') : null
}

function eventToIcs(event, index) {
  const date = icsDate(event.date || event.Date)
  if (!date) return null
  const uid = icsEscape(`${event.id || event.sourceKey || index}@job-hunt-dashboard`)
  const summary = icsEscape(event.name || event.Name || 'Job search event')
  const description = icsEscape(event.notes || event.Notes || '')
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').replace(/\d{3}Z$/, 'Z')}`,
    `DTSTART;VALUE=DATE:${date}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : null,
    'END:VEVENT'
  ].filter(Boolean).join('\r\n')
}

export function buildCalendarFeed({ interviews = [], events = [] } = {}) {
  const items = [
    ...interviews.map(item => ({ ...item, name: `${item.Company || 'Interview'}${item.Round ? ` — ${item.Round}` : ''}`, date: item.Date, notes: [item.Format, item.Location, item.Notes].filter(Boolean).join(' · ') })),
    ...events.map(item => ({ ...item, name: item.Name, date: item.Date, notes: item.Notes }))
  ]
  const vevents = items.map(eventToIcs).filter(Boolean)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Hunt Dashboard//Reminders//EN',
    'CALSCALE:GREGORIAN',
    ...vevents,
    'END:VCALENDAR',
    ''
  ].join('\r\n')
}

export function buildReminderPreview(queue = [], { channel = 'calendar', timezone = 'UTC' } = {}) {
  return {
    channel,
    timezone,
    items: queue.slice(0, 5).map(item => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle || '',
      dueDate: item.dueDate || null,
      route: item.route
    }))
  }
}
