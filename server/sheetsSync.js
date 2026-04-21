import crypto from 'crypto'
import { google } from 'googleapis'

import {
  getSheetSyncLink,
  getSheetSyncLinks,
  updateSheetSyncInboundHash,
  updateSheetSyncOutboundHash,
  upsertSheetSyncLink,
  createSheetSyncRun
} from './db.js'

import {
  getPipeline,
  createPipelineEntry
} from './notion.js'

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

export async function runSheetsSync() {
  const spreadsheetId = getSheetId()
  const tabs = getSyncTabs()
  const sheets = await getSheetsClient()

  try {
    const inbound = await runInboundSync({ sheets, spreadsheetId, tabs })
    await createSheetSyncRun('inbound', 'ok', inbound)

    const outbound = await runOutboundSync({ sheets, spreadsheetId, tabs })
    await createSheetSyncRun('outbound', 'ok', outbound)

    return { ok: true, inbound, outbound }
  } catch (error) {
    await createSheetSyncRun('combined', 'error', null, error.message)
    throw error
  }
}
