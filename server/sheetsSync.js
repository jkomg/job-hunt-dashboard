import crypto from 'crypto'
import { google } from 'googleapis'

import {
  getSheetSyncLink,
  getSheetSyncLinks,
  updateSheetSyncInboundHash,
  updateSheetSyncOutboundHash,
  upsertSheetSyncLink,
  getEntitySheetSyncLink,
  getEntitySheetSyncLinks,
  updateEntitySheetSyncInboundHash,
  updateEntitySheetSyncOutboundHash,
  upsertEntitySheetSyncLink,
  createSheetSyncRun
} from './db.js'

import {
  getPipeline,
  createPipelineEntry,
  getContacts,
  createContact,
  getInterviews,
  createInterview,
  getEvents,
  createEvent
} from './db.js'

const STAGE_MAP = new Map([
  ['researching', '🔍 Researching'],
  ['applied', '📨 Applied'],
  ['warm outreach sent', '🤝 Warm Outreach Sent'],
  ['in conversation', '💬 In Conversation'],
  ['interview scheduled', '📞 Interview Scheduled'],
  ['interviewing', '🎯 Interviewing'],
  ['offer', '📋 Offer'],
  ['closed', '❌ Closed']
])

const STAGE_TO_SHEET_STATUS = new Map([
  ['🔍 Researching', 'Researching'],
  ['📨 Applied', 'Applied'],
  ['🤝 Warm Outreach Sent', 'Warm Outreach Sent'],
  ['💬 In Conversation', 'In Conversation'],
  ['📞 Interview Scheduled', 'Interview Scheduled'],
  ['🎯 Interviewing', 'Interviewing'],
  ['📋 Offer', 'Offer'],
  ['❌ Closed', 'Closed']
])

const DEFAULT_PIPELINE_TABS = 'Jobs & Applications,Found'
const DEFAULT_CONTACTS_TABS = 'Networking Tracker'
const DEFAULT_INTERVIEWS_TABS = 'Interview Tracker'
const DEFAULT_EVENTS_TABS = 'Events'

function parseBool(value, fallback = false) {
  if (value == null) return fallback
  const v = String(value).trim().toLowerCase()
  if (!v) return fallback
  return ['1', 'true', 'yes', 'y', 'on'].includes(v)
}

function parseTabs(raw, fallback = '') {
  const source = raw || fallback
  return source.split(',').map(t => t.trim()).filter(Boolean)
}

function normalizeSheetId(input) {
  const value = String(input || '').trim()
  if (!value) return ''
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match?.[1]) return match[1]
  return value
}

export function resolveSheetsSyncConfig(overrides = {}) {
  const fromEnv = {
    enabled: parseBool(process.env.GOOGLE_SHEETS_SYNC_ENABLED, true),
    sheetId: (process.env.GOOGLE_SHEETS_ID || '').trim(),
    pipelineTabs: parseTabs(process.env.GOOGLE_SHEETS_SYNC_TABS, DEFAULT_PIPELINE_TABS),
    contactsTabs: parseTabs(process.env.GOOGLE_SHEETS_CONTACTS_SYNC_TABS, DEFAULT_CONTACTS_TABS),
    interviewsTabs: parseTabs(process.env.GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS, DEFAULT_INTERVIEWS_TABS),
    eventsTabs: parseTabs(process.env.GOOGLE_SHEETS_EVENTS_SYNC_TABS, DEFAULT_EVENTS_TABS),
    credentialsRaw: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS_JSON || ''
  }

  const config = {
    enabled: overrides.enabled == null ? fromEnv.enabled : parseBool(overrides.enabled, fromEnv.enabled),
    sheetId: normalizeSheetId(overrides.sheetId == null ? fromEnv.sheetId : String(overrides.sheetId)),
    pipelineTabs: Array.isArray(overrides.pipelineTabs)
      ? overrides.pipelineTabs.map(t => String(t).trim()).filter(Boolean)
      : parseTabs(overrides.pipelineTabs, fromEnv.pipelineTabs.join(',')),
    contactsTabs: Array.isArray(overrides.contactsTabs)
      ? overrides.contactsTabs.map(t => String(t).trim()).filter(Boolean)
      : parseTabs(overrides.contactsTabs, fromEnv.contactsTabs.join(',')),
    interviewsTabs: Array.isArray(overrides.interviewsTabs)
      ? overrides.interviewsTabs.map(t => String(t).trim()).filter(Boolean)
      : parseTabs(overrides.interviewsTabs, fromEnv.interviewsTabs.join(',')),
    eventsTabs: Array.isArray(overrides.eventsTabs)
      ? overrides.eventsTabs.map(t => String(t).trim()).filter(Boolean)
      : parseTabs(overrides.eventsTabs, fromEnv.eventsTabs.join(',')),
    credentialsRaw: overrides.credentialsRaw == null ? fromEnv.credentialsRaw : String(overrides.credentialsRaw)
  }

  return config
}

function validateSheetsSyncConfig(config) {
  if (!config.enabled) {
    return { ok: false, code: 'SYNC_DISABLED', message: 'Google Sheets sync is disabled.' }
  }
  if (!config.sheetId) {
    return { ok: false, code: 'MISSING_SHEET_ID', message: 'Google Sheet ID is missing.' }
  }
  if (!config.credentialsRaw) {
    return { ok: false, code: 'MISSING_CREDENTIALS', message: 'Google Sheets credentials are missing.' }
  }
  return { ok: true }
}

function parseCredentials(raw) {
  if (!raw) {
    const err = new Error('Missing GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_CREDENTIALS_JSON')
    err.code = 'MISSING_CREDENTIALS'
    throw err
  }

  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    } catch {
      const err = new Error('Google credentials JSON is invalid (plain or base64)')
      err.code = 'INVALID_CREDENTIALS'
      throw err
    }
  }
}

function credentialsServiceAccountEmail(credentials) {
  const email = String(credentials?.client_email || '').trim()
  return email || null
}

async function getSheetsClient(credentials) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  return google.sheets({ version: 'v4', auth })
}

function withStatus(error, status) {
  const e = error instanceof Error ? error : new Error(String(error || 'Unknown sync error'))
  e.status = status
  return e
}

export function normalizeSheetsSyncError(error) {
  const message = String(error?.message || 'Unknown sync error')
  const lower = message.toLowerCase()
  const status = Number(error?.status || error?.code || 500)

  const normalized = {
    code: 'SYNC_UNKNOWN',
    status: Number.isFinite(status) ? status : 500,
    retryable: false,
    userMessage: 'Google Sheets sync failed.',
    fixSteps: ['Open Settings and run "Test connection" to see what needs to be fixed.'],
    details: message
  }

  if (lower.includes('sync is disabled') || error?.code === 'SYNC_DISABLED') {
    normalized.code = 'SYNC_DISABLED'
    normalized.status = 400
    normalized.userMessage = 'Google Sheets sync is turned off.'
    normalized.fixSteps = ['Open Settings.', 'Turn on Google Sheets sync.', 'Run "Test connection".']
    return normalized
  }

  if (lower.includes('missing') && lower.includes('sheet id') || error?.code === 'MISSING_SHEET_ID') {
    normalized.code = 'MISSING_SHEET_ID'
    normalized.status = 400
    normalized.userMessage = 'No Google Sheet is configured.'
    normalized.fixSteps = ['Open Settings.', 'Paste your Google Sheet URL or ID.', 'Save settings, then run "Test connection".']
    return normalized
  }

  if (lower.includes('missing google_sheets_credentials_json') || error?.code === 'MISSING_CREDENTIALS') {
    normalized.code = 'MISSING_CREDENTIALS'
    normalized.status = 400
    normalized.userMessage = 'Google credentials are missing.'
    normalized.fixSteps = ['Set GOOGLE_SHEETS_CREDENTIALS_JSON in your environment.', 'Restart the app.', 'Run "Test connection".']
    return normalized
  }

  if (lower.includes('credentials json is invalid') || error?.code === 'INVALID_CREDENTIALS') {
    normalized.code = 'INVALID_CREDENTIALS'
    normalized.status = 400
    normalized.userMessage = 'Google credentials are invalid.'
    normalized.fixSteps = ['Regenerate a service-account JSON key in Google Cloud.', 'Update GOOGLE_SHEETS_CREDENTIALS_JSON.', 'Restart and re-test connection.']
    return normalized
  }

  if (status === 403 || lower.includes('permission')) {
    normalized.code = 'SHEET_PERMISSION_DENIED'
    normalized.status = 403
    normalized.userMessage = 'Google denied access to this sheet.'
    normalized.fixSteps = ['Open the Google Sheet and click Share.', 'Add the service-account email as Editor.', 'Run "Test connection" again.']
    return normalized
  }

  if (status === 404 || lower.includes('requested entity was not found')) {
    normalized.code = 'SHEET_NOT_FOUND'
    normalized.status = 404
    normalized.userMessage = 'The configured Google Sheet could not be found.'
    normalized.fixSteps = ['Confirm the Sheet URL or ID in Settings.', 'Make sure the sheet still exists.', 'Save and test again.']
    return normalized
  }

  if (lower.includes('unable to parse range') || lower.includes('cannot find range') || error?.code === 'TAB_NOT_FOUND') {
    normalized.code = 'TAB_NOT_FOUND'
    normalized.status = 400
    normalized.userMessage = 'One or more configured tab names were not found in the sheet.'
    normalized.fixSteps = ['Open Settings.', 'Verify tab names exactly match the sheet tabs.', 'Save and run sync again.']
    return normalized
  }

  if (lower.includes('google sheets api has not been used') || lower.includes('api has not been used')) {
    normalized.code = 'GOOGLE_API_DISABLED'
    normalized.status = 400
    normalized.userMessage = 'Google Sheets API is not enabled for the Google Cloud project.'
    normalized.fixSteps = ['Open Google Cloud Console.', 'Enable Google Sheets API for the project used by the service account.', 'Retry in a minute.']
    return normalized
  }

  if (status === 429 || status === 503 || status === 504 || lower.includes('quota') || lower.includes('timeout')) {
    normalized.code = 'GOOGLE_TEMPORARY'
    normalized.status = 503
    normalized.retryable = true
    normalized.userMessage = 'Google Sheets is temporarily unavailable or rate-limited.'
    normalized.fixSteps = ['Wait a minute and try again.', 'If this repeats, reduce sync frequency.']
    return normalized
  }

  return normalized
}

function normalizeHeader(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildHeaderIndex(headers) {
  const out = new Map()
  headers.forEach((header, idx) => {
    out.set(normalizeHeader(header), idx)
  })
  return out
}

function findHeaderIndex(headerIndex, candidates) {
  for (const candidate of candidates) {
    const idx = headerIndex.get(normalizeHeader(candidate))
    if (idx !== undefined) return idx
  }
  return -1
}

function normalizeUrl(url) {
  const value = (url || '').trim()
  if (!value) return ''
  return value.replace(/\/$/, '').toLowerCase()
}

function normalizeText(value) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function toIsoDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    const year = dmy[3]
    return `${year}-${month}-${day}`
  }

  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw)
    if (!Number.isNaN(serial)) {
      const base = new Date(Date.UTC(1899, 11, 30))
      base.setUTCDate(base.getUTCDate() + serial)
      return base.toISOString().slice(0, 10)
    }
  }

  return null
}

function canonicalStage(value) {
  const clean = normalizeText(value)
  if (!clean) return null
  for (const [k, v] of STAGE_MAP.entries()) {
    if (clean.includes(k)) return v
  }
  return null
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function pickInboundFields(tabName, rowObj) {
  const company = rowObj.company || rowObj['company name'] || rowObj.employer || rowObj.organization
  if (!company) return null

  const role = rowObj.role || rowObj['job title'] || rowObj.title || rowObj.position || ''
  const stage = canonicalStage(rowObj.status || rowObj.stage) || '🔍 Researching'

  const source = rowObj.source || rowObj['found by'] || tabName
  const followUpDateRaw = rowObj['follow up date'] || rowObj['follow-up date'] || rowObj['follow up'] || rowObj['follow-up'] || rowObj['next follow-up'] || ''
  const appliedDateRaw = rowObj['app date'] || rowObj['date applied'] || rowObj['applied date'] || ''
  const dateAddedRaw = rowObj['date added'] || ''
  const notes = rowObj.notes || ''

  const followUpDate = toIsoDate(followUpDateRaw)
  const appliedDate = toIsoDate(appliedDateRaw)
  const dateAdded = toIsoDate(dateAddedRaw)

  const out = {
    Company: company,
    Role: role,
    Stage: canonicalStage(rowObj['app status'] || rowObj.status || rowObj.stage) || stage,
    'Job URL': rowObj['link to posting'] || rowObj['job url'] || rowObj.url || rowObj['application link'] || '',
    'Job Source': rowObj['job source'] || source || '',
    'Date Applied': appliedDate || dateAdded || null,
    'Follow-Up Date': followUpDate || null,
    'Resume URL': rowObj['resume url'] || rowObj.resume || rowObj['resume link'] || '',
    'Cover Letter': rowObj['cover letter'] || rowObj['cover letter url'] || rowObj['cover letter link'] || ''
  }

  const foundBy = rowObj['found by'] || ''
  const notesParts = []
  if (foundBy) notesParts.push(`Found by: ${foundBy}`)
  if (notes) notesParts.push(`Sheet notes: ${notes}`)
  if (notesParts.length) {
    out['Research Notes'] = `[Sheets:${tabName}] ${notesParts.join(' | ')}`
  }

  return out
}

function toRowObject(headers, row) {
  const obj = {}
  headers.forEach((header, idx) => {
    obj[normalizeHeader(header)] = (row[idx] || '').toString().trim()
  })
  return obj
}

function buildPipelineIndex(items) {
  const byId = new Map(items.map(item => [item.id, item]))
  const byUrl = new Map()
  const byCompanyRole = new Map()

  for (const item of items) {
    const url = normalizeUrl(item['Job URL'])
    if (url) byUrl.set(url, item)

    const key = `${normalizeText(item.Company)}::${normalizeText(item.Role)}`
    if (normalizeText(item.Company)) byCompanyRole.set(key, item)
  }

  return { byId, byUrl, byCompanyRole }
}

function buildContactsIndex(items) {
  const byId = new Map(items.map(item => [item.id, item]))
  const byLinkedIn = new Map()
  const byNameCompany = new Map()

  for (const item of items) {
    const linkedIn = normalizeUrl(item['LinkedIn URL'])
    if (linkedIn) byLinkedIn.set(linkedIn, item)

    const key = `${normalizeText(item.Name)}::${normalizeText(item.Company)}`
    if (normalizeText(item.Name)) byNameCompany.set(key, item)
  }

  return { byId, byLinkedIn, byNameCompany }
}

function buildInterviewsIndex(items) {
  const byId = new Map(items.map(item => [item.id, item]))
  const bySignature = new Map()

  for (const item of items) {
    const key = `${normalizeText(item.Company)}::${normalizeText(item['Job Title'])}::${item.Date || ''}::${normalizeText(item.Round)}`
    if (normalizeText(item.Company)) bySignature.set(key, item)
  }

  return { byId, bySignature }
}

function buildEventsIndex(items) {
  const byId = new Map(items.map(item => [item.id, item]))
  const byNameDate = new Map()

  for (const item of items) {
    const key = `${normalizeText(item.Name)}::${item.Date || ''}`
    if (normalizeText(item.Name)) byNameDate.set(key, item)
  }

  return { byId, byNameDate }
}

function asBool(value) {
  const s = normalizeText(value)
  if (!s) return false
  return ['true', 'yes', 'y', '1', 'checked', 'done', 'sent'].includes(s)
}

function pickInboundContactFields(rowObj) {
  const name = rowObj.name || rowObj.contact || rowObj['contact name']
  if (!name) return null

  return {
    Name: name,
    Title: rowObj.title || '',
    Company: rowObj.company || '',
    Warmth: rowObj.warmth || '❄️ Cold — no contact yet',
    Status: rowObj.status || 'Need to reach out',
    'How We Know Each Other': rowObj['how we know each other'] || '',
    'LinkedIn URL': rowObj['linkedin url'] || rowObj.linkedin || '',
    'Next Follow-Up': toIsoDate(rowObj['next follow up'] || rowObj['next follow-up'] || rowObj['follow up date'] || rowObj['follow-up date']) || null,
    Email: rowObj.email || '',
    Phone: rowObj.phone || '',
    'Resume Used': rowObj['resume used'] || rowObj.resume || '',
    Notes: rowObj.notes || ''
  }
}

function pickInboundInterviewFields(rowObj) {
  const company = rowObj.company || rowObj.employer
  if (!company) return null

  return {
    Company: company,
    'Job Title': rowObj['job title'] || rowObj.role || rowObj.title || '',
    Date: toIsoDate(rowObj.date || rowObj['interview date']) || null,
    Round: rowObj.round || '',
    Format: rowObj.format || '',
    Outcome: rowObj.outcome || 'Pending',
    Interviewer: rowObj.interviewer || '',
    'Questions Asked': rowObj['questions asked'] || '',
    'Feedback Received': rowObj['feedback received'] || rowObj.feedback || '',
    'Follow-Up Sent': asBool(rowObj['follow-up sent'] || rowObj['follow up sent'] || rowObj['thank you sent']),
    Notes: rowObj.notes || ''
  }
}

function pickInboundEventFields(rowObj) {
  const name = rowObj.name || rowObj.event
  if (!name) return null

  return {
    Name: name,
    Date: toIsoDate(rowObj.date || rowObj['event date']) || null,
    Price: rowObj.price || '',
    Status: rowObj.status || 'Interested',
    'Registration Link': rowObj['registration link'] || rowObj.link || rowObj.url || '',
    Notes: rowObj.notes || ''
  }
}

function patchOutboundContactValues(headers, rowValues, item) {
  const headerIndex = buildHeaderIndex(headers)
  const out = [...rowValues]
  const patch = (candidates, value) => {
    const idx = findHeaderIndex(headerIndex, candidates)
    if (idx >= 0 && value != null && String(value).trim() !== '') out[idx] = value
  }

  patch(['name', 'contact', 'contact name'], item.Name || '')
  patch(['title'], item.Title || '')
  patch(['company'], item.Company || '')
  patch(['warmth'], item.Warmth || '')
  patch(['status'], item.Status || '')
  patch(['how we know each other'], item['How We Know Each Other'] || '')
  patch(['linkedin url', 'linkedin'], item['LinkedIn URL'] || '')
  patch(['next follow up', 'next follow-up', 'follow up date', 'follow-up date'], item['Next Follow-Up'] || '')
  patch(['email'], item.Email || '')
  patch(['phone'], item.Phone || '')
  patch(['resume used', 'resume'], item['Resume Used'] || '')
  patch(['notes'], item.Notes || '')
  return out
}

function patchOutboundInterviewValues(headers, rowValues, item) {
  const headerIndex = buildHeaderIndex(headers)
  const out = [...rowValues]
  const patch = (candidates, value) => {
    const idx = findHeaderIndex(headerIndex, candidates)
    if (idx >= 0 && value != null && String(value).trim() !== '') out[idx] = value
  }

  patch(['company', 'employer'], item.Company || '')
  patch(['job title', 'role', 'title'], item['Job Title'] || '')
  patch(['date', 'interview date'], item.Date || '')
  patch(['round'], item.Round || '')
  patch(['format'], item.Format || '')
  patch(['outcome'], item.Outcome || '')
  patch(['interviewer'], item.Interviewer || '')
  patch(['questions asked'], item['Questions Asked'] || '')
  patch(['feedback received', 'feedback'], item['Feedback Received'] || '')
  patch(['follow-up sent', 'follow up sent', 'thank you sent'], item['Follow-Up Sent'] ? 'TRUE' : 'FALSE')
  patch(['notes'], item.Notes || '')
  return out
}

function patchOutboundEventValues(headers, rowValues, item) {
  const headerIndex = buildHeaderIndex(headers)
  const out = [...rowValues]
  const patch = (candidates, value) => {
    const idx = findHeaderIndex(headerIndex, candidates)
    if (idx >= 0 && value != null && String(value).trim() !== '') out[idx] = value
  }

  patch(['name', 'event'], item.Name || '')
  patch(['date', 'event date'], item.Date || '')
  patch(['price'], item.Price || '')
  patch(['status'], item.Status || '')
  patch(['registration link', 'link', 'url'], item['Registration Link'] || '')
  patch(['notes'], item.Notes || '')
  return out
}

function colToA1(colNum) {
  let n = colNum
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function hasSyncConflict({ lastInboundHash, currentInboundHash, lastOutboundHash, nextOutboundHash }) {
  if (!lastInboundHash || !currentInboundHash || !lastOutboundHash || !nextOutboundHash) return false
  const sheetChanged = currentInboundHash !== lastInboundHash
  const localChanged = nextOutboundHash !== lastOutboundHash
  return sheetChanged && localChanged
}

function patchOutboundValues(headers, rowValues, pipelineItem) {
  const headerIndex = buildHeaderIndex(headers)
  const out = [...rowValues]

  const patch = (candidates, value) => {
    const idx = findHeaderIndex(headerIndex, candidates)
    if (idx >= 0 && value != null && String(value).trim() !== '') out[idx] = value
  }

  patch(['app status', 'status', 'stage'], STAGE_TO_SHEET_STATUS.get(pipelineItem.Stage) || pipelineItem.Stage || '')
  patch(['follow up date', 'follow-up date', 'follow up', 'next follow-up'], pipelineItem['Follow-Up Date'] || '')
  patch(['notes'], pipelineItem.Notes || '')
  patch(['research notes'], pipelineItem['Research Notes'] || '')
  patch(['app date', 'date applied', 'applied date'], pipelineItem['Date Applied'] || '')
  patch(['outcome'], pipelineItem.Outcome || '')
  patch(['resume url', 'resume', 'resume link'], pipelineItem['Resume URL'] || '')
  patch(['cover letter', 'cover letter url', 'cover letter link'], pipelineItem['Cover Letter'] || '')
  patch(['contact name', 'contact'], pipelineItem['Contact Name'] || '')
  patch(['contact title', 'title'], pipelineItem['Contact Title'] || '')
  patch(['next action'], pipelineItem['Next Action'] || '')
  patch(['next action date'], pipelineItem['Next Action Date'] || '')

  const contacts = Array.isArray(pipelineItem['Application Contacts']) ? pipelineItem['Application Contacts'] : []
  const first = contacts[0] || null
  if (first) {
    patch(['linkedin', 'linkedin url', 'linked in'], first.linkedinUrl || '')
    patch(['email', 'contact email'], first.email || '')
  }

  return out
}

function parseRowNumberFromRange(range) {
  const m = String(range || '').match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?$/i)
  return m ? Number(m[1]) : null
}

async function readTabRows(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:ZZ`,
    valueRenderOption: 'FORMULA',
    dateTimeRenderOption: 'FORMATTED_STRING'
  })

  const values = res.data.values || []
  if (values.length === 0) return { headers: [], rows: [] }

  const headers = values[0].map(v => (v || '').toString().trim())
  const rows = values.slice(1)
  return { headers, rows }
}

async function runInboundSync({ sheets, spreadsheetId, tabs, scope }) {
  const pipeline = await getPipeline(scope)
  const index = buildPipelineIndex(pipeline)

  const summary = {
    imported: 0,
    linkedExisting: 0,
    skippedUnchanged: 0,
    skippedIncomplete: 0,
    tabs: {}
  }

  for (const tab of tabs) {
    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    summary.tabs[tab] = { scanned: rows.length, imported: 0, linked: 0, skipped: 0 }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2
      const rowObj = toRowObject(headers, row)
      const payload = pickInboundFields(tab, rowObj)

      if (!payload) {
        summary.skippedIncomplete++
        summary.tabs[tab].skipped++
        continue
      }

      const inboundHash = hashObject({ payload, tab, rowNumber })
      const existingLink = await getSheetSyncLink(spreadsheetId, tab, rowNumber)

      if (existingLink?.last_inbound_hash === inboundHash) {
        summary.skippedUnchanged++
        summary.tabs[tab].skipped++
        continue
      }

      if (existingLink) {
        await updateSheetSyncInboundHash(existingLink.id, inboundHash)
        summary.linkedExisting++
        summary.tabs[tab].linked++
        continue
      }

      const byUrl = payload['Job URL'] ? index.byUrl.get(normalizeUrl(payload['Job URL'])) : null
      const byCompanyRole = index.byCompanyRole.get(`${normalizeText(payload.Company)}::${normalizeText(payload.Role)}`)
      const matched = byUrl || byCompanyRole || null

      let pageId
      if (matched) {
        pageId = matched.id
      } else {
        const created = await createPipelineEntry(payload, scope)
        pageId = created.id
        index.byId.set(created.id, { id: created.id, ...payload })
        if (payload['Job URL']) index.byUrl.set(normalizeUrl(payload['Job URL']), { id: created.id, ...payload })
        index.byCompanyRole.set(`${normalizeText(payload.Company)}::${normalizeText(payload.Role)}`, { id: created.id, ...payload })
        summary.imported++
        summary.tabs[tab].imported++
      }

      await upsertSheetSyncLink({
        sheetId: spreadsheetId,
        tabName: tab,
        rowNumber,
        pipelinePageId: pageId,
        lastInboundHash: inboundHash,
        lastOutboundHash: existingLink?.last_outbound_hash || null
      })
    }
  }

  return summary
}

async function runOutboundSync({ sheets, spreadsheetId, tabs, scope }) {
  const links = await getSheetSyncLinks(spreadsheetId)
  const pipeline = await getPipeline(scope)
  const byId = new Map(pipeline.map(item => [item.id, item]))
  const linkedIds = new Set(links.map(l => String(l.pipeline_page_id)))

  const summary = {
    updatedRows: 0,
    appendedRows: 0,
    skippedUnchanged: 0,
    conflicts: 0,
    missingLinkedRecords: 0,
    tabs: {}
  }

  for (const tab of tabs) {
    const tabLinks = links.filter(link => link.tab_name === tab)
    if (!summary.tabs[tab]) summary.tabs[tab] = { updated: 0, appended: 0, skipped: 0, conflicts: 0, missing: 0 }

    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)

    for (const link of tabLinks) {
      const item = byId.get(link.pipeline_page_id)
      if (!item) {
        summary.missingLinkedRecords++
        summary.tabs[tab].missing++
        continue
      }

      const rowIdx = link.row_number - 2
      const currentRow = rows[rowIdx] || []
      const patched = patchOutboundValues(headers, currentRow, item)
      if (patched.length < 15) patched.length = 15
      patched[14] = `=TODAY()-I${link.row_number}`

      const outboundFingerprint = {
        stage: item.Stage || null,
        followUp: item['Follow-Up Date'] || null,
        notes: item.Notes || null,
        researchNotes: item['Research Notes'] || null,
        dateApplied: item['Date Applied'] || null,
        outcome: item.Outcome || null,
        resumeUrl: item['Resume URL'] || null,
        coverLetter: item['Cover Letter'] || null
      }
      const outboundHash = hashObject(outboundFingerprint)

      const currentRowObj = toRowObject(headers, currentRow)
      const currentInboundPayload = pickInboundFields(tab, currentRowObj)
      const currentInboundHash = currentInboundPayload
        ? hashObject({ payload: currentInboundPayload, tab, rowNumber: link.row_number })
        : null
      if (hasSyncConflict({
        lastInboundHash: link.last_inbound_hash,
        currentInboundHash,
        lastOutboundHash: link.last_outbound_hash,
        nextOutboundHash: outboundHash
      })) {
        summary.conflicts++
        summary.tabs[tab].conflicts++
        continue
      }

      if (link.last_outbound_hash === outboundHash) {
        summary.skippedUnchanged++
        summary.tabs[tab].skipped++
        continue
      }

      const width = Math.max(headers.length, patched.length, 1)
      const range = `${tab}!A${link.row_number}:${colToA1(width)}${link.row_number}`

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [patched] }
      })

      await updateSheetSyncOutboundHash(link.id, outboundHash)
      summary.updatedRows++
      summary.tabs[tab].updated++
    }

    // Append local pipeline entries that do not yet have a sheet link.
    if (tab === tabs[0]) {
      const unlinked = pipeline.filter(item => !linkedIds.has(String(item.id)))
      for (const item of unlinked) {
        const base = new Array(Math.max(headers.length, 15)).fill('')
        const patched = patchOutboundValues(headers, base, item)
        if (patched.length < 15) patched.length = 15
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tab}!A:ZZ`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [patched] }
        })
        const updatedRange = appendRes?.data?.updates?.updatedRange || ''
        const rowNumber = parseRowNumberFromRange(updatedRange)
        if (rowNumber) {
          const rowObj = toRowObject(headers, patched)
          const inboundPayload = pickInboundFields(tab, rowObj)
          const inboundHash = inboundPayload ? hashObject({ payload: inboundPayload, tab, rowNumber }) : null
          const outboundHash = hashObject({
            stage: item.Stage || null,
            followUp: item['Follow-Up Date'] || null,
            notes: item.Notes || null,
            researchNotes: item['Research Notes'] || null,
            dateApplied: item['Date Applied'] || null,
            outcome: item.Outcome || null,
            resumeUrl: item['Resume URL'] || null,
            coverLetter: item['Cover Letter'] || null
          })
          await upsertSheetSyncLink({
            sheetId: spreadsheetId,
            tabName: tab,
            rowNumber,
            pipelinePageId: item.id,
            lastInboundHash: inboundHash,
            lastOutboundHash: outboundHash
          })
          linkedIds.add(String(item.id))
          summary.appendedRows++
          summary.tabs[tab].appended++
        }
      }
    }
  }

  return summary
}

function rowUpdateRange(tabName, rowNumber, headers, patched) {
  const width = Math.max(headers.length, patched.length, 1)
  return `${tabName}!A${rowNumber}:${colToA1(width)}${rowNumber}`
}

async function runContactsSync({ sheets, spreadsheetId, tabs, scope }) {
  if (!tabs.length) return { inbound: null, outbound: null }

  const contacts = await getContacts(scope)
  const index = buildContactsIndex(contacts)
  const links = await getEntitySheetSyncLinks(spreadsheetId, 'contacts')
  const linkByTabRow = new Map(links.map(l => [`${l.tab_name}::${l.row_number}`, l]))

  const inbound = { imported: 0, linkedExisting: 0, skippedUnchanged: 0, skippedIncomplete: 0, tabs: {} }
  for (const tab of tabs) {
    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    inbound.tabs[tab] = { scanned: rows.length, imported: 0, linked: 0, skipped: 0 }

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const rowObj = toRowObject(headers, rows[i])
      const payload = pickInboundContactFields(rowObj)
      if (!payload) {
        inbound.skippedIncomplete++; inbound.tabs[tab].skipped++; continue
      }

      const inboundHash = hashObject({ payload, tab, rowNumber, entity: 'contacts' })
      const existingLink = linkByTabRow.get(`${tab}::${rowNumber}`) || await getEntitySheetSyncLink(spreadsheetId, tab, rowNumber, 'contacts')
      if (existingLink?.last_inbound_hash === inboundHash) {
        inbound.skippedUnchanged++; inbound.tabs[tab].skipped++; continue
      }
      if (existingLink) {
        await updateEntitySheetSyncInboundHash(existingLink.id, inboundHash)
        inbound.linkedExisting++; inbound.tabs[tab].linked++; continue
      }

      const byLinkedIn = payload['LinkedIn URL'] ? index.byLinkedIn.get(normalizeUrl(payload['LinkedIn URL'])) : null
      const byNameCompany = index.byNameCompany.get(`${normalizeText(payload.Name)}::${normalizeText(payload.Company)}`)
      const matched = byLinkedIn || byNameCompany || null

      let entityId
      if (matched) {
        entityId = matched.id
      } else {
        const created = await createContact(payload, scope)
        entityId = created.id
        inbound.imported++; inbound.tabs[tab].imported++
      }

      await upsertEntitySheetSyncLink({
        sheetId: spreadsheetId,
        tabName: tab,
        rowNumber,
        entityType: 'contacts',
        entityId,
        lastInboundHash: inboundHash
      })
    }
  }

  const latestContacts = await getContacts(scope)
  const byId = new Map(latestContacts.map(item => [item.id, item]))
  const latestLinks = await getEntitySheetSyncLinks(spreadsheetId, 'contacts')
  const outbound = { updatedRows: 0, skippedUnchanged: 0, conflicts: 0, missingLinkedRecords: 0, tabs: {} }

  for (const tab of tabs) {
    const tabLinks = latestLinks.filter(link => link.tab_name === tab)
    outbound.tabs[tab] = { updated: 0, skipped: 0, conflicts: 0, missing: 0 }
    if (!tabLinks.length) continue

    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    for (const link of tabLinks) {
      const item = byId.get(link.entity_id)
      if (!item) {
        outbound.missingLinkedRecords++; outbound.tabs[tab].missing++; continue
      }

      const rowIdx = link.row_number - 2
      const currentRow = rows[rowIdx] || []
      const patched = patchOutboundContactValues(headers, currentRow, item)
      const outboundHash = hashObject({
        name: item.Name || null,
        company: item.Company || null,
        status: item.Status || null,
        warmth: item.Warmth || null,
        nextFollowUp: item['Next Follow-Up'] || null,
        notes: item.Notes || null
      })

      const currentRowObj = toRowObject(headers, currentRow)
      const currentInboundPayload = pickInboundContactFields(currentRowObj)
      const currentInboundHash = currentInboundPayload
        ? hashObject({ payload: currentInboundPayload, tab, rowNumber: link.row_number, entity: 'contacts' })
        : null
      if (hasSyncConflict({
        lastInboundHash: link.last_inbound_hash,
        currentInboundHash,
        lastOutboundHash: link.last_outbound_hash,
        nextOutboundHash: outboundHash
      })) {
        outbound.conflicts++
        outbound.tabs[tab].conflicts++
        continue
      }
      if (link.last_outbound_hash === outboundHash) {
        outbound.skippedUnchanged++; outbound.tabs[tab].skipped++; continue
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: rowUpdateRange(tab, link.row_number, headers, patched),
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [patched] }
      })
      await updateEntitySheetSyncOutboundHash(link.id, outboundHash)
      outbound.updatedRows++; outbound.tabs[tab].updated++
    }
  }

  return { inbound, outbound }
}

async function runInterviewsSync({ sheets, spreadsheetId, tabs, scope }) {
  if (!tabs.length) return { inbound: null, outbound: null }

  const interviews = await getInterviews(scope)
  const index = buildInterviewsIndex(interviews)
  const links = await getEntitySheetSyncLinks(spreadsheetId, 'interviews')
  const linkByTabRow = new Map(links.map(l => [`${l.tab_name}::${l.row_number}`, l]))

  const inbound = { imported: 0, linkedExisting: 0, skippedUnchanged: 0, skippedIncomplete: 0, tabs: {} }
  for (const tab of tabs) {
    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    inbound.tabs[tab] = { scanned: rows.length, imported: 0, linked: 0, skipped: 0 }

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const rowObj = toRowObject(headers, rows[i])
      const payload = pickInboundInterviewFields(rowObj)
      if (!payload) {
        inbound.skippedIncomplete++; inbound.tabs[tab].skipped++; continue
      }

      const inboundHash = hashObject({ payload, tab, rowNumber, entity: 'interviews' })
      const existingLink = linkByTabRow.get(`${tab}::${rowNumber}`) || await getEntitySheetSyncLink(spreadsheetId, tab, rowNumber, 'interviews')
      if (existingLink?.last_inbound_hash === inboundHash) {
        inbound.skippedUnchanged++; inbound.tabs[tab].skipped++; continue
      }
      if (existingLink) {
        await updateEntitySheetSyncInboundHash(existingLink.id, inboundHash)
        inbound.linkedExisting++; inbound.tabs[tab].linked++; continue
      }

      const key = `${normalizeText(payload.Company)}::${normalizeText(payload['Job Title'])}::${payload.Date || ''}::${normalizeText(payload.Round)}`
      const matched = index.bySignature.get(key) || null

      let entityId
      if (matched) {
        entityId = matched.id
      } else {
        const created = await createInterview(payload, scope)
        entityId = created.id
        inbound.imported++; inbound.tabs[tab].imported++
      }

      await upsertEntitySheetSyncLink({
        sheetId: spreadsheetId,
        tabName: tab,
        rowNumber,
        entityType: 'interviews',
        entityId,
        lastInboundHash: inboundHash
      })
    }
  }

  const latestInterviews = await getInterviews(scope)
  const byId = new Map(latestInterviews.map(item => [item.id, item]))
  const latestLinks = await getEntitySheetSyncLinks(spreadsheetId, 'interviews')
  const outbound = { updatedRows: 0, skippedUnchanged: 0, conflicts: 0, missingLinkedRecords: 0, tabs: {} }

  for (const tab of tabs) {
    const tabLinks = latestLinks.filter(link => link.tab_name === tab)
    outbound.tabs[tab] = { updated: 0, skipped: 0, conflicts: 0, missing: 0 }
    if (!tabLinks.length) continue

    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    for (const link of tabLinks) {
      const item = byId.get(link.entity_id)
      if (!item) {
        outbound.missingLinkedRecords++; outbound.tabs[tab].missing++; continue
      }

      const rowIdx = link.row_number - 2
      const currentRow = rows[rowIdx] || []
      const patched = patchOutboundInterviewValues(headers, currentRow, item)
      const outboundHash = hashObject({
        company: item.Company || null,
        role: item['Job Title'] || null,
        date: item.Date || null,
        round: item.Round || null,
        format: item.Format || null,
        outcome: item.Outcome || null,
        followUpSent: !!item['Follow-Up Sent'],
        notes: item.Notes || null
      })
      const currentRowObj = toRowObject(headers, currentRow)
      const currentInboundPayload = pickInboundInterviewFields(currentRowObj)
      const currentInboundHash = currentInboundPayload
        ? hashObject({ payload: currentInboundPayload, tab, rowNumber: link.row_number, entity: 'interviews' })
        : null
      if (hasSyncConflict({
        lastInboundHash: link.last_inbound_hash,
        currentInboundHash,
        lastOutboundHash: link.last_outbound_hash,
        nextOutboundHash: outboundHash
      })) {
        outbound.conflicts++
        outbound.tabs[tab].conflicts++
        continue
      }
      if (link.last_outbound_hash === outboundHash) {
        outbound.skippedUnchanged++; outbound.tabs[tab].skipped++; continue
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: rowUpdateRange(tab, link.row_number, headers, patched),
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [patched] }
      })
      await updateEntitySheetSyncOutboundHash(link.id, outboundHash)
      outbound.updatedRows++; outbound.tabs[tab].updated++
    }
  }

  return { inbound, outbound }
}

async function runEventsSync({ sheets, spreadsheetId, tabs, scope }) {
  if (!tabs.length) return { inbound: null, outbound: null }

  const events = await getEvents(scope)
  const index = buildEventsIndex(events)
  const links = await getEntitySheetSyncLinks(spreadsheetId, 'events')
  const linkByTabRow = new Map(links.map(l => [`${l.tab_name}::${l.row_number}`, l]))

  const inbound = { imported: 0, linkedExisting: 0, skippedUnchanged: 0, skippedIncomplete: 0, tabs: {} }
  for (const tab of tabs) {
    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    inbound.tabs[tab] = { scanned: rows.length, imported: 0, linked: 0, skipped: 0 }

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const rowObj = toRowObject(headers, rows[i])
      const payload = pickInboundEventFields(rowObj)
      if (!payload) {
        inbound.skippedIncomplete++; inbound.tabs[tab].skipped++; continue
      }

      const inboundHash = hashObject({ payload, tab, rowNumber, entity: 'events' })
      const existingLink = linkByTabRow.get(`${tab}::${rowNumber}`) || await getEntitySheetSyncLink(spreadsheetId, tab, rowNumber, 'events')
      if (existingLink?.last_inbound_hash === inboundHash) {
        inbound.skippedUnchanged++; inbound.tabs[tab].skipped++; continue
      }
      if (existingLink) {
        await updateEntitySheetSyncInboundHash(existingLink.id, inboundHash)
        inbound.linkedExisting++; inbound.tabs[tab].linked++; continue
      }

      const key = `${normalizeText(payload.Name)}::${payload.Date || ''}`
      const matched = index.byNameDate.get(key) || null

      let entityId
      if (matched) {
        entityId = matched.id
      } else {
        const created = await createEvent(payload, scope)
        entityId = created.id
        inbound.imported++; inbound.tabs[tab].imported++
      }

      await upsertEntitySheetSyncLink({
        sheetId: spreadsheetId,
        tabName: tab,
        rowNumber,
        entityType: 'events',
        entityId,
        lastInboundHash: inboundHash
      })
    }
  }

  const latestEvents = await getEvents(scope)
  const byId = new Map(latestEvents.map(item => [item.id, item]))
  const latestLinks = await getEntitySheetSyncLinks(spreadsheetId, 'events')
  const outbound = { updatedRows: 0, skippedUnchanged: 0, conflicts: 0, missingLinkedRecords: 0, tabs: {} }

  for (const tab of tabs) {
    const tabLinks = latestLinks.filter(link => link.tab_name === tab)
    outbound.tabs[tab] = { updated: 0, skipped: 0, conflicts: 0, missing: 0 }
    if (!tabLinks.length) continue

    const { headers, rows } = await readTabRows(sheets, spreadsheetId, tab)
    for (const link of tabLinks) {
      const item = byId.get(link.entity_id)
      if (!item) {
        outbound.missingLinkedRecords++; outbound.tabs[tab].missing++; continue
      }

      const rowIdx = link.row_number - 2
      const currentRow = rows[rowIdx] || []
      const patched = patchOutboundEventValues(headers, currentRow, item)
      const outboundHash = hashObject({
        name: item.Name || null,
        date: item.Date || null,
        status: item.Status || null,
        price: item.Price || null,
        registrationLink: item['Registration Link'] || null,
        notes: item.Notes || null
      })
      const currentRowObj = toRowObject(headers, currentRow)
      const currentInboundPayload = pickInboundEventFields(currentRowObj)
      const currentInboundHash = currentInboundPayload
        ? hashObject({ payload: currentInboundPayload, tab, rowNumber: link.row_number, entity: 'events' })
        : null
      if (hasSyncConflict({
        lastInboundHash: link.last_inbound_hash,
        currentInboundHash,
        lastOutboundHash: link.last_outbound_hash,
        nextOutboundHash: outboundHash
      })) {
        outbound.conflicts++
        outbound.tabs[tab].conflicts++
        continue
      }
      if (link.last_outbound_hash === outboundHash) {
        outbound.skippedUnchanged++; outbound.tabs[tab].skipped++; continue
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: rowUpdateRange(tab, link.row_number, headers, patched),
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [patched] }
      })
      await updateEntitySheetSyncOutboundHash(link.id, outboundHash)
      outbound.updatedRows++; outbound.tabs[tab].updated++
    }
  }

  return { inbound, outbound }
}

function buildSyncContext(configOverrides = {}) {
  const config = resolveSheetsSyncConfig(configOverrides)
  const valid = validateSheetsSyncConfig(config)
  if (!valid.ok) {
    const err = new Error(valid.message)
    err.code = valid.code
    throw withStatus(err, 400)
  }

  const credentials = parseCredentials(config.credentialsRaw)
  return {
    config,
    credentials,
    spreadsheetId: config.sheetId,
    tabs: config.pipelineTabs,
    contactsTabs: config.contactsTabs,
    interviewsTabs: config.interviewsTabs,
    eventsTabs: config.eventsTabs
  }
}

export async function getSheetsSyncStatus(configOverrides = {}) {
  const rawConfig = resolveSheetsSyncConfig(configOverrides)
  try {
    const { config, credentials } = buildSyncContext(configOverrides)
    return {
      ok: true,
      enabled: true,
      sheetId: config.sheetId,
      pipelineTabs: config.pipelineTabs,
      contactsTabs: config.contactsTabs,
      interviewsTabs: config.interviewsTabs,
      eventsTabs: config.eventsTabs,
      serviceAccountEmail: credentialsServiceAccountEmail(credentials),
      credentialConfigured: true
    }
  } catch (error) {
    const normalized = normalizeSheetsSyncError(error)
    return {
      ok: false,
      enabled: rawConfig.enabled,
      sheetId: rawConfig.sheetId,
      pipelineTabs: rawConfig.pipelineTabs,
      contactsTabs: rawConfig.contactsTabs,
      interviewsTabs: rawConfig.interviewsTabs,
      eventsTabs: rawConfig.eventsTabs,
      error: normalized,
      credentialConfigured: normalized.code !== 'MISSING_CREDENTIALS',
      serviceAccountEmail: null
    }
  }
}

export async function testSheetsConnection(configOverrides = {}) {
  const { config, credentials, spreadsheetId } = buildSyncContext(configOverrides)
  const sheets = await getSheetsClient(credentials)
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties.title'
  })

  const availableTabs = (meta.data.sheets || [])
    .map(s => String(s?.properties?.title || '').trim())
    .filter(Boolean)
  const requiredTabs = [
    ...config.pipelineTabs,
    ...config.contactsTabs,
    ...config.interviewsTabs,
    ...config.eventsTabs
  ]
  const missingTabs = requiredTabs.filter(tab => !availableTabs.includes(tab))

  if (missingTabs.length) {
    const err = new Error(`Missing tabs in sheet: ${missingTabs.join(', ')}`)
    err.code = 'TAB_NOT_FOUND'
    throw withStatus(err, 400)
  }

  return {
    ok: true,
    spreadsheetId,
    spreadsheetTitle: meta.data?.properties?.title || '',
    serviceAccountEmail: credentialsServiceAccountEmail(credentials),
    availableTabs,
    requiredTabs
  }
}

export async function runSheetsSync(configOverrides = {}, scope = null) {
  if (!scope?.organizationId || !scope?.userId) {
    throw new Error('Tenant data scope is required for Sheets sync')
  }
  const { credentials, spreadsheetId, tabs, contactsTabs, interviewsTabs, eventsTabs } = buildSyncContext(configOverrides)
  const sheets = await getSheetsClient(credentials)

  try {
    const inbound = await runInboundSync({ sheets, spreadsheetId, tabs, scope })
    await createSheetSyncRun('inbound', 'ok', inbound)

    const outbound = await runOutboundSync({ sheets, spreadsheetId, tabs, scope })
    await createSheetSyncRun('outbound', 'ok', outbound)

    const contacts = await runContactsSync({ sheets, spreadsheetId, tabs: contactsTabs, scope })
    await createSheetSyncRun('contacts', 'ok', contacts)

    const interviews = await runInterviewsSync({ sheets, spreadsheetId, tabs: interviewsTabs, scope })
    await createSheetSyncRun('interviews', 'ok', interviews)

    const events = await runEventsSync({ sheets, spreadsheetId, tabs: eventsTabs, scope })
    await createSheetSyncRun('events', 'ok', events)

    return { ok: true, pipeline: { inbound, outbound }, contacts, interviews, events }
  } catch (error) {
    const normalized = normalizeSheetsSyncError(error)
    await createSheetSyncRun('combined', 'error', { code: normalized.code, retryable: normalized.retryable }, normalized.details)
    const e = new Error(normalized.userMessage)
    e.normalized = normalized
    e.status = normalized.status
    throw e
  }
}
