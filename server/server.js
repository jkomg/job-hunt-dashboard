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
  getUserByUsername, getUserByEmail, getUserById, ensureUserByEmail,
  createSession, getSession, deleteSession, updatePassword, getRecentSheetSyncRuns
} from './db.js'

import {
  getDashboardData,
  getPipeline, updatePipelineEntry, updatePipelineStage, updatePipelineFollowUp, createPipelineEntry,
  getContacts, markContacted, updateContactStatus, createContact, updateContact,
  getDailyLogs, getTodayLog, getRecentLogs, createDailyLog, updateDailyLog,
  getInterviews, createInterview, updateInterview,
  getEvents, createEvent, updateEvent,
  getTemplates, createTemplate, updateTemplate,
  getWatchlist, createWatchlistEntry, updateWatchlistEntry
} from './notion.js'
import { runSheetsSync } from './sheetsSync.js'

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

app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: isProd ? false : 'http://localhost:3000',
  credentials: true
}))

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
  if (AUTH_MODE === 'iap' || AUTH_MODE === 'hybrid') {
    const iapEmail = extractIapEmail(req)
    if (iapEmail) {
      const user = await ensureUserByEmail(iapEmail, { isAdmin: ADMIN_EMAILS.has(iapEmail) })
      req.userId = user.id
      req.userEmail = user.email
      req.isAdmin = !!user.isAdmin
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
    res.json(await getTodayLog())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/daily', requireAuth, async (req, res) => {
  try {
    const page = await createDailyLog(req.body)
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/daily/:id', requireAuth, async (req, res) => {
  try {
    await updateDailyLog(req.params.id, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Sheets Sync ──────────────────────────────────────────────────────────────

app.post('/api/sheets/sync', requireAuth, async (req, res) => {
  try {
    const result = await runSheetsSync()
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/sheets/sync/runs', requireAuth, async (req, res) => {
  try {
    res.json(await getRecentSheetSyncRuns(25))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Serve frontend in prod ────────────────────────────────────────────────────

if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

await initDb()

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
