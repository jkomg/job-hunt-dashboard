import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { existsSync, mkdirSync } from 'fs'

if (!existsSync('./data')) mkdirSync('./data')

const DATABASE_URL = process.env.DATABASE_URL || 'file:./data/app.db'
const DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined

export const db = createClient({
  url: DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN
})

let initialized = false

function now() {
  return Date.now()
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days || 0))
  return d.toISOString().slice(0, 10)
}

const WEEKLY_TARGETS = {
  outreach: 25,
  responses: 5,
  applications: 6
}

const PRIORITY_FRAMEWORK = [
  { id: 'follow_ups_due', label: '1) Follow-Ups Due', route: 'pipeline' },
  { id: 'interview_readiness', label: '2) Interview Readiness', route: 'interviews' },
  { id: 'pipeline_momentum', label: '3) Pipeline Momentum', route: 'pipeline' },
  { id: 'networking_consistency', label: '4) Networking Consistency', route: 'contacts' },
  { id: 'application_throughput', label: '5) Application Throughput', route: 'pipeline' },
  { id: 'events_market_presence', label: '6) Events & Market Presence', route: 'events' }
]

const BACKUP_TABLES = [
  'app_settings',
  'daily_logs',
  'pipeline_entries',
  'contacts',
  'interviews',
  'events',
  'templates',
  'watchlist',
  'sheet_sync_links',
  'entity_sheet_sync_links',
  'sheet_sync_runs'
]

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

async function getUserColumns() {
  const res = await db.execute('PRAGMA table_info(users)')
  return new Set((res.rows || []).map(r => String(r.name || '').toLowerCase()))
}

async function ensureUserSchema() {
  const columns = await getUserColumns()

  if (!columns.has('email')) {
    await db.execute('ALTER TABLE users ADD COLUMN email TEXT')
  }

  if (!columns.has('is_admin')) {
    await db.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
  }

  if (!columns.has('must_change_password')) {
    await db.execute('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0')
  }

  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email) WHERE email IS NOT NULL')
}

async function ensureInterviewSchema() {
  const res = await db.execute('PRAGMA table_info(interviews)')
  const columns = new Set((res.rows || []).map(r => String(r.name || '').toLowerCase()))
  if (!columns.has('pipeline_entry_id')) {
    await db.execute('ALTER TABLE interviews ADD COLUMN pipeline_entry_id TEXT')
  }
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS interviews_pipeline_entry_unique_idx ON interviews(pipeline_entry_id) WHERE pipeline_entry_id IS NOT NULL')
}

async function ensureEventSchema() {
  const res = await db.execute('PRAGMA table_info(events)')
  const columns = new Set((res.rows || []).map(r => String(r.name || '').toLowerCase()))
  if (!columns.has('source_key')) {
    await db.execute('ALTER TABLE events ADD COLUMN source_key TEXT')
  }
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS events_source_key_unique_idx ON events(source_key) WHERE source_key IS NOT NULL')
}

async function ensureActionSchema() {
  const tableColumns = async (table) => {
    const res = await db.execute(`PRAGMA table_info(${table})`)
    return new Set((res.rows || []).map(r => String(r.name || '').toLowerCase()))
  }

  const pipelineCols = await tableColumns('pipeline_entries')
  if (!pipelineCols.has('next_action')) {
    await db.execute('ALTER TABLE pipeline_entries ADD COLUMN next_action TEXT')
  }
  if (!pipelineCols.has('next_action_date')) {
    await db.execute('ALTER TABLE pipeline_entries ADD COLUMN next_action_date TEXT')
  }

  const contactCols = await tableColumns('contacts')
  if (!contactCols.has('next_action')) {
    await db.execute('ALTER TABLE contacts ADD COLUMN next_action TEXT')
  }
  if (!contactCols.has('next_action_date')) {
    await db.execute('ALTER TABLE contacts ADD COLUMN next_action_date TEXT')
  }

  const interviewCols = await tableColumns('interviews')
  if (!interviewCols.has('next_action')) {
    await db.execute('ALTER TABLE interviews ADD COLUMN next_action TEXT')
  }
  if (!interviewCols.has('next_action_date')) {
    await db.execute('ALTER TABLE interviews ADD COLUMN next_action_date TEXT')
  }
}

function toUser(row) {
  if (!row) return null
  return {
    ...row,
    email: row.email || null,
    is_admin: Number(row.is_admin || 0),
    isAdmin: Number(row.is_admin || 0) === 1,
    must_change_password: Number(row.must_change_password || 0),
    mustChangePassword: Number(row.must_change_password || 0) === 1
  }
}

export async function initDb() {
  if (initialized) return

  await db.batch([
    `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS sheet_sync_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sheet_id TEXT NOT NULL,
        tab_name TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        pipeline_page_id TEXT NOT NULL,
        last_inbound_hash TEXT,
        last_outbound_hash TEXT,
        last_synced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(sheet_id, tab_name, row_number),
        UNIQUE(pipeline_page_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS sheet_sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL,
        status TEXT NOT NULL,
        summary_json TEXT,
        error_text TEXT,
        created_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS entity_sheet_sync_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sheet_id TEXT NOT NULL,
        tab_name TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        last_inbound_hash TEXT,
        last_outbound_hash TEXT,
        last_synced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(sheet_id, tab_name, row_number, entity_type),
        UNIQUE(entity_type, entity_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS daily_logs (
        id TEXT PRIMARY KEY,
        date_label TEXT NOT NULL,
        mindset INTEGER,
        energy INTEGER,
        outreach_sent INTEGER,
        responses_received INTEGER,
        applications_submitted INTEGER,
        conversations_calls INTEGER,
        linkedin_posts INTEGER NOT NULL DEFAULT 0,
        volunteer_activity INTEGER NOT NULL DEFAULT 0,
        exercise TEXT,
        cert_progress TEXT,
        win_of_day TEXT,
        gratitude_reflection TEXT,
        tomorrow_top3 TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS pipeline_entries (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        role TEXT,
        stage TEXT NOT NULL,
        priority TEXT,
        sector TEXT,
        job_source TEXT,
        job_url TEXT,
        salary_range TEXT,
        date_applied TEXT,
        follow_up_date TEXT,
        contact_name TEXT,
        contact_title TEXT,
        outreach_method TEXT,
        resume_version TEXT,
        company_address TEXT,
        company_phone TEXT,
        notes TEXT,
        research_notes TEXT,
        filed_for_unemployment INTEGER NOT NULL DEFAULT 0,
        outcome TEXT,
        resume_url TEXT,
        work_location TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        company TEXT,
        email TEXT,
        phone TEXT,
        warmth TEXT,
        status TEXT,
        how_we_know_each_other TEXT,
        linkedin_url TEXT,
        next_follow_up TEXT,
        last_contact TEXT,
        resume_used TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        job_title TEXT,
        date TEXT,
        round TEXT,
        format TEXT,
        outcome TEXT,
        interviewer TEXT,
        questions_asked TEXT,
        feedback_received TEXT,
        follow_up_sent INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT,
        price TEXT,
        status TEXT,
        registration_link TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        body TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        industry TEXT,
        website TEXT,
        connections_there TEXT,
        know_the_founder INTEGER NOT NULL DEFAULT 0,
        open_application INTEGER NOT NULL DEFAULT 0,
        follow_up TEXT,
        status TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `
  ])

  await ensureUserSchema()
  await ensureInterviewSchema()
  await ensureEventSchema()
  await ensureActionSchema()

  const seedUsername = String(process.env.DEFAULT_USERNAME || 'jason').trim().toLowerCase() || 'jason'
  const userCountRes = await db.execute('SELECT COUNT(*) AS count FROM users')
  const userCount = Number(firstRow(userCountRes)?.count || 0)

  if (userCount === 0) {
    const hash = bcrypt.hashSync('jobhunt2026', 10)
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES (?, ?, ?, ?)',
      args: [seedUsername, hash, 1, 0]
    })
    console.log(`Default user created: ${seedUsername} / jobhunt2026`)
  }

  initialized = true
}

function firstRow(res) {
  return res.rows?.[0] || null
}

function toPlainRows(res) {
  return (res.rows || []).map(r => ({ ...r }))
}

function isoFromTs(ts) {
  if (!ts) return null
  return new Date(Number(ts)).toISOString()
}

function dailyRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Date: row.date_label || '',
    'Mindset (1-10)': row.mindset == null ? null : Number(row.mindset),
    'Energy (1-10)': row.energy == null ? null : Number(row.energy),
    'Outreach Sent': row.outreach_sent == null ? null : Number(row.outreach_sent),
    'Responses Received': row.responses_received == null ? null : Number(row.responses_received),
    'Applications Submitted': row.applications_submitted == null ? null : Number(row.applications_submitted),
    'Conversations / Calls': row.conversations_calls == null ? null : Number(row.conversations_calls),
    'LinkedIn Posts': Number(row.linkedin_posts || 0) === 1,
    'Volunteer Activity': Number(row.volunteer_activity || 0) === 1,
    Exercise: row.exercise || '',
    'Cert Progress': row.cert_progress || '',
    'Win of the Day': row.win_of_day || '',
    'Gratitude / Reflection': row.gratitude_reflection || '',
    "Tomorrow's Top 3": row.tomorrow_top3 || '',
    _createdTime: isoFromTs(row.created_at),
    _lastEditedTime: isoFromTs(row.updated_at)
  }
}

function pipelineRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Company: row.company || '',
    Role: row.role || '',
    Stage: row.stage || '',
    Priority: row.priority || '',
    Sector: row.sector || '',
    'Job Source': row.job_source || '',
    'Job URL': row.job_url || '',
    'Salary Range': row.salary_range || '',
    'Date Applied': row.date_applied || '',
    'Follow-Up Date': row.follow_up_date || '',
    'Contact Name': row.contact_name || '',
    'Contact Title': row.contact_title || '',
    'Outreach Method': row.outreach_method || '',
    'Resume Version': row.resume_version || '',
    'Company Address': row.company_address || '',
    'Company Phone': row.company_phone || '',
    Notes: row.notes || '',
    'Research Notes': row.research_notes || '',
    'Filed for Unemployment': Number(row.filed_for_unemployment || 0) === 1,
    Outcome: row.outcome || '',
    'Resume URL': row.resume_url || '',
    'Work Location': row.work_location || '',
    'Next Action': row.next_action || '',
    'Next Action Date': row.next_action_date || ''
  }
}

function contactRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Name: row.name || '',
    Title: row.title || '',
    Company: row.company || '',
    Email: row.email || '',
    Phone: row.phone || '',
    Warmth: row.warmth || '',
    Status: row.status || '',
    'How We Know Each Other': row.how_we_know_each_other || '',
    'LinkedIn URL': row.linkedin_url || '',
    'Next Follow-Up': row.next_follow_up || '',
    'Last Contact': row.last_contact || '',
    'Resume Used': row.resume_used || '',
    Notes: row.notes || '',
    'Next Action': row.next_action || '',
    'Next Action Date': row.next_action_date || ''
  }
}

function interviewRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Company: row.company || '',
    'Job Title': row.job_title || '',
    Date: row.date || '',
    Round: row.round || '',
    Format: row.format || '',
    Outcome: row.outcome || '',
    Interviewer: row.interviewer || '',
    'Questions Asked': row.questions_asked || '',
    'Feedback Received': row.feedback_received || '',
    'Follow-Up Sent': Number(row.follow_up_sent || 0) === 1,
    Notes: row.notes || '',
    'Next Action': row.next_action || '',
    'Next Action Date': row.next_action_date || ''
  }
}

function eventRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Name: row.name || '',
    Date: row.date || '',
    Price: row.price || '',
    Status: row.status || '',
    'Registration Link': row.registration_link || '',
    Notes: row.notes || '',
    'Source Key': row.source_key || ''
  }
}

function templateRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Name: row.name || '',
    Category: row.category || '',
    Body: row.body || '',
    Notes: row.notes || ''
  }
}

function watchlistRowToRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    Company: row.company || '',
    Industry: row.industry || '',
    Website: row.website || '',
    'Connections There': row.connections_there || '',
    'Know the Founder': Number(row.know_the_founder || 0) === 1,
    'Open Application': Number(row.open_application || 0) === 1,
    'Follow Up': row.follow_up || '',
    Status: row.status || '',
    Notes: row.notes || ''
  }
}

export async function getUserByUsername(username) {
  const res = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username]
  })
  return toUser(firstRow(res))
}

export async function getUserByEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const res = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [normalized]
  })
  return toUser(firstRow(res))
}

export async function getUserById(id) {
  const res = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id]
  })
  return toUser(firstRow(res))
}

export async function ensureUserByEmail(email, { isAdmin = false } = {}) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const existing = await getUserByEmail(normalized)
  if (existing) {
    if (isAdmin && !existing.isAdmin) {
      await db.execute({
        sql: 'UPDATE users SET is_admin = 1 WHERE id = ?',
        args: [existing.id]
      })
      return { ...existing, is_admin: 1, isAdmin: true }
    }
    return existing
  }

  const generatedUsername = normalized
  const generatedPasswordHash = bcrypt.hashSync(`iap:${normalized}:${now()}`, 10)

  await db.execute({
    sql: 'INSERT INTO users (username, password_hash, email, is_admin, must_change_password) VALUES (?, ?, ?, ?, ?)',
    args: [generatedUsername, generatedPasswordHash, normalized, isAdmin ? 1 : 0, 0]
  })

  return getUserByEmail(normalized)
}

export async function upsertLocalAdminUser(username, password, { mustChangePassword = true } = {}) {
  const normalizedUsername = String(username || '').trim().toLowerCase()
  const rawPassword = String(password || '')
  if (!normalizedUsername || !rawPassword) {
    throw new Error('username and password are required')
  }

  const hash = bcrypt.hashSync(rawPassword, 10)
  await db.execute({
    sql: `
      INSERT INTO users (username, password_hash, is_admin, must_change_password)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        is_admin = 1,
        must_change_password = excluded.must_change_password
    `,
    args: [normalizedUsername, hash, mustChangePassword ? 1 : 0]
  })

  return getUserByUsername(normalizedUsername)
}

export async function createSession(token, userId) {
  await db.execute({
    sql: 'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)',
    args: [token, userId, now()]
  })
}

export async function getSession(token) {
  const res = await db.execute({
    sql: 'SELECT * FROM sessions WHERE token = ?',
    args: [token]
  })
  return firstRow(res)
}

export async function deleteSession(token) {
  await db.execute({
    sql: 'DELETE FROM sessions WHERE token = ?',
    args: [token]
  })
}

export async function updatePassword(userId, newHash, { clearMustChangePassword = true } = {}) {
  await db.execute({
    sql: clearMustChangePassword
      ? 'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?'
      : 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [newHash, userId]
  })
}

export async function getSheetSyncLink(sheetId, tabName, rowNumber) {
  const res = await db.execute({
    sql: `
      SELECT * FROM sheet_sync_links
      WHERE sheet_id = ? AND tab_name = ? AND row_number = ?
    `,
    args: [sheetId, tabName, rowNumber]
  })
  return firstRow(res)
}

export async function upsertSheetSyncLink({
  sheetId, tabName, rowNumber, pipelinePageId, lastInboundHash = null, lastOutboundHash = null
}) {
  const ts = now()
  await db.execute({
    sql: `
      INSERT INTO sheet_sync_links (
        sheet_id, tab_name, row_number, pipeline_page_id, last_inbound_hash, last_outbound_hash, last_synced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sheet_id, tab_name, row_number) DO UPDATE SET
        pipeline_page_id = excluded.pipeline_page_id,
        last_inbound_hash = excluded.last_inbound_hash,
        last_outbound_hash = excluded.last_outbound_hash,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at
    `,
    args: [sheetId, tabName, rowNumber, pipelinePageId, lastInboundHash, lastOutboundHash, ts, ts, ts]
  })
}

export async function getSheetSyncLinks(sheetId) {
  const res = await db.execute({
    sql: `
      SELECT * FROM sheet_sync_links
      WHERE sheet_id = ?
      ORDER BY tab_name ASC, row_number ASC
    `,
    args: [sheetId]
  })
  return toPlainRows(res)
}

export async function updateSheetSyncInboundHash(id, hash) {
  const ts = now()
  await db.execute({
    sql: `
      UPDATE sheet_sync_links
      SET last_inbound_hash = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [hash, ts, ts, id]
  })
}

export async function updateSheetSyncOutboundHash(id, hash) {
  const ts = now()
  await db.execute({
    sql: `
      UPDATE sheet_sync_links
      SET last_outbound_hash = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [hash, ts, ts, id]
  })
}

export async function getEntitySheetSyncLink(sheetId, tabName, rowNumber, entityType) {
  const res = await db.execute({
    sql: `
      SELECT * FROM entity_sheet_sync_links
      WHERE sheet_id = ? AND tab_name = ? AND row_number = ? AND entity_type = ?
    `,
    args: [sheetId, tabName, rowNumber, entityType]
  })
  return firstRow(res)
}

export async function upsertEntitySheetSyncLink({
  sheetId,
  tabName,
  rowNumber,
  entityType,
  entityId,
  lastInboundHash = null,
  lastOutboundHash = null
}) {
  const ts = now()
  await db.execute({
    sql: `
      INSERT INTO entity_sheet_sync_links (
        sheet_id, tab_name, row_number, entity_type, entity_id, last_inbound_hash, last_outbound_hash, last_synced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sheet_id, tab_name, row_number, entity_type) DO UPDATE SET
        entity_id = excluded.entity_id,
        last_inbound_hash = excluded.last_inbound_hash,
        last_outbound_hash = excluded.last_outbound_hash,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at
    `,
    args: [sheetId, tabName, rowNumber, entityType, entityId, lastInboundHash, lastOutboundHash, ts, ts, ts]
  })
}

export async function getEntitySheetSyncLinks(sheetId, entityType) {
  const res = await db.execute({
    sql: `
      SELECT * FROM entity_sheet_sync_links
      WHERE sheet_id = ? AND entity_type = ?
      ORDER BY tab_name ASC, row_number ASC
    `,
    args: [sheetId, entityType]
  })
  return toPlainRows(res)
}

export async function updateEntitySheetSyncInboundHash(id, hash) {
  const ts = now()
  await db.execute({
    sql: `
      UPDATE entity_sheet_sync_links
      SET last_inbound_hash = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [hash, ts, ts, id]
  })
}

export async function updateEntitySheetSyncOutboundHash(id, hash) {
  const ts = now()
  await db.execute({
    sql: `
      UPDATE entity_sheet_sync_links
      SET last_outbound_hash = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [hash, ts, ts, id]
  })
}

export async function createSheetSyncRun(direction, status, summary = null, errorText = null) {
  await db.execute({
    sql: `
      INSERT INTO sheet_sync_runs (direction, status, summary_json, error_text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [direction, status, summary ? JSON.stringify(summary) : null, errorText || null, now()]
  })
}

export async function getRecentSheetSyncRuns(limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const res = await db.execute({
    sql: `
      SELECT * FROM sheet_sync_runs
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [safeLimit]
  })

  return toPlainRows(res)
}

export async function getAppSetting(key) {
  const settingKey = String(key || '').trim()
  if (!settingKey) return null

  const res = await db.execute({
    sql: `
      SELECT value FROM app_settings
      WHERE key = ?
      LIMIT 1
    `,
    args: [settingKey]
  })

  const row = firstRow(res)
  return row?.value == null ? null : String(row.value)
}

export async function getAppSettings(keys = []) {
  const cleanKeys = [...new Set((keys || []).map(k => String(k || '').trim()).filter(Boolean))]
  if (!cleanKeys.length) return {}

  const placeholders = cleanKeys.map(() => '?').join(', ')
  const res = await db.execute({
    sql: `
      SELECT key, value FROM app_settings
      WHERE key IN (${placeholders})
    `,
    args: cleanKeys
  })

  const out = {}
  for (const row of res.rows || []) {
    out[String(row.key)] = row.value == null ? null : String(row.value)
  }
  return out
}

export async function setAppSetting(key, value) {
  const settingKey = String(key || '').trim()
  if (!settingKey) {
    throw new Error('app setting key is required')
  }

  await db.execute({
    sql: `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    args: [settingKey, value == null ? null : String(value), now()]
  })
}

async function getTableColumns(tableName) {
  const res = await db.execute(`PRAGMA table_info(${tableName})`)
  return (res.rows || []).map(r => String(r.name))
}

export async function exportBackupSnapshot() {
  const tables = {}
  for (const tableName of BACKUP_TABLES) {
    const res = await db.execute(`SELECT * FROM ${tableName}`)
    tables[tableName] = toPlainRows(res)
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    databaseUrl: DATABASE_URL,
    tables
  }
}

export async function restoreBackupSnapshot(snapshot) {
  const payload = snapshot && typeof snapshot === 'object' ? snapshot : null
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup payload')
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    throw new Error('Backup payload is missing tables')
  }

  for (const tableName of BACKUP_TABLES) {
    await db.execute(`DELETE FROM ${tableName}`)
  }

  for (const tableName of BACKUP_TABLES) {
    const rows = Array.isArray(payload.tables[tableName]) ? payload.tables[tableName] : []
    if (!rows.length) continue

    const columns = await getTableColumns(tableName)
    for (const rawRow of rows) {
      const row = rawRow && typeof rawRow === 'object' ? rawRow : {}
      const keys = columns.filter(c => Object.prototype.hasOwnProperty.call(row, c))
      if (!keys.length) continue
      const placeholders = keys.map(() => '?').join(', ')
      const args = keys.map(k => row[k])
      await db.execute({
        sql: `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
        args
      })
    }
  }
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

export async function getDailyLogs(limit = 30) {
  const safeLimit = Math.max(1, Math.min(365, Number(limit) || 30))
  const res = await db.execute({
    sql: `
      SELECT * FROM daily_logs
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [safeLimit]
  })
  return toPlainRows(res).map(dailyRowToRecord)
}

export async function getTodayLog(dateLabel = todayLabel()) {
  const targetDateLabel = String(dateLabel || '').trim() || todayLabel()
  const res = await db.execute({
    sql: `
      SELECT * FROM daily_logs
      WHERE date_label = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    args: [targetDateLabel]
  })
  return dailyRowToRecord(firstRow(res))
}

export async function getRecentLogs(n = 8) {
  const safeLimit = Math.max(1, Math.min(100, Number(n) || 8))
  const res = await db.execute({
    sql: `
      SELECT * FROM daily_logs
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [safeLimit]
  })
  return toPlainRows(res).map(dailyRowToRecord)
}

export async function createDailyLog(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())

  await db.execute({
    sql: `
      INSERT INTO daily_logs (
        id, date_label, mindset, energy, outreach_sent, responses_received, applications_submitted,
        conversations_calls, linkedin_posts, volunteer_activity, exercise, cert_progress, win_of_day,
        gratitude_reflection, tomorrow_top3, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Date || todayLabel(),
      data['Mindset (1-10)'] == null ? null : Number(data['Mindset (1-10)']),
      data['Energy (1-10)'] == null ? null : Number(data['Energy (1-10)']),
      data['Outreach Sent'] == null ? null : Number(data['Outreach Sent']),
      data['Responses Received'] == null ? null : Number(data['Responses Received']),
      data['Applications Submitted'] == null ? null : Number(data['Applications Submitted']),
      data['Conversations / Calls'] == null ? null : Number(data['Conversations / Calls']),
      data['LinkedIn Posts'] ? 1 : 0,
      data['Volunteer Activity'] ? 1 : 0,
      data.Exercise || null,
      data['Cert Progress'] || null,
      data['Win of the Day'] || null,
      data['Gratitude / Reflection'] || null,
      data["Tomorrow's Top 3"] || null,
      ts,
      ts
    ]
  })

  return { id }
}

export async function updateDailyLog(id, data = {}) {
  const updates = []
  const args = []

  const setIfPresent = (key, value) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`)
      args.push(value)
    }
  }

  setIfPresent('mindset', data['Mindset (1-10)'] == null ? undefined : Number(data['Mindset (1-10)']))
  setIfPresent('energy', data['Energy (1-10)'] == null ? undefined : Number(data['Energy (1-10)']))
  setIfPresent('outreach_sent', data['Outreach Sent'] == null ? undefined : Number(data['Outreach Sent']))
  setIfPresent('responses_received', data['Responses Received'] == null ? undefined : Number(data['Responses Received']))
  setIfPresent('applications_submitted', data['Applications Submitted'] == null ? undefined : Number(data['Applications Submitted']))
  setIfPresent('conversations_calls', data['Conversations / Calls'] == null ? undefined : Number(data['Conversations / Calls']))
  setIfPresent('linkedin_posts', data['LinkedIn Posts'] == null ? undefined : (data['LinkedIn Posts'] ? 1 : 0))
  setIfPresent('volunteer_activity', data['Volunteer Activity'] == null ? undefined : (data['Volunteer Activity'] ? 1 : 0))
  setIfPresent('exercise', data.Exercise == null ? undefined : (data.Exercise || null))
  setIfPresent('cert_progress', data['Cert Progress'] == null ? undefined : (data['Cert Progress'] || null))
  setIfPresent('win_of_day', data['Win of the Day'] == null ? undefined : (data['Win of the Day'] || null))
  setIfPresent('gratitude_reflection', data['Gratitude / Reflection'] == null ? undefined : (data['Gratitude / Reflection'] || null))
  setIfPresent("tomorrow_top3", data["Tomorrow's Top 3"] == null ? undefined : (data["Tomorrow's Top 3"] || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE daily_logs SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function getPipeline() {
  const res = await db.execute({
    sql: `
      SELECT * FROM pipeline_entries
      ORDER BY stage ASC, created_at DESC
    `
  })
  return toPlainRows(res).map(pipelineRowToRecord)
}

export async function getPipelineEntryById(id) {
  const res = await db.execute({
    sql: 'SELECT * FROM pipeline_entries WHERE id = ? LIMIT 1',
    args: [String(id)]
  })
  return pipelineRowToRecord(firstRow(res))
}

export async function createPipelineEntry(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())

  await db.execute({
    sql: `
      INSERT INTO pipeline_entries (
        id, company, role, stage, priority, sector, job_source, job_url, salary_range,
        date_applied, follow_up_date, contact_name, contact_title, outreach_method, resume_version,
        company_address, company_phone, notes, research_notes, filed_for_unemployment, outcome,
        resume_url, work_location, next_action, next_action_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Company || '',
      data.Role || null,
      data.Stage || '🔍 Researching',
      data.Priority || null,
      data.Sector || null,
      data['Job Source'] || null,
      data['Job URL'] || null,
      data['Salary Range'] || null,
      data['Date Applied'] || null,
      data['Follow-Up Date'] || null,
      data['Contact Name'] || null,
      data['Contact Title'] || null,
      data['Outreach Method'] || null,
      data['Resume Version'] || null,
      data['Company Address'] || null,
      data['Company Phone'] || null,
      data.Notes || null,
      data['Research Notes'] || null,
      data['Filed for Unemployment'] ? 1 : 0,
      data.Outcome || null,
      data['Resume URL'] || null,
      data['Work Location'] || null,
      data['Next Action'] || null,
      data['Next Action Date'] || null,
      ts,
      ts
    ]
  })

  return { id }
}

export async function updatePipelineEntry(id, data = {}) {
  const updates = []
  const args = []

  const setIfPresent = (column, value) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`)
      args.push(value)
    }
  }

  setIfPresent('company', data.Company === undefined ? undefined : (data.Company || ''))
  setIfPresent('role', data.Role === undefined ? undefined : (data.Role || null))
  setIfPresent('stage', data.Stage === undefined ? undefined : (data.Stage || '🔍 Researching'))
  setIfPresent('priority', data.Priority === undefined ? undefined : (data.Priority || null))
  setIfPresent('sector', data.Sector === undefined ? undefined : (data.Sector || null))
  setIfPresent('job_source', data['Job Source'] === undefined ? undefined : (data['Job Source'] || null))
  setIfPresent('job_url', data['Job URL'] === undefined ? undefined : (data['Job URL'] || null))
  setIfPresent('salary_range', data['Salary Range'] === undefined ? undefined : (data['Salary Range'] || null))
  setIfPresent('date_applied', data['Date Applied'] === undefined ? undefined : (data['Date Applied'] || null))
  setIfPresent('follow_up_date', data['Follow-Up Date'] === undefined ? undefined : (data['Follow-Up Date'] || null))
  setIfPresent('contact_name', data['Contact Name'] === undefined ? undefined : (data['Contact Name'] || null))
  setIfPresent('contact_title', data['Contact Title'] === undefined ? undefined : (data['Contact Title'] || null))
  setIfPresent('outreach_method', data['Outreach Method'] === undefined ? undefined : (data['Outreach Method'] || null))
  setIfPresent('resume_version', data['Resume Version'] === undefined ? undefined : (data['Resume Version'] || null))
  setIfPresent('company_address', data['Company Address'] === undefined ? undefined : (data['Company Address'] || null))
  setIfPresent('company_phone', data['Company Phone'] === undefined ? undefined : (data['Company Phone'] || null))
  setIfPresent('notes', data.Notes === undefined ? undefined : (data.Notes || null))
  setIfPresent('research_notes', data['Research Notes'] === undefined ? undefined : (data['Research Notes'] || null))
  setIfPresent('filed_for_unemployment', data['Filed for Unemployment'] === undefined ? undefined : (data['Filed for Unemployment'] ? 1 : 0))
  setIfPresent('outcome', data.Outcome === undefined ? undefined : (data.Outcome || null))
  setIfPresent('resume_url', data['Resume URL'] === undefined ? undefined : (data['Resume URL'] || null))
  setIfPresent('work_location', data['Work Location'] === undefined ? undefined : (data['Work Location'] || null))
  setIfPresent('next_action', data['Next Action'] === undefined ? undefined : (data['Next Action'] || null))
  setIfPresent('next_action_date', data['Next Action Date'] === undefined ? undefined : (data['Next Action Date'] || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE pipeline_entries SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function updatePipelineStage(id, stage) {
  await db.execute({
    sql: 'UPDATE pipeline_entries SET stage = ?, updated_at = ? WHERE id = ?',
    args: [stage, now(), String(id)]
  })
}

const INTERVIEW_TRIGGER_STAGES = new Set(['📞 Interview Scheduled', '🎯 Interviewing'])

export async function ensureInterviewForPipelineStage(pipelineId, stageOverride = null) {
  const pipeline = await getPipelineEntryById(pipelineId)
  if (!pipeline) return { created: false, reason: 'pipeline_not_found' }

  const stage = stageOverride || pipeline.Stage
  if (!INTERVIEW_TRIGGER_STAGES.has(stage)) {
    return { created: false, reason: 'not_interview_stage' }
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM interviews WHERE pipeline_entry_id = ? LIMIT 1',
    args: [String(pipeline.id)]
  })
  const existingRow = firstRow(existing)
  if (existingRow?.id) {
    return { created: false, reason: 'already_exists', interviewId: String(existingRow.id) }
  }

  const ts = now()
  const id = crypto.randomUUID()
  const round = stage === '📞 Interview Scheduled' ? '1st Interview' : 'In Progress'
  const date = pipeline['Follow-Up Date'] || null
  await db.execute({
    sql: `
      INSERT INTO interviews (
        id, company, job_title, date, round, format, outcome, interviewer,
        questions_asked, feedback_received, follow_up_sent, notes, pipeline_entry_id, next_action, next_action_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      pipeline.Company || '',
      pipeline.Role || null,
      date,
      round,
      null,
      'Pending',
      pipeline['Contact Name'] || null,
      null,
      null,
      0,
      pipeline.Notes || null,
      String(pipeline.id),
      'Prepare interview talking points and STAR stories',
      date || addDaysIso(1),
      ts,
      ts
    ]
  })
  return { created: true, interviewId: id }
}

const STAGE_AUTOMATION = {
  '📨 Applied': { action: 'Send recruiter follow-up if no response', days: 5 },
  '🤝 Warm Outreach Sent': { action: 'Follow up with warm contact', days: 3 },
  '💬 In Conversation': { action: 'Keep momentum with next conversation step', days: 2 },
  '📞 Interview Scheduled': { action: 'Prep interview and research interviewers', days: 1 },
  '🎯 Interviewing': { action: 'Send thank-you note and debrief', days: 1 },
  '📋 Offer': { action: 'Review offer details and questions', days: 1 }
}

export async function applyPipelineStageAutomation(pipelineId, stageOverride = null) {
  const pipeline = await getPipelineEntryById(pipelineId)
  if (!pipeline) return { updated: false, reason: 'pipeline_not_found' }
  const stage = stageOverride || pipeline.Stage
  const suggestion = STAGE_AUTOMATION[stage]
  if (!suggestion) return { updated: false, reason: 'no_suggestion' }

  const needsAction = !String(pipeline['Next Action'] || '').trim()
  const needsDate = !String(pipeline['Next Action Date'] || '').trim()
  const updates = {}
  if (needsAction) updates['Next Action'] = suggestion.action
  if (needsDate) updates['Next Action Date'] = addDaysIso(suggestion.days)
  if (Object.keys(updates).length === 0) {
    return { updated: false, reason: 'already_has_next_action' }
  }

  await updatePipelineEntry(pipelineId, updates)
  return { updated: true, updates }
}

export async function backfillInterviewsFromPipeline() {
  const pipeline = await getPipeline()
  let created = 0
  let alreadyExists = 0
  let skipped = 0

  for (const item of pipeline) {
    if (!INTERVIEW_TRIGGER_STAGES.has(item.Stage)) {
      skipped += 1
      continue
    }
    const result = await ensureInterviewForPipelineStage(item.id, item.Stage)
    if (result?.created) {
      created += 1
      continue
    }
    if (result?.reason === 'already_exists') {
      alreadyExists += 1
      continue
    }
    skipped += 1
  }

  return {
    scanned: pipeline.length,
    created,
    alreadyExists,
    skipped
  }
}

export async function updatePipelineFollowUp(id, date) {
  await db.execute({
    sql: 'UPDATE pipeline_entries SET follow_up_date = ?, updated_at = ? WHERE id = ?',
    args: [date || null, now(), String(id)]
  })
}

export async function countPipelineEntries() {
  const res = await db.execute('SELECT COUNT(*) AS count FROM pipeline_entries')
  return Number(firstRow(res)?.count || 0)
}

export async function getContacts() {
  const res = await db.execute({
    sql: `
      SELECT * FROM contacts
      ORDER BY
        CASE WHEN next_follow_up IS NULL OR next_follow_up = '' THEN 1 ELSE 0 END,
        next_follow_up ASC,
        created_at DESC
    `
  })
  return toPlainRows(res).map(contactRowToRecord)
}

export async function getOverdueFollowUps() {
  const today = new Date().toISOString().slice(0, 10)
  const res = await db.execute({
    sql: `
      SELECT * FROM contacts
      WHERE
        next_follow_up IS NOT NULL
        AND next_follow_up != ''
        AND next_follow_up <= ?
        AND status IN ('Need to reach out', 'Waiting on response', 'In conversation')
      ORDER BY next_follow_up ASC, updated_at DESC
    `,
    args: [today]
  })
  return toPlainRows(res).map(contactRowToRecord)
}

export async function markContacted(id, nextFollowUp) {
  const today = new Date().toISOString().slice(0, 10)
  if (nextFollowUp) {
    await db.execute({
      sql: 'UPDATE contacts SET last_contact = ?, status = ?, next_follow_up = ?, updated_at = ? WHERE id = ?',
      args: [today, 'Waiting on response', nextFollowUp, now(), String(id)]
    })
    return
  }
  await db.execute({
    sql: 'UPDATE contacts SET last_contact = ?, status = ?, updated_at = ? WHERE id = ?',
    args: [today, 'Waiting on response', now(), String(id)]
  })
}

export async function updateContactStatus(id, status) {
  await db.execute({
    sql: 'UPDATE contacts SET status = ?, updated_at = ? WHERE id = ?',
    args: [status || '', now(), String(id)]
  })
}

export async function createContact(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  await db.execute({
    sql: `
      INSERT INTO contacts (
        id, name, title, company, email, phone, warmth, status, how_we_know_each_other,
        linkedin_url, next_follow_up, last_contact, resume_used, notes, next_action, next_action_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Name || '',
      data.Title || null,
      data.Company || null,
      data.Email || null,
      data.Phone || null,
      data.Warmth || '❄️ Cold — no contact yet',
      data.Status || 'Need to reach out',
      data['How We Know Each Other'] || null,
      data['LinkedIn URL'] || null,
      data['Next Follow-Up'] || null,
      data['Last Contact'] || null,
      data['Resume Used'] || null,
      data.Notes || null,
      data['Next Action'] || null,
      data['Next Action Date'] || null,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateContact(id, data = {}) {
  const updates = []
  const args = []
  const setIfPresent = (column, value) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`)
      args.push(value)
    }
  }

  setIfPresent('name', data.Name === undefined ? undefined : (data.Name || ''))
  setIfPresent('title', data.Title === undefined ? undefined : (data.Title || null))
  setIfPresent('company', data.Company === undefined ? undefined : (data.Company || null))
  setIfPresent('email', data.Email === undefined ? undefined : (data.Email || null))
  setIfPresent('phone', data.Phone === undefined ? undefined : (data.Phone || null))
  setIfPresent('warmth', data.Warmth === undefined ? undefined : (data.Warmth || null))
  setIfPresent('status', data.Status === undefined ? undefined : (data.Status || null))
  setIfPresent('how_we_know_each_other', data['How We Know Each Other'] === undefined ? undefined : (data['How We Know Each Other'] || null))
  setIfPresent('linkedin_url', data['LinkedIn URL'] === undefined ? undefined : (data['LinkedIn URL'] || null))
  setIfPresent('next_follow_up', data['Next Follow-Up'] === undefined ? undefined : (data['Next Follow-Up'] || null))
  setIfPresent('last_contact', data['Last Contact'] === undefined ? undefined : (data['Last Contact'] || null))
  setIfPresent('resume_used', data['Resume Used'] === undefined ? undefined : (data['Resume Used'] || null))
  setIfPresent('notes', data.Notes === undefined ? undefined : (data.Notes || null))
  setIfPresent('next_action', data['Next Action'] === undefined ? undefined : (data['Next Action'] || null))
  setIfPresent('next_action_date', data['Next Action Date'] === undefined ? undefined : (data['Next Action Date'] || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function getInterviews() {
  const res = await db.execute({
    sql: `
      SELECT * FROM interviews
      ORDER BY
        CASE WHEN date IS NULL OR date = '' THEN 1 ELSE 0 END,
        date DESC,
        created_at DESC
    `
  })
  return toPlainRows(res).map(interviewRowToRecord)
}

export async function createInterview(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  await db.execute({
    sql: `
      INSERT INTO interviews (
        id, company, job_title, date, round, format, outcome, interviewer,
        questions_asked, feedback_received, follow_up_sent, notes, pipeline_entry_id, next_action, next_action_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Company || '',
      data['Job Title'] || null,
      data.Date || null,
      data.Round || null,
      data.Format || null,
      data.Outcome || 'Pending',
      data.Interviewer || null,
      data['Questions Asked'] || null,
      data['Feedback Received'] || null,
      data['Follow-Up Sent'] ? 1 : 0,
      data.Notes || null,
      data['Pipeline Entry ID'] || null,
      data['Next Action'] || null,
      data['Next Action Date'] || null,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateInterview(id, data = {}) {
  const updates = []
  const args = []
  const setIfPresent = (column, value) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`)
      args.push(value)
    }
  }

  setIfPresent('company', data.Company === undefined ? undefined : (data.Company || ''))
  setIfPresent('job_title', data['Job Title'] === undefined ? undefined : (data['Job Title'] || null))
  setIfPresent('date', data.Date === undefined ? undefined : (data.Date || null))
  setIfPresent('round', data.Round === undefined ? undefined : (data.Round || null))
  setIfPresent('format', data.Format === undefined ? undefined : (data.Format || null))
  setIfPresent('outcome', data.Outcome === undefined ? undefined : (data.Outcome || null))
  setIfPresent('interviewer', data.Interviewer === undefined ? undefined : (data.Interviewer || null))
  setIfPresent('questions_asked', data['Questions Asked'] === undefined ? undefined : (data['Questions Asked'] || null))
  setIfPresent('feedback_received', data['Feedback Received'] === undefined ? undefined : (data['Feedback Received'] || null))
  setIfPresent('follow_up_sent', data['Follow-Up Sent'] === undefined ? undefined : (data['Follow-Up Sent'] ? 1 : 0))
  setIfPresent('notes', data.Notes === undefined ? undefined : (data.Notes || null))
  setIfPresent('next_action', data['Next Action'] === undefined ? undefined : (data['Next Action'] || null))
  setIfPresent('next_action_date', data['Next Action Date'] === undefined ? undefined : (data['Next Action Date'] || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE interviews SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function getEvents() {
  const res = await db.execute({
    sql: `
      SELECT * FROM events
      ORDER BY
        CASE WHEN date IS NULL OR date = '' THEN 1 ELSE 0 END,
        date ASC,
        created_at DESC
    `
  })
  return toPlainRows(res).map(eventRowToRecord)
}

export async function createEvent(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  await db.execute({
    sql: `
      INSERT INTO events (
        id, name, date, price, status, registration_link, notes, source_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Name || '',
      data.Date || null,
      data.Price || null,
      data.Status || 'Interested',
      data['Registration Link'] || null,
      data.Notes || null,
      data['Source Key'] || null,
      ts,
      ts
    ]
  })
  return { id }
}

export async function getEventBySourceKey(sourceKey) {
  if (!sourceKey) return null
  const res = await db.execute({
    sql: 'SELECT * FROM events WHERE source_key = ? LIMIT 1',
    args: [String(sourceKey)]
  })
  return eventRowToRecord(firstRow(res))
}

export async function updateEvent(id, data = {}) {
  const updates = []
  const args = []
  const setIfPresent = (column, value) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`)
      args.push(value)
    }
  }

  setIfPresent('name', data.Name === undefined ? undefined : (data.Name || ''))
  setIfPresent('date', data.Date === undefined ? undefined : (data.Date || null))
  setIfPresent('price', data.Price === undefined ? undefined : (data.Price || null))
  setIfPresent('status', data.Status === undefined ? undefined : (data.Status || null))
  setIfPresent('registration_link', data['Registration Link'] === undefined ? undefined : (data['Registration Link'] || null))
  setIfPresent('notes', data.Notes === undefined ? undefined : (data.Notes || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function getTemplates() {
  const res = await db.execute({
    sql: `
      SELECT * FROM templates
      ORDER BY updated_at DESC, created_at DESC
    `
  })
  return toPlainRows(res).map(templateRowToRecord)
}

export async function createTemplate(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  await db.execute({
    sql: `
      INSERT INTO templates (
        id, name, category, body, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Name || '',
      data.Category || null,
      data.Body || null,
      data.Notes || null,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateTemplate(id, data = {}) {
  const updates = []
  const args = []
  const setIfPresent = (column, value) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`)
      args.push(value)
    }
  }

  setIfPresent('name', data.Name === undefined ? undefined : (data.Name || ''))
  setIfPresent('category', data.Category === undefined ? undefined : (data.Category || null))
  setIfPresent('body', data.Body === undefined ? undefined : (data.Body || null))
  setIfPresent('notes', data.Notes === undefined ? undefined : (data.Notes || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE templates SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function getWatchlist() {
  const res = await db.execute({
    sql: `
      SELECT * FROM watchlist
      ORDER BY
        CASE WHEN follow_up IS NULL OR follow_up = '' THEN 1 ELSE 0 END,
        follow_up ASC,
        created_at DESC
    `
  })
  return toPlainRows(res).map(watchlistRowToRecord)
}

export async function createWatchlistEntry(data = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  await db.execute({
    sql: `
      INSERT INTO watchlist (
        id, company, industry, website, connections_there, know_the_founder,
        open_application, follow_up, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Company || '',
      data.Industry || null,
      data.Website || null,
      data['Connections There'] || null,
      data['Know the Founder'] ? 1 : 0,
      data['Open Application'] ? 1 : 0,
      data['Follow Up'] || null,
      data.Status || 'Watching',
      data.Notes || null,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateWatchlistEntry(id, data = {}) {
  const updates = []
  const args = []
  const setIfPresent = (column, value) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`)
      args.push(value)
    }
  }

  setIfPresent('company', data.Company === undefined ? undefined : (data.Company || ''))
  setIfPresent('industry', data.Industry === undefined ? undefined : (data.Industry || null))
  setIfPresent('website', data.Website === undefined ? undefined : (data.Website || null))
  setIfPresent('connections_there', data['Connections There'] === undefined ? undefined : (data['Connections There'] || null))
  setIfPresent('know_the_founder', data['Know the Founder'] === undefined ? undefined : (data['Know the Founder'] ? 1 : 0))
  setIfPresent('open_application', data['Open Application'] === undefined ? undefined : (data['Open Application'] ? 1 : 0))
  setIfPresent('follow_up', data['Follow Up'] === undefined ? undefined : (data['Follow Up'] || null))
  setIfPresent('status', data.Status === undefined ? undefined : (data.Status || null))
  setIfPresent('notes', data.Notes === undefined ? undefined : (data.Notes || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id))

  await db.execute({
    sql: `UPDATE watchlist SET ${updates.join(', ')} WHERE id = ?`,
    args
  })
}

export async function getDashboardData() {
  const [overdueContacts, recentLogs, pipeline, interviews, events, contacts] = await Promise.all([
    getOverdueFollowUps(),
    getRecentLogs(8),
    getPipeline(),
    getInterviews(),
    getEvents(),
    getContacts()
  ])
  const today = new Date().toISOString().slice(0, 10)
  const weekAhead = addDaysIso(7)

  const activeItems = pipeline.filter(p =>
    ['💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing'].includes(p.Stage)
  )
  const duePipelineFollowUps = pipeline
    .filter(p => {
      const due = String(p['Follow-Up Date'] || '').trim()
      const stage = String(p.Stage || '')
      if (!due) return false
      if (stage.includes('Closed')) return false
      return due <= today
    })
    .sort((a, b) => String(a['Follow-Up Date']).localeCompare(String(b['Follow-Up Date'])))

  const dueInterviewActions = interviews
    .filter(i => i.Outcome === 'Pending' && i['Next Action Date'] && i['Next Action Date'] <= today)
    .sort((a, b) => String(a['Next Action Date']).localeCompare(String(b['Next Action Date'])))

  const upcomingInterviews = interviews
    .filter(i => i.Outcome === 'Pending' && i.Date && i.Date >= today && i.Date <= weekAhead)
    .sort((a, b) => String(a.Date).localeCompare(String(b.Date)))

  const upcomingEvents = events
    .filter(e => e.Status !== 'Attended' && e.Status !== 'Skipped' && e.Date && e.Date >= today && e.Date <= weekAhead)
    .sort((a, b) => String(a.Date).localeCompare(String(b.Date)))

  const stalledPipeline = pipeline.filter(p => {
    const stage = String(p.Stage || '')
    if (stage.includes('Closed')) return false
    return !String(p['Next Action'] || '').trim() || !String(p['Next Action Date'] || '').trim()
  })
  const stalledContacts = contacts.filter(c => {
    if (['Gone cold', 'Referred me'].includes(String(c.Status || ''))) return false
    return !String(c['Next Action'] || '').trim() || !String(c['Next Action Date'] || '').trim()
  })
  const stalledInterviews = interviews.filter(i => i.Outcome === 'Pending' && (!String(i['Next Action'] || '').trim() || !String(i['Next Action Date'] || '').trim()))

  const weekStats = recentLogs.slice(0, 7).reduce((acc, log) => {
    acc.outreach += log['Outreach Sent'] || 0
    acc.responses += log['Responses Received'] || 0
    acc.applications += log['Applications Submitted'] || 0
    acc.linkedInPosts += log['LinkedIn Posts'] ? 1 : 0
    return acc
  }, { outreach: 0, responses: 0, applications: 0, linkedInPosts: 0 })

  const followUpItems = [
    ...overdueContacts.map(c => ({
      id: `contact-${c.id}`,
      entityId: c.id,
      type: 'contact_follow_up',
      pillarId: 'follow_ups_due',
      title: `Follow up with ${c.Name}`,
      subtitle: c.Company ? `${c.Title || 'Contact'} @ ${c.Company}` : (c.Title || 'Contact'),
      dueDate: c['Next Follow-Up'] || today,
      reason: `Contact follow-up is due (${c['Next Follow-Up'] || 'today'}).`,
      actionLabel: 'Open Contacts',
      route: 'contacts',
      priority: 1
    })),
    ...duePipelineFollowUps.map(p => ({
      id: `pipeline-followup-${p.id}`,
      entityId: p.id,
      type: 'pipeline_follow_up',
      pillarId: 'follow_ups_due',
      title: `${p.Company}: ${p['Next Action'] || 'Follow up on application'}`,
      subtitle: p.Role || p.Stage,
      dueDate: p['Follow-Up Date'],
      reason: `Pipeline follow-up date is due (${p['Follow-Up Date']}).`,
      actionLabel: 'Open Pipeline',
      route: 'pipeline',
      priority: 1
    }))
  ]

  const interviewItems = [
    ...dueInterviewActions.map(i => ({
      id: `interview-action-${i.id}`,
      entityId: i.id,
      type: 'interview_action',
      pillarId: 'interview_readiness',
      title: `${i.Company}: ${i['Next Action'] || 'Complete interview follow-up task'}`,
      subtitle: [i.Round, i.Date].filter(Boolean).join(' · '),
      dueDate: i['Next Action Date'],
      reason: `Interview next action is due (${i['Next Action Date']}).`,
      actionLabel: 'Open Interviews',
      route: 'interviews',
      priority: 2
    })),
    ...upcomingInterviews.map(i => ({
      id: `upcoming-interview-${i.id}`,
      entityId: i.id,
      type: 'upcoming_interview',
      pillarId: 'interview_readiness',
      title: `${i.Company}: Upcoming interview`,
      subtitle: [i.Round, i.Format].filter(Boolean).join(' · ') || 'Interview',
      dueDate: i.Date,
      reason: `Interview is coming up on ${i.Date}.`,
      actionLabel: 'Open Interviews',
      route: 'interviews',
      priority: 2
    }))
  ]

  const momentumItems = stalledPipeline.slice(0, 5).map(p => ({
    id: `pipeline-stalled-${p.id}`,
    entityId: p.id,
    type: 'pipeline_stalled',
    pillarId: 'pipeline_momentum',
    title: `${p.Company}: define next action`,
    subtitle: p.Role || p.Stage,
    dueDate: p['Follow-Up Date'] || today,
    reason: 'This active pipeline item is missing next action details.',
    actionLabel: 'Open Pipeline',
    route: 'pipeline',
    priority: 3
  }))

  const networkingItems = []
  if (weekStats.outreach < WEEKLY_TARGETS.outreach) {
    networkingItems.push({
      id: 'networking-weekly-outreach',
      entityId: 'weekly-outreach',
      type: 'networking_goal',
      pillarId: 'networking_consistency',
      title: `Send ${WEEKLY_TARGETS.outreach - weekStats.outreach} more outreach messages this week`,
      subtitle: `Progress: ${weekStats.outreach}/${WEEKLY_TARGETS.outreach}`,
      dueDate: addDaysIso(1),
      reason: 'Weekly networking target is behind pace.',
      actionLabel: 'Open Contacts',
      route: 'contacts',
      priority: 4
    })
  }
  if (stalledContacts.length > 0) {
    networkingItems.push({
      id: 'networking-stalled-contacts',
      entityId: 'stalled-contacts',
      type: 'networking_stalled',
      pillarId: 'networking_consistency',
      title: `${stalledContacts.length} contact records need a next action`,
      subtitle: 'Add next action/date to keep outreach moving',
      dueDate: today,
      reason: 'Contacts without next actions often get lost.',
      actionLabel: 'Open Contacts',
      route: 'contacts',
      priority: 4
    })
  }

  const applicationItems = []
  if (weekStats.applications < WEEKLY_TARGETS.applications) {
    applicationItems.push({
      id: 'applications-weekly-target',
      entityId: 'weekly-applications',
      type: 'application_goal',
      pillarId: 'application_throughput',
      title: `Submit ${WEEKLY_TARGETS.applications - weekStats.applications} more applications this week`,
      subtitle: `Progress: ${weekStats.applications}/${WEEKLY_TARGETS.applications}`,
      dueDate: addDaysIso(2),
      reason: 'Application throughput is below weekly goal.',
      actionLabel: 'Open Pipeline',
      route: 'pipeline',
      priority: 5
    })
  }

  const eventsItems = upcomingEvents.map(e => ({
    id: `upcoming-event-${e.id}`,
    entityId: e.id,
    type: 'upcoming_event',
    pillarId: 'events_market_presence',
    title: e.Name,
    subtitle: e.Status || 'Event',
    dueDate: e.Date,
    reason: `Event is scheduled for ${e.Date}.`,
    actionLabel: 'Open Events',
    route: 'events',
    priority: 6
  }))
  if (eventsItems.length === 0) {
    eventsItems.push({
      id: 'events-none-upcoming',
      entityId: 'events-empty',
      type: 'events_gap',
      pillarId: 'events_market_presence',
      title: 'Add one networking event for this week',
      subtitle: 'Keep market visibility and momentum',
      dueDate: addDaysIso(3),
      reason: 'No upcoming events are currently scheduled.',
      actionLabel: 'Open Events',
      route: 'events',
      priority: 6
    })
  }

  const todayQueue = [
    ...followUpItems,
    ...interviewItems,
    ...momentumItems,
    ...networkingItems,
    ...applicationItems,
    ...eventsItems
  ].sort((a, b) => {
    const p = (a.priority || 9) - (b.priority || 9)
    if (p !== 0) return p
    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
  })

  const suggestedTop3 = todayQueue.slice(0, 3).map((item, idx) => `${idx + 1}. ${item.title}`)

  const queueByPillar = Object.fromEntries(PRIORITY_FRAMEWORK.map(p => [p.id, 0]))
  for (const item of todayQueue) {
    if (item?.pillarId && queueByPillar[item.pillarId] != null) queueByPillar[item.pillarId] += 1
  }

  return {
    overdueContacts,
    duePipelineFollowUps,
    dueInterviewActions,
    upcomingInterviews,
    upcomingEvents,
    recentLogs,
    activeItems,
    weekStats,
    todayQueue,
    suggestedTop3,
    priorityFramework: PRIORITY_FRAMEWORK.map(p => ({ ...p, count: queueByPillar[p.id] || 0 })),
    health: {
      queueSize: todayQueue.length,
      stale: {
        pipeline: stalledPipeline.length,
        contacts: stalledContacts.length,
        interviews: stalledInterviews.length
      },
      staleTotal: stalledPipeline.length + stalledContacts.length + stalledInterviews.length
    }
  }
}
