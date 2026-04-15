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
  getUserByUsername, createSession, getSession, deleteSession, updatePassword
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const isProd = existsSync(path.join(__dirname, '../dist'))

app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: isProd ? false : 'http://localhost:3000',
  credentials: true
}))

// ─── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const token = req.cookies?.session
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const session = getSession(token)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  req.userId = session.user_id
  next()
}

// ─── Auth routes ───────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' })

  const user = getUserByUsername(username)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  createSession(token, user.id)

  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  })

  res.json({ ok: true, username: user.username })
})

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.session
  if (token) deleteSession(token)
  res.clearCookie('session')
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true })
})

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = getUserByUsername('jason')
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password incorrect' })
  }
  const hash = bcrypt.hashSync(newPassword, 10)
  updatePassword(req.userId, hash)
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

// ─── Serve frontend in prod ────────────────────────────────────────────────────

if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
