import { google } from 'googleapis'

const DEFAULT_QUERY = String(process.env.GMAIL_IMPORT_QUERY || 'newer_than:60d (filename:ics OR subject:(interview OR recruiter OR hiring))').trim()

function decodeBase64Url(input = '') {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  const withPad = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`
  return Buffer.from(withPad, 'base64').toString('utf8')
}

function unfoldIcsLines(text) {
  const rawLines = String(text || '').split(/\r?\n/)
  const lines = []
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function parseIcsDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }

  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/)
  if (!m) return null
  const [, y, mo, d, hh, mm, ss] = m
  const iso = raw.endsWith('Z')
    ? `${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`
    : `${y}-${mo}-${d}T${hh}:${mm}:${ss}`
  const dt = new Date(iso)
  if (!Number.isFinite(dt.getTime())) {
    return `${y}-${mo}-${d}`
  }
  return dt.toISOString().slice(0, 10)
}

function parseIcsEvents(icsText) {
  const lines = unfoldIcsLines(icsText)
  const events = []
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    const idx = line.indexOf(':')
    if (idx === -1) continue
    const left = line.slice(0, idx)
    const value = line.slice(idx + 1).trim()
    const key = left.split(';')[0].toUpperCase().trim()

    if (key === 'UID') current.uid = value
    if (key === 'SUMMARY') current.summary = value
    if (key === 'DTSTART') current.startDate = parseIcsDate(value)
    if (key === 'LOCATION') current.location = value
    if (key === 'DESCRIPTION') current.description = value.replace(/\\n/g, '\n')
    if (key === 'URL') current.url = value
    if (key === 'ORGANIZER') current.organizer = value.replace(/^mailto:/i, '')
  }

  return events.filter(evt => evt.summary || evt.startDate)
}

function flattenParts(part, out = []) {
  if (!part) return out
  out.push(part)
  if (Array.isArray(part.parts)) {
    for (const child of part.parts) flattenParts(child, out)
  }
  return out
}

function buildConfigFromEnv() {
  return {
    clientId: String(process.env.GMAIL_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GMAIL_OAUTH_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.GMAIL_OAUTH_REDIRECT_URI || '').trim(),
    query: DEFAULT_QUERY
  }
}

function isConfigured(config) {
  return !!(config.clientId && config.clientSecret && config.redirectUri)
}

function createOauthClient(config) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
}

export function getGmailIntegrationConfig() {
  const config = buildConfigFromEnv()
  return {
    ...config,
    configured: isConfigured(config)
  }
}

export function buildGmailAuthUrl() {
  const config = getGmailIntegrationConfig()
  if (!config.configured) {
    throw new Error('Gmail OAuth is not configured. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REDIRECT_URI.')
  }
  const oauth2 = createOauthClient(config)
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: ['https://www.googleapis.com/auth/gmail.readonly']
  })
  return { url }
}

export async function exchangeGmailCode(code) {
  const config = getGmailIntegrationConfig()
  if (!config.configured) {
    throw new Error('Gmail OAuth is not configured.')
  }
  const oauth2 = createOauthClient(config)
  const { tokens } = await oauth2.getToken(String(code || '').trim())
  oauth2.setCredentials(tokens)
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return {
    tokens,
    email: profile.data.emailAddress || null
  }
}

export async function importEventsFromGmail({ tokens, maxMessages = 40 } = {}) {
  const config = getGmailIntegrationConfig()
  if (!config.configured) {
    throw new Error('Gmail OAuth is not configured.')
  }
  if (!tokens?.access_token && !tokens?.refresh_token) {
    throw new Error('Gmail is not connected.')
  }

  const oauth2 = createOauthClient(config)
  oauth2.setCredentials(tokens)
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: config.query,
    maxResults: Math.max(1, Math.min(Number(maxMessages) || 40, 200))
  })

  const messages = listRes.data.messages || []
  const collectedEvents = []

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
    const payload = full.data.payload || {}
    const headers = Array.isArray(payload.headers) ? payload.headers : []
    const byName = name => headers.find(h => String(h.name || '').toLowerCase() === name)?.value || ''
    const subject = byName('subject') || 'Imported event'
    const messageId = byName('message-id') || full.data.id || ''

    const parts = flattenParts(payload)
    const icsCandidates = parts.filter(p => {
      const mime = String(p.mimeType || '').toLowerCase()
      const filename = String(p.filename || '').toLowerCase()
      return mime === 'text/calendar' || filename.endsWith('.ics')
    })

    for (let i = 0; i < icsCandidates.length; i += 1) {
      const part = icsCandidates[i]
      let icsText = ''
      if (part.body?.data) {
        icsText = decodeBase64Url(part.body.data)
      } else if (part.body?.attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: msg.id,
          id: part.body.attachmentId
        })
        icsText = decodeBase64Url(attachment.data.data || '')
      }

      if (!icsText) continue
      const parsed = parseIcsEvents(icsText)

      for (let j = 0; j < parsed.length; j += 1) {
        const evt = parsed[j]
        const sourceKey = `gmail:${msg.id}:${evt.uid || i}:${j}`
        const noteParts = [
          `Imported from Gmail (${subject}).`,
          evt.organizer ? `Organizer: ${evt.organizer}` : null,
          evt.location ? `Location: ${evt.location}` : null,
          evt.description ? `Details: ${evt.description.slice(0, 500)}` : null
        ].filter(Boolean)

        collectedEvents.push({
          sourceKey,
          name: evt.summary || subject,
          date: evt.startDate || null,
          registrationLink: evt.url || null,
          notes: noteParts.join('\n')
        })
      }
    }

    if (collectedEvents.length >= 500) break
  }

  return {
    events: collectedEvents,
    tokens: oauth2.credentials
  }
}
