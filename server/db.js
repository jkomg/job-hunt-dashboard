import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
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
    `
  ])

  await ensureUserSchema()

  const existing = await getUserByUsername('jason')
  if (!existing) {
    const hash = bcrypt.hashSync('jobhunt2026', 10)
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES (?, ?, ?, ?)',
      args: ['jason', hash, 1, 0]
    })
    console.log('Default user created: jason / jobhunt2026')
  }

  initialized = true
}

function firstRow(res) {
  return res.rows?.[0] || null
}

function toPlainRows(res) {
  return (res.rows || []).map(r => ({ ...r }))
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
