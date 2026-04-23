import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  initDb,
  getUserByUsername, getUserByEmail, getUserById,
  createSession, getSession, deleteSession, updatePassword, getRecentSheetSyncRuns,
  getAppSettings, setAppSetting,
  getDashboardData,
  getContacts, markContacted, updateContactStatus, createContact, updateContact,
  getInterviews, createInterview, updateInterview,
  getEvents, createEvent, updateEvent,
  getTemplates, createTemplate, updateTemplate,
  getWatchlist, createWatchlistEntry, updateWatchlistEntry,
  getDailyLogs, getTodayLog, createDailyLog, updateDailyLog,
  getPipeline, updatePipelineEntry, updatePipelineStage, updatePipelineFollowUp, createPipelineEntry
} from './db.js'
import { runSheetsSync, testSheetsConnection, getSheetsSyncStatus, normalizeSheetsSyncError } from './sheetsSync.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const isProd = existsSync(path.join(__dirname, '../dist'))
const AUTH_MODE = (process.env.AUTH_MODE || 'session').toLowerCase()
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
)
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(['/api/me', '/api/change-password', '/api/logout'])
const SHEETS_SYNC_CRON_TOKEN = String(process.env.SHEETS_SYNC_CRON_TOKEN || '').trim()
const SHEET_SETTINGS_KEYS = {
  enabled: 'sheets.sync.enabled',
  sheetId: 'sheets.sheet_id',
  pipelineTabs: 'sheets.pipeline_tabs',
  contactsTabs: 'sheets.contacts_tabs',
  interviewsTabs: 'sheets.interviews_tabs',
  eventsTabs: 'sheets.events_tabs'
}

function parseBool(value, fallback = false) {
  if (value == null) return fallback
  const v = String(value).trim().toLowerCase()
  if (!v) return fallback
  return ['1', 'true', 'yes', 'y', 'on'].includes(v)
}

function splitTabs(raw) {
  return String(raw || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
}

async function getSheetsConfigOverrides() {
  const settings = await getAppSettings(Object.values(SHEET_SETTINGS_KEYS))
  const overrides = {}

  if (settings[SHEET_SETTINGS_KEYS.enabled] != null) {
    overrides.enabled = parseBool(settings[SHEET_SETTINGS_KEYS.enabled], true)
  }
  if (settings[SHEET_SETTINGS_KEYS.sheetId]) {
    overrides.sheetId = settings[SHEET_SETTINGS_KEYS.sheetId]
  }
  if (settings[SHEET_SETTINGS_KEYS.pipelineTabs]) {
    overrides.pipelineTabs = splitTabs(settings[SHEET_SETTINGS_KEYS.pipelineTabs])
  }
  if (settings[SHEET_SETTINGS_KEYS.contactsTabs]) {
    overrides.contactsTabs = splitTabs(settings[SHEET_SETTINGS_KEYS.contactsTabs])
  }
  if (settings[SHEET_SETTINGS_KEYS.interviewsTabs]) {
    overrides.interviewsTabs = splitTabs(settings[SHEET_SETTINGS_KEYS.interviewsTabs])
  }
  if (settings[SHEET_SETTINGS_KEYS.eventsTabs]) {
    overrides.eventsTabs = splitTabs(settings[SHEET_SETTINGS_KEYS.eventsTabs])
  }

  return overrides
}

function formatSyncRun(row) {
  let summary = null
  try {
    summary = row.summary_json ? JSON.parse(String(row.summary_json)) : null
  } catch {
    summary = null
  }

  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    summary,
    errorText: row.error_text || null
  }
}

app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: isProd ? false : 'http://localhost:3000',
  credentials: true
}))
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, authMode: AUTH_MODE, now: new Date().toISOString() })
})

function isValidCronToken(req) {
  const provided = String(req.headers['x-sync-token'] || '').trim()
  if (!provided || !SHEETS_SYNC_CRON_TOKEN) return false

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(SHEETS_SYNC_CRON_TOKEN, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// ─── Auth middleware ───────────────────────────────────────────────────────────

function extractIapEmail(req) {
  const raw = req.headers['x-goog-authenticated-user-email']
  if (!raw || Array.isArray(raw)) return null
  const value = String(raw).trim()
  const email = value.includes(':') ? value.split(':').pop() : value
  if (!email || !email.includes('@')) return null
  return email.toLowerCase()
}

async function requireAuth(req, res, next) {
  try {
    if (AUTH_MODE === 'iap' || AUTH_MODE === 'hybrid') {
      const iapEmail = extractIapEmail(req)
      if (iapEmail) {
        // In IAP mode, trust IAP identity headers directly to avoid per-request DB dependency.
        req.userId = null
        req.userEmail = iapEmail
        req.isAdmin = ADMIN_EMAILS.has(iapEmail)
        req.mustChangePassword = false
        req.authMode = 'iap'
        return next()
      }

      if (AUTH_MODE === 'iap') {
        return res.status(401).json({ error: 'IAP identity required' })
      }
    }

    const token = req.cookies?.session
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const session = await getSession(token)
    if (!session) return res.status(401).json({ error: 'Unauthorized' })
    req.userId = session.user_id
    const user = await getUserById(session.user_id)
    req.userEmail = user?.email || null
    req.isAdmin = !!user?.isAdmin
    req.mustChangePassword = !!user?.mustChangePassword
    req.authMode = 'session'

    if (req.mustChangePassword && !PASSWORD_CHANGE_ALLOWED_PATHS.has(req.path)) {
      return res.status(403).json({ error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' })
    }
    next()
  } catch (e) {
    console.error('requireAuth failed', e)
    res.status(503).json({ error: 'Auth backend unavailable. Please retry.' })
  }
}

// ─── Auth routes ───────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  if (AUTH_MODE === 'iap') {
    return res.status(400).json({ error: 'Local login disabled (IAP mode)' })
  }

  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' })

  let user = await getUserByUsername(username)
  if (!user && username.includes('@')) {
    user = await getUserByEmail(username)
  }
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  await createSession(token, user.id)

  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  })

  res.json({
    ok: true,
    username: user.username,
    mustChangePassword: !!user.mustChangePassword
  })
})

app.post('/api/logout', async (req, res) => {
  const token = req.cookies?.session
  if (token) await deleteSession(token)
  res.clearCookie('session')
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    ok: true,
    authMode: req.authMode,
    email: req.userEmail || null,
    isAdmin: !!req.isAdmin,
    mustChangePassword: !!req.mustChangePassword
  })
})

app.post('/api/change-password', requireAuth, async (req, res) => {
  if (req.authMode === 'iap') {
    return res.status(400).json({ error: 'Password changes are disabled in IAP mode' })
  }

  const { currentPassword, newPassword } = req.body
  if (!newPassword || String(newPassword).length < 10) {
    return res.status(400).json({ error: 'New password must be at least 10 characters' })
  }
  const user = await getUserById(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password incorrect' })
  }
  const hash = bcrypt.hashSync(newPassword, 10)
  await updatePassword(req.userId, hash)
  res.json({ ok: true })
})

// ─── Dashboard ─────────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const data = await getDashboardData()
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Pipeline ──────────────────────────────────────────────────────────────────

app.get('/api/pipeline', requireAuth, async (req, res) => {
  try {
    res.json(await getPipeline())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/pipeline/:id/stage', requireAuth, async (req, res) => {
  try {
    await updatePipelineStage(req.params.id, req.body.stage)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/pipeline/:id/followup', requireAuth, async (req, res) => {
  try {
    await updatePipelineFollowUp(req.params.id, req.body.date)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/pipeline/:id', requireAuth, async (req, res) => {
  try {
    await updatePipelineEntry(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/pipeline', requireAuth, async (req, res) => {
  try {
    const page = await createPipelineEntry(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Contacts ──────────────────────────────────────────────────────────────────

app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    res.json(await getContacts())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/contacts/:id/contacted', requireAuth, async (req, res) => {
  try {
    await markContacted(req.params.id, req.body.nextFollowUp)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/contacts/:id/status', requireAuth, async (req, res) => {
  try {
    await updateContactStatus(req.params.id, req.body.status)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    await updateContact(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    const page = await createContact(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Interviews ────────────────────────────────────────────────────────────────

app.get('/api/interviews', requireAuth, async (req, res) => {
  try {
    res.json(await getInterviews())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/interviews', requireAuth, async (req, res) => {
  try {
    const page = await createInterview(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/interviews/:id', requireAuth, async (req, res) => {
  try {
    await updateInterview(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Events ────────────────────────────────────────────────────────────────────

app.get('/api/events', requireAuth, async (req, res) => {
  try {
    res.json(await getEvents())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/events', requireAuth, async (req, res) => {
  try {
    const page = await createEvent(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/events/:id', requireAuth, async (req, res) => {
  try {
    await updateEvent(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Templates ─────────────────────────────────────────────────────────────────

app.get('/api/templates', requireAuth, async (req, res) => {
  try { res.json(await getTemplates()) } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/templates', requireAuth, async (req, res) => {
  try {
    const page = await createTemplate(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/templates/:id', requireAuth, async (req, res) => {
  try { await updateTemplate(req.params.id, req.body); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Watchlist ─────────────────────────────────────────────────────────────────

app.get('/api/watchlist', requireAuth, async (req, res) => {
  try { res.json(await getWatchlist()) } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/watchlist', requireAuth, async (req, res) => {
  try {
    const page = await createWatchlistEntry(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/watchlist/:id', requireAuth, async (req, res) => {
  try { await updateWatchlistEntry(req.params.id, req.body); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Daily Log ─────────────────────────────────────────────────────────────────

app.get('/api/daily', requireAuth, async (req, res) => {
  try {
    res.json(await getDailyLogs(30))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/daily/today', requireAuth, async (req, res) => {
  try {
    const dateLabel = typeof req.query?.date_label === 'string' ? req.query.date_label : undefined
    res.json(await getTodayLog(dateLabel))
  } catch (e) {
    console.error('daily.today failed', e)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/daily', requireAuth, async (req, res) => {
  try {
    const page = await createDailyLog(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) {
    console.error('daily.create failed', e)
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/daily/:id', requireAuth, async (req, res) => {
  try {
    await updateDailyLog(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    console.error('daily.update failed', e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Sheets Sync ──────────────────────────────────────────────────────────────

app.get('/api/sheets/config', requireAuth, async (_req, res) => {
  try {
    const overrides = await getSheetsConfigOverrides()
    const status = await getSheetsSyncStatus(overrides)
    res.json({ ok: true, config: status })
  } catch (e) {
    console.error('sheets.config.get failed', e)
    res.status(500).json({ error: 'Could not load sheet settings' })
  }
})

app.put('/api/sheets/config', requireAuth, async (req, res) => {
  try {
    const existingOverrides = await getSheetsConfigOverrides()
    const body = req.body || {}
    const updates = {}

    if (body.enabled != null) updates.enabled = parseBool(body.enabled, true)
    if (body.sheetId != null) updates.sheetId = String(body.sheetId || '').trim()
    if (body.pipelineTabs != null) updates.pipelineTabs = Array.isArray(body.pipelineTabs) ? body.pipelineTabs : splitTabs(body.pipelineTabs)
    if (body.contactsTabs != null) updates.contactsTabs = Array.isArray(body.contactsTabs) ? body.contactsTabs : splitTabs(body.contactsTabs)
    if (body.interviewsTabs != null) updates.interviewsTabs = Array.isArray(body.interviewsTabs) ? body.interviewsTabs : splitTabs(body.interviewsTabs)
    if (body.eventsTabs != null) updates.eventsTabs = Array.isArray(body.eventsTabs) ? body.eventsTabs : splitTabs(body.eventsTabs)

    const nextEnabled = updates.enabled != null ? updates.enabled : (existingOverrides.enabled ?? true)
    if (nextEnabled && updates.sheetId != null && !updates.sheetId) {
      return res.status(400).json({ error: 'Sheet ID cannot be empty.' })
    }

    if (updates.enabled != null) await setAppSetting(SHEET_SETTINGS_KEYS.enabled, updates.enabled ? 'true' : 'false')
    if (updates.sheetId != null) await setAppSetting(SHEET_SETTINGS_KEYS.sheetId, updates.sheetId)
    if (updates.pipelineTabs != null) await setAppSetting(SHEET_SETTINGS_KEYS.pipelineTabs, updates.pipelineTabs.join(','))
    if (updates.contactsTabs != null) await setAppSetting(SHEET_SETTINGS_KEYS.contactsTabs, updates.contactsTabs.join(','))
    if (updates.interviewsTabs != null) await setAppSetting(SHEET_SETTINGS_KEYS.interviewsTabs, updates.interviewsTabs.join(','))
    if (updates.eventsTabs != null) await setAppSetting(SHEET_SETTINGS_KEYS.eventsTabs, updates.eventsTabs.join(','))

    const overrides = await getSheetsConfigOverrides()
    const status = await getSheetsSyncStatus(overrides)
    res.json({ ok: true, config: status })
  } catch (e) {
    console.error('sheets.config.update failed', e)
    res.status(500).json({ error: 'Could not save sheet settings' })
  }
})

app.post('/api/sheets/test-connection', requireAuth, async (_req, res) => {
  try {
    const overrides = await getSheetsConfigOverrides()
    const result = await testSheetsConnection(overrides)
    res.json(result)
  } catch (e) {
    const normalized = e?.normalized || normalizeSheetsSyncError(e)
    res.status(normalized.status || 500).json({
      error: normalized.userMessage,
      code: normalized.code,
      fixSteps: normalized.fixSteps,
      retryable: normalized.retryable,
      details: normalized.details
    })
  }
})

app.post('/api/sheets/sync', requireAuth, async (req, res) => {
  try {
    const overrides = await getSheetsConfigOverrides()
    const result = await runSheetsSync(overrides)
    res.json(result)
  } catch (e) {
    const normalized = e?.normalized || normalizeSheetsSyncError(e)
    res.status(normalized.status || 500).json({
      error: normalized.userMessage,
      code: normalized.code,
      fixSteps: normalized.fixSteps,
      retryable: normalized.retryable,
      details: normalized.details
    })
  }
})

app.post('/api/internal/sheets/sync', async (req, res) => {
  if (!SHEETS_SYNC_CRON_TOKEN) {
    return res.status(503).json({ error: 'SHEETS_SYNC_CRON_TOKEN is not configured' })
  }
  if (!isValidCronToken(req)) {
    return res.status(401).json({ error: 'Invalid sync token' })
  }

  try {
    const overrides = await getSheetsConfigOverrides()
    const result = await runSheetsSync(overrides)
    res.json(result)
  } catch (e) {
    console.error('internal.sheets.sync failed', e)
    const normalized = e?.normalized || normalizeSheetsSyncError(e)
    res.status(normalized.status || 500).json({
      error: normalized.userMessage,
      code: normalized.code,
      retryable: normalized.retryable,
      details: normalized.details
    })
  }
})

app.get('/api/sheets/sync/runs', requireAuth, async (req, res) => {
  try {
    const runs = await getRecentSheetSyncRuns(25)
    res.json(runs.map(formatSyncRun))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/sheets/status', requireAuth, async (_req, res) => {
  try {
    const overrides = await getSheetsConfigOverrides()
    const config = await getSheetsSyncStatus(overrides)
    const runs = await getRecentSheetSyncRuns(25)
    const formattedRuns = runs.map(formatSyncRun)
    const latestRun = formattedRuns[0] || null
    const latestSuccess = latestRun?.status === 'ok' ? latestRun : null
    const latestError = latestRun?.status === 'error' ? latestRun : null
    const hasConfigIssue = config?.ok === false

    res.json({
      ok: true,
      config,
      health: {
        status: (hasConfigIssue || latestError) ? 'needs_attention' : 'healthy',
        lastSuccessAt: latestSuccess?.createdAt || null,
        lastErrorAt: latestError?.createdAt || null,
        lastError: hasConfigIssue
          ? { direction: 'config', details: config?.error?.userMessage || 'Configuration issue' }
          : latestError
            ? { direction: latestError.direction, details: latestError.errorText }
            : null
      }
    })
  } catch (e) {
    console.error('sheets.status failed', e)
    res.status(500).json({ error: 'Could not load sync status' })
  }
})

// ─── Serve frontend in prod ────────────────────────────────────────────────────

if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    immutable: true,
    maxAge: '1y'
  }))
  app.use(express.static(distPath, { index: false }))
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

async function initDbWithRetry(maxAttempts = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await initDb()
      return
    } catch (e) {
      lastError = e
      console.error(`initDb failed (attempt ${attempt}/${maxAttempts})`, e)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 750))
      }
    }
  }
  throw lastError
}

try {
  await initDbWithRetry(3)
} catch (e) {
  // Keep the service online; request handlers will surface backend-unavailable errors.
  console.error('DB bootstrap failed; starting server in degraded mode', e)
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
