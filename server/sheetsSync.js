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

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function getSheetId() {
  return requiredEnv('GOOGLE_SHEETS_ID')
}

function getSyncTabs() {
  const raw = process.env.GOOGLE_SHEETS_SYNC_TABS || 'Jobs & Applications,Found'
  return raw.split(',').map(t => t.trim()).filter(Boolean)
}

function parseTabs(raw, fallback = '') {
  const source = raw || fallback
  return source.split(',').map(t => t.trim()).filter(Boolean)
}

function getContactsSyncTabs() {
  return parseTabs(process.env.GOOGLE_SHEETS_CONTACTS_SYNC_TABS, 'Networking Tracker')
}

function getInterviewsSyncTabs() {
  return parseTabs(process.env.GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS, 'Interview Tracker')
}

function getEventsSyncTabs() {
  return parseTabs(process.env.GOOGLE_SHEETS_EVENTS_SYNC_TABS, 'Events')
}

function parseCredentials() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS_JSON
  if (!raw) {
    throw new Error('Missing GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_CREDENTIALS_JSON')
  }

  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    } catch {
      throw new Error('Google credentials JSON is invalid (plain or base64)')
    }
  }
}

async function getSheetsClient() {
  const credentials = parseCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  return google.sheets({ version: 'v4', auth })
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
    'Follow-Up Date': followUpDate || null
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

  return out
}

async function readTabRows(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:ZZ`
  })

  const values = res.data.values || []
  if (values.length === 0) return { headers: [], rows: [] }

  const headers = values[0].map(v => (v || '').toString().trim())
  const rows = values.slice(1)
  return { headers, rows }
}

async function runInboundSync({ sheets, spreadsheetId, tabs }) {
  const pipeline = await getPipeline()
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
        const created = await createPipelineEntry(payload)
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

async function runOutboundSync({ sheets, spreadsheetId, tabs }) {
  const links = await getSheetSyncLinks(spreadsheetId)
  const pipeline = await getPipeline()
  const byId = new Map(pipeline.map(item => [item.id, item]))

  const summary = {
    updatedRows: 0,
    skippedUnchanged: 0,
    missingLinkedRecords: 0,
    tabs: {}
  }

  for (const tab of tabs) {
    const tabLinks = links.filter(link => link.tab_name === tab)
    if (!summary.tabs[tab]) summary.tabs[tab] = { updated: 0, skipped: 0, missing: 0 }
    if (!tabLinks.length) continue

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

      const outboundFingerprint = {
        stage: item.Stage || null,
        followUp: item['Follow-Up Date'] || null,
        notes: item.Notes || null,
        researchNotes: item['Research Notes'] || null,
        dateApplied: item['Date Applied'] || null,
        outcome: item.Outcome || null
      }
      const outboundHash = hashObject(outboundFingerprint)

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
  }

  return summary
}

function rowUpdateRange(tabName, rowNumber, headers, patched) {
  const width = Math.max(headers.length, patched.length, 1)
  return `${tabName}!A${rowNumber}:${colToA1(width)}${rowNumber}`
}

async function runContactsSync({ sheets, spreadsheetId, tabs }) {
  if (!tabs.length) return { inbound: null, outbound: null }

  const contacts = await getContacts()
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
        const created = await createContact(payload)
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

  const latestContacts = await getContacts()
  const byId = new Map(latestContacts.map(item => [item.id, item]))
  const latestLinks = await getEntitySheetSyncLinks(spreadsheetId, 'contacts')
  const outbound = { updatedRows: 0, skippedUnchanged: 0, missingLinkedRecords: 0, tabs: {} }

  for (const tab of tabs) {
    const tabLinks = latestLinks.filter(link => link.tab_name === tab)
    outbound.tabs[tab] = { updated: 0, skipped: 0, missing: 0 }
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

async function runInterviewsSync({ sheets, spreadsheetId, tabs }) {
  if (!tabs.length) return { inbound: null, outbound: null }

  const interviews = await getInterviews()
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
        const created = await createInterview(payload)
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

  const latestInterviews = await getInterviews()
  const byId = new Map(latestInterviews.map(item => [item.id, item]))
  const latestLinks = await getEntitySheetSyncLinks(spreadsheetId, 'interviews')
  const outbound = { updatedRows: 0, skippedUnchanged: 0, missingLinkedRecords: 0, tabs: {} }

  for (const tab of tabs) {
    const tabLinks = latestLinks.filter(link => link.tab_name === tab)
    outbound.tabs[tab] = { updated: 0, skipped: 0, missing: 0 }
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

async function runEventsSync({ sheets, spreadsheetId, tabs }) {
  if (!tabs.length) return { inbound: null, outbound: null }

  const events = await getEvents()
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
        const created = await createEvent(payload)
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

  const latestEvents = await getEvents()
  const byId = new Map(latestEvents.map(item => [item.id, item]))
  const latestLinks = await getEntitySheetSyncLinks(spreadsheetId, 'events')
  const outbound = { updatedRows: 0, skippedUnchanged: 0, missingLinkedRecords: 0, tabs: {} }

  for (const tab of tabs) {
    const tabLinks = latestLinks.filter(link => link.tab_name === tab)
    outbound.tabs[tab] = { updated: 0, skipped: 0, missing: 0 }
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

export async function runSheetsSync() {
  const spreadsheetId = getSheetId()
  const tabs = getSyncTabs()
  const contactsTabs = getContactsSyncTabs()
  const interviewsTabs = getInterviewsSyncTabs()
  const eventsTabs = getEventsSyncTabs()
  const sheets = await getSheetsClient()

  try {
    const inbound = await runInboundSync({ sheets, spreadsheetId, tabs })
    await createSheetSyncRun('inbound', 'ok', inbound)

    const outbound = await runOutboundSync({ sheets, spreadsheetId, tabs })
    await createSheetSyncRun('outbound', 'ok', outbound)

    const contacts = await runContactsSync({ sheets, spreadsheetId, tabs: contactsTabs })
    await createSheetSyncRun('contacts', 'ok', contacts)

    const interviews = await runInterviewsSync({ sheets, spreadsheetId, tabs: interviewsTabs })
    await createSheetSyncRun('interviews', 'ok', interviews)

    const events = await runEventsSync({ sheets, spreadsheetId, tabs: eventsTabs })
    await createSheetSyncRun('events', 'ok', events)

    return { ok: true, pipeline: { inbound, outbound }, contacts, interviews, events }
  } catch (error) {
    await createSheetSyncRun('combined', 'error', null, error.message)
    throw error
  }
}
