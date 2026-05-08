import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { existsSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Storage } from '@google-cloud/storage'

import {
  initDb,
  getUserByUsername, getUserByEmail, getUserById,
  getPrimaryMembershipForUser, createUserAccount, listOrganizationUsers, listAssignedUsersForStaff,
  listStaffAssignments, createStaffAssignment, deleteStaffAssignment, createAuditLog, getAuditLogs,
  hasStaffAssignment, listJobRecommendations, createJobRecommendation, getJobRecommendationById, markRecommendationPosted, listStaffTasks,
  getStaffTaskById, createStaffTask, updateStaffTask,
  listCandidateThreads, getCandidateThreadById, createCandidateThread, listCandidateMessages, createCandidateMessage,
  listCandidateThreadsByScope, updateCandidateThreadStatus,
  listCandidateThreadsForMember, listCandidateMessagesForMember,
  createSession, getSession, deleteSession, updatePassword, updateUsername, getRecentSheetSyncRuns, getLocalDataLastUpdatedAt,
  updateOrganizationUserRole, adminSetUserPassword, adminSetMustChangePassword,
  getAppSetting, getAppSettings, setAppSetting, exportBackupSnapshot, restoreBackupSnapshot, createLocalDatabaseSnapshot,
  createCostSnapshot, getRecentCostSnapshots,
  getDashboardData,
  getContacts, markContacted, updateContactStatus, createContact, updateContact,
  getInterviews, createInterview, updateInterview,
  getEvents, createEvent, updateEvent, getEventBySourceKey,
  getTemplates, createTemplate, updateTemplate,
  getWatchlist, createWatchlistEntry, updateWatchlistEntry,
  getDailyLogs, getTodayLog, createDailyLog, updateDailyLog,
  getPipeline, updatePipelineEntry, updatePipelineStage, updatePipelineFollowUp, createPipelineEntry,
  ensureInterviewForPipelineStage, backfillInterviewsFromPipeline, applyPipelineStageAutomation
} from './db.js'
import { runSheetsSync, testSheetsConnection, getSheetsSyncStatus, normalizeSheetsSyncError, getSheetsSchemaReport } from './sheetsSync.js'
import { getGmailIntegrationConfig, buildGmailAuthUrl, exchangeGmailCode, importEventsFromGmail } from './gmailEvents.js'

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
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(['/api/me', '/api/change-password', '/api/logout', '/api/csrf'])
const SHEETS_SYNC_CRON_TOKEN = String(process.env.SHEETS_SYNC_CRON_TOKEN || '').trim()
const BACKUP_EXPORT_CRON_TOKEN = String(process.env.BACKUP_EXPORT_CRON_TOKEN || '').trim()
const COST_SNAPSHOT_CRON_TOKEN = String(process.env.COST_SNAPSHOT_CRON_TOKEN || '').trim()
const BACKUP_GCS_BUCKET = String(process.env.BACKUP_GCS_BUCKET || '').trim()
const BACKUP_GCS_PREFIX = String(process.env.BACKUP_GCS_PREFIX || 'job-hunt').trim()
const SHEET_SETTINGS_KEYS = {
  enabled: 'sheets.sync.enabled',
  sheetId: 'sheets.sheet_id',
  pipelineTabs: 'sheets.pipeline_tabs',
  contactsTabs: 'sheets.contacts_tabs',
  interviewsTabs: 'sheets.interviews_tabs',
  eventsTabs: 'sheets.events_tabs'
}
const APP_SETTINGS_KEYS = {
  onboardingComplete: 'app.onboarding.completed',
  displayName: 'app.profile.display_name'
}
const GMAIL_SETTINGS_KEYS = {
  tokens: 'gmail.oauth.tokens',
  email: 'gmail.oauth.email',
  connectedAt: 'gmail.oauth.connected_at',
  oauthState: 'gmail.oauth.state',
  oauthStateCreatedAt: 'gmail.oauth.state_created_at'
}
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const API_RATE_LIMIT = Number(process.env.API_RATE_LIMIT || 400)
const LOGIN_RATE_LIMIT = Number(process.env.LOGIN_RATE_LIMIT || 20)
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const rateBuckets = new Map()
const DEPLOY_VERSION = String(process.env.DEPLOY_VERSION || 'dev')
const CSRF_EXEMPT_PATHS = new Set([
  '/api/login',
  '/api/health',
  '/api/internal/sheets/sync',
  '/api/internal/backup/export',
  '/api/internal/cost/snapshot'
])
const execFileAsync = promisify(execFile)

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

function getClientIp(req) {
  const xfwd = String(req.headers['x-forwarded-for'] || '').trim()
  if (xfwd) return xfwd.split(',')[0].trim()
  return req.ip || req.connection?.remoteAddress || 'unknown'
}

function parseJson(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function checkRateLimit(req, { scope, limit, windowMs }) {
  const ip = getClientIp(req)
  const key = `${scope}:${ip}`
  const ts = Date.now()
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: ts + windowMs }

  if (ts > bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = ts + windowMs
  }

  bucket.count += 1
  rateBuckets.set(key, bucket)
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  }
}

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex')
}

function setCsrfCookie(res, token) {
  res.cookie('csrf_token', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
}

function isMutatingMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase())
}

async function getOnboardingStatus() {
  const settings = await getAppSettings([APP_SETTINGS_KEYS.onboardingComplete, APP_SETTINGS_KEYS.displayName])
  return {
    onboardingComplete: parseBool(settings[APP_SETTINGS_KEYS.onboardingComplete], false),
    displayName: (settings[APP_SETTINGS_KEYS.displayName] || 'there').trim() || 'there'
  }
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

async function getGmailConnection() {
  const [rawTokens, email, connectedAt] = await Promise.all([
    getAppSetting(GMAIL_SETTINGS_KEYS.tokens),
    getAppSetting(GMAIL_SETTINGS_KEYS.email),
    getAppSetting(GMAIL_SETTINGS_KEYS.connectedAt)
  ])
  return {
    tokens: parseJson(rawTokens, null),
    email: email || null,
    connectedAt: connectedAt || null
  }
}

async function setGmailConnection({ tokens, email }) {
  await setAppSetting(GMAIL_SETTINGS_KEYS.tokens, JSON.stringify(tokens || {}))
  await setAppSetting(GMAIL_SETTINGS_KEYS.email, email || '')
  await setAppSetting(GMAIL_SETTINGS_KEYS.connectedAt, new Date().toISOString())
}

async function clearGmailConnection() {
  await setAppSetting(GMAIL_SETTINGS_KEYS.tokens, '')
  await setAppSetting(GMAIL_SETTINGS_KEYS.email, '')
  await setAppSetting(GMAIL_SETTINGS_KEYS.connectedAt, '')
}

async function saveGmailOauthState(state) {
  await setAppSetting(GMAIL_SETTINGS_KEYS.oauthState, String(state || ''))
  await setAppSetting(GMAIL_SETTINGS_KEYS.oauthStateCreatedAt, String(Date.now()))
}

async function consumeAndValidateGmailOauthState(state) {
  const [expectedState, createdAtRaw] = await Promise.all([
    getAppSetting(GMAIL_SETTINGS_KEYS.oauthState),
    getAppSetting(GMAIL_SETTINGS_KEYS.oauthStateCreatedAt)
  ])
  await Promise.all([
    setAppSetting(GMAIL_SETTINGS_KEYS.oauthState, ''),
    setAppSetting(GMAIL_SETTINGS_KEYS.oauthStateCreatedAt, '')
  ])

  if (!expectedState || !state || state !== expectedState) return false

  const createdAt = Number(createdAtRaw || 0)
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false
  return (Date.now() - createdAt) <= (10 * 60 * 1000)
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

function csvEscape(value) {
  const raw = value == null ? '' : String(value)
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
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
app.use('/api', (req, res, next) => {
  const rule = req.path === '/login'
    ? { scope: 'login', limit: LOGIN_RATE_LIMIT, windowMs: LOGIN_RATE_LIMIT_WINDOW_MS }
    : { scope: 'api', limit: API_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }
  const result = checkRateLimit(req, rule)
  if (!result.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait and try again.' })
  }
  next()
})
app.use('/api', (req, res, next) => {
  if (!isMutatingMethod(req.method)) return next()
  const fullPath = `/api${req.path}`
  if (CSRF_EXEMPT_PATHS.has(fullPath)) return next()

  const sessionToken = req.cookies?.session
  if (!sessionToken) return next()

  const csrfCookie = String(req.cookies?.csrf_token || '')
  const csrfHeader = String(req.headers['x-csrf-token'] || '')
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'Security check failed. Refresh and try again.', code: 'CSRF_INVALID' })
  }
  next()
})
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, authMode: AUTH_MODE, deployVersion: DEPLOY_VERSION, now: new Date().toISOString() })
})

function isValidInternalToken(req, headerName, expectedToken) {
  const provided = String(req.headers[headerName] || '').trim()
  if (!provided || !expectedToken) return false

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expectedToken, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  next()
}

function requireStaffOrAdmin(req, res, next) {
  if (req.isAdmin || req.userRole === 'staff') return next()
  return res.status(403).json({ error: 'Staff access required' })
}

function requireJobSeeker(req, res, next) {
  if (req.userRole === 'job_seeker' && !req.isAdmin) return next()
  return res.status(403).json({ error: 'Job seeker access required' })
}

function dataScope(req) {
  return {
    organizationId: req.organizationId,
    userId: req.userId,
    role: req.userRole,
    isAdmin: req.isAdmin
  }
}

async function canAccessCandidate(req, candidateUserId) {
  const targetId = Number(candidateUserId)
  if (!targetId || !req.organizationId) return false
  const orgUsers = await listOrganizationUsers(req.organizationId)
  const candidate = orgUsers.find(u => Number(u.id) === targetId)
  if (!candidate || candidate.role !== 'job_seeker') return false
  if (req.isAdmin) return true
  if (req.userRole !== 'staff') return false
  return hasStaffAssignment({
    organizationId: req.organizationId,
    staffUserId: req.userId,
    jobSeekerUserId: targetId
  })
}

async function canAccessStaffTask(req, task) {
  if (!task || task.organizationId !== req.organizationId) return false
  if (req.isAdmin) return true
  if (req.userRole !== 'staff') return false
  return Number(task.assigneeUserId) === Number(req.userId)
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
    const membership = await getPrimaryMembershipForUser(session.user_id)
    req.userEmail = user?.email || null
    req.organizationId = membership?.organizationId || null
    req.userRole = membership?.role || (user?.isAdmin ? 'admin' : 'job_seeker')
    req.isAdmin = !!user?.isAdmin || req.userRole === 'admin'
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
  const csrfToken = generateCsrfToken()

  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  })
  setCsrfCookie(res, csrfToken)

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
  res.clearCookie('csrf_token')
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const onboarding = await getOnboardingStatus()
    const user = await getUserById(req.userId)
    res.json({
      ok: true,
      authMode: req.authMode,
      username: user?.username || null,
      email: req.userEmail || null,
      isAdmin: !!req.isAdmin,
      organizationId: req.organizationId,
      role: req.userRole || null,
      mustChangePassword: !!req.mustChangePassword,
      onboardingComplete: onboarding.onboardingComplete,
      displayName: onboarding.displayName
    })
  } catch (e) {
    console.error('me failed', e)
    res.status(500).json({ error: 'Could not load profile' })
  }
})

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await listOrganizationUsers(req.organizationId)
    res.json({ ok: true, users })
  } catch (e) {
    console.error('admin.users.list failed', e)
    res.status(500).json({ error: 'Could not list users' })
  }
})

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase()
    const password = String(req.body?.password || '').trim()
    const email = req.body?.email == null ? null : String(req.body.email).trim().toLowerCase()
    const role = String(req.body?.role || 'job_seeker').trim()

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 chars: letters, numbers, dot, dash, underscore' })
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'Temporary password must be at least 10 characters' })
    }

    const user = await createUserAccount({
      username,
      password,
      email,
      role,
      organizationId: req.organizationId,
      mustChangePassword: true
    })
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: user.id,
      action: 'admin.user.created',
      entityType: 'user',
      entityId: String(user.id),
      metadata: { username: user.username, role }
    })
    res.json({ ok: true, id: Number(user.id), username: user.username, role })
  } catch (e) {
    console.error('admin.users.create failed', e)
    if (String(e?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'That username or email is already taken' })
    }
    res.status(500).json({ error: 'Could not create user' })
  }
})

app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = Number(req.params.id)
    const role = String(req.body?.role || '').trim()
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Invalid target user' })
    }
    if (!['admin', 'staff', 'job_seeker'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    if (targetUserId === Number(req.userId) && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' })
    }
    const targetUser = await getUserById(targetUserId)
    if (!targetUser) return res.status(404).json({ error: 'User not found' })

    await updateOrganizationUserRole(targetUserId, req.organizationId, role)
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId,
      action: 'admin.user.role.updated',
      entityType: 'user',
      entityId: String(targetUserId),
      metadata: { username: targetUser.username, role }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('admin.users.role failed', e)
    res.status(500).json({ error: 'Could not update user role' })
  }
})

app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = Number(req.params.id)
    const password = String(req.body?.password || '').trim()
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Invalid target user' })
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'Temporary password must be at least 10 characters' })
    }
    const targetUser = await getUserById(targetUserId)
    if (!targetUser) return res.status(404).json({ error: 'User not found' })

    await adminSetUserPassword(targetUserId, password, { forceReset: true })
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId,
      action: 'admin.user.password.reset',
      entityType: 'user',
      entityId: String(targetUserId),
      metadata: { username: targetUser.username, forced: true }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('admin.users.resetPassword failed', e)
    res.status(500).json({ error: 'Could not reset password' })
  }
})

app.patch('/api/admin/users/:id/password-policy', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = Number(req.params.id)
    const mustChangePassword = !!req.body?.mustChangePassword
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Invalid target user' })
    }
    await adminSetMustChangePassword(targetUserId, mustChangePassword)
    const targetUser = await getUserById(targetUserId)
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId,
      action: 'admin.user.password_policy.updated',
      entityType: 'user',
      entityId: String(targetUserId),
      metadata: { username: targetUser?.username || null, mustChangePassword }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('admin.users.passwordPolicy failed', e)
    res.status(500).json({ error: 'Could not update password policy' })
  }
})

app.get('/api/admin/staff-assignments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const assignments = await listStaffAssignments(req.organizationId)
    res.json({ ok: true, assignments })
  } catch (e) {
    console.error('admin.staffAssignments.list failed', e)
    res.status(500).json({ error: 'Could not list staff assignments' })
  }
})

app.post('/api/admin/staff-assignments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const staffUserId = Number(req.body?.staffUserId)
    const jobSeekerUserId = Number(req.body?.jobSeekerUserId)
    const assignment = await createStaffAssignment({
      organizationId: req.organizationId,
      staffUserId,
      jobSeekerUserId
    })
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: jobSeekerUserId,
      action: 'admin.staff_assignment.created',
      entityType: 'staff_assignment',
      entityId: assignment.id,
      metadata: {
        staffUserId,
        jobSeekerUserId,
        staffUsername: assignment?.staffUsername || null,
        jobSeekerUsername: assignment?.jobSeekerUsername || null
      }
    })
    res.json({ ok: true, assignment })
  } catch (e) {
    console.error('admin.staffAssignments.create failed', e)
    const message = String(e?.message || '')
    if (message.includes('required') || message.includes('different') || message.includes('belong') || message.includes('staff') || message.includes('job_seeker')) {
      return res.status(400).json({ error: message })
    }
    res.status(500).json({ error: 'Could not create staff assignment' })
  }
})

app.delete('/api/admin/staff-assignments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const staffUserId = Number(req.body?.staffUserId)
    const jobSeekerUserId = Number(req.body?.jobSeekerUserId)
    const removed = await deleteStaffAssignment({
      organizationId: req.organizationId,
      staffUserId,
      jobSeekerUserId
    })
    if (!removed) {
      return res.status(404).json({ error: 'Staff assignment not found' })
    }
    const [staffUser, jobSeekerUser] = await Promise.all([
      getUserById(staffUserId),
      getUserById(jobSeekerUserId)
    ])
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: jobSeekerUserId,
      action: 'admin.staff_assignment.deleted',
      entityType: 'staff_assignment',
      entityId: `${req.organizationId}:${staffUserId}:${jobSeekerUserId}`,
      metadata: {
        staffUserId,
        jobSeekerUserId,
        staffUsername: staffUser?.username || null,
        jobSeekerUsername: jobSeekerUser?.username || null
      }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('admin.staffAssignments.delete failed', e)
    res.status(500).json({ error: 'Could not delete staff assignment' })
  }
})

app.get('/api/admin/audit-log', requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await getAuditLogs({ organizationId: req.organizationId, limit: req.query?.limit })
    res.json({ ok: true, logs })
  } catch (e) {
    console.error('admin.auditLog.list failed', e)
    res.status(500).json({ error: 'Could not list audit log' })
  }
})

app.get('/api/staff/assigned-users', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const users = req.isAdmin
      ? await listOrganizationUsers(req.organizationId)
      : await listAssignedUsersForStaff(req.userId, req.organizationId)
    res.json({ ok: true, users })
  } catch (e) {
    console.error('staff.assignedUsers failed', e)
    res.status(500).json({ error: 'Could not list assigned users' })
  }
})

app.get('/api/staff/queue', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const requestedScope = String(req.query?.scope || '').toLowerCase()
    const scope = req.isAdmin ? (requestedScope === 'assigned' ? 'assigned' : 'all') : 'assigned'
    const [orgUsers, recommendations, tasks, threads, allOrgUsers] = await Promise.all([
      (req.isAdmin && scope === 'all')
        ? listOrganizationUsers(req.organizationId)
        : listAssignedUsersForStaff(req.userId, req.organizationId),
      (req.isAdmin && scope === 'all')
        ? listJobRecommendations({ organizationId: req.organizationId, limit: 300 })
        : listJobRecommendations({ organizationId: req.organizationId, staffUserId: req.userId, limit: 300 }),
      (req.isAdmin && scope === 'all')
        ? listStaffTasks({ organizationId: req.organizationId, limit: 300 })
        : listStaffTasks({ organizationId: req.organizationId, assigneeUserId: req.userId, limit: 300 }),
      (req.isAdmin && scope === 'all')
        ? listCandidateThreadsByScope({ organizationId: req.organizationId, limit: 500 })
        : listCandidateThreadsByScope({ organizationId: req.organizationId, staffUserId: req.userId, limit: 500 }),
      (req.isAdmin && scope === 'assigned') ? listOrganizationUsers(req.organizationId) : Promise.resolve([])
    ])
    const candidates = (orgUsers || []).filter(u => u.role === 'job_seeker')
    const staffUsers = req.isAdmin
      ? ((scope === 'all' ? orgUsers : allOrgUsers) || []).filter(u => u.role === 'staff' || u.role === 'admin')
      : []

    const summary = {
      candidates: candidates.length,
      recommendationsDraft: recommendations.filter(r => r.status === 'draft').length,
      recommendationsPosted: recommendations.filter(r => r.status === 'posted').length,
      tasksTodo: tasks.filter(t => t.status === 'todo').length,
      tasksInProgress: tasks.filter(t => t.status === 'in_progress').length,
      threadsOpen: threads.filter(t => t.status === 'open').length,
      threadsStale48h: threads.filter(t => t.status === 'open' && (Date.now() - Number(t.updatedAt || 0)) > 48 * 60 * 60 * 1000).length,
      scope
    }

    const postedSinceByUser = new Map()
    for (const rec of recommendations) {
      if (rec.status !== 'posted') continue
      const uid = Number(rec.jobSeekerUserId)
      const ts = Number(rec.postedAt || rec.updatedAt || 0)
      const prev = postedSinceByUser.get(uid) || 0
      if (ts > prev) postedSinceByUser.set(uid, ts)
    }
    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000
    const candidateSignals = {}
    await Promise.all(candidates.map(async (candidate) => {
      const uid = Number(candidate.id)
      const dashboard = await getDashboardData({ organizationId: req.organizationId, userId: uid })
      const staleFollowUps = Number(dashboard?.health?.stale?.pipeline || 0) > 0
      const interviewActive = Number(dashboard?.upcomingInterviews?.length || 0) > 0 || Number(dashboard?.dueInterviewActions?.length || 0) > 0
      const lastDailyIso = (dashboard?.recentLogs || [])[0]?._lastEditedTime || null
      const lastDaily = lastDailyIso ? Date.parse(lastDailyIso) : 0
      const noRecentActivity = !lastDaily || (now - lastDaily) > sevenDaysMs
      const latestPosted = postedSinceByUser.get(uid) || 0
      const rrPostedRecently = !!latestPosted && (now - latestPosted) <= threeDaysMs
      candidateSignals[uid] = {
        staleFollowUps,
        interviewActive,
        noRecentActivity,
        rrPostedRecently,
        queueSize: Number(dashboard?.health?.queueSize || 0),
        staleTotal: Number(dashboard?.health?.staleTotal || 0),
        lastCheckInAt: lastDaily || null
      }
    }))
    const signalValues = Object.values(candidateSignals)
    summary.candidatesInterviewActive = signalValues.filter(s => s.interviewActive).length
    summary.candidatesStaleFollowUps = signalValues.filter(s => s.staleFollowUps).length
    summary.candidatesInactive7d = signalValues.filter(s => s.noRecentActivity).length
    summary.candidatesRrPosted72h = signalValues.filter(s => s.rrPostedRecently).length

    res.json({ ok: true, summary, candidates, staffUsers, recommendations, tasks, threads, candidateSignals })
  } catch (e) {
    console.error('staff.queue failed', e)
    res.status(500).json({ error: 'Could not load staff queue' })
  }
})

app.patch('/api/staff/threads/:threadId', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const thread = await getCandidateThreadById(req.params.threadId)
    if (!thread || thread.organizationId !== req.organizationId) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    if (!await canAccessCandidate(req, thread.jobSeekerUserId)) {
      return res.status(403).json({ error: 'Not allowed to update this thread' })
    }
    const status = String(req.body?.status || '').trim()
    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'status must be open or closed' })
    }
    const updated = await updateCandidateThreadStatus(thread.id, status)
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: thread.jobSeekerUserId,
      action: 'staff.thread.updated',
      entityType: 'candidate_thread',
      entityId: thread.id,
      metadata: { status: updated.status }
    })
    res.json({ ok: true, thread: updated })
  } catch (e) {
    console.error('staff.threads.update failed', e)
    res.status(500).json({ error: 'Could not update thread' })
  }
})


// Staff: create a job_seeker account and auto-assign to themselves
app.post('/api/staff/candidates', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase()
    const password = String(req.body?.password || '').trim()
    const email = req.body?.email == null ? null : String(req.body.email).trim().toLowerCase() || null
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–32 chars: letters, numbers, dot, dash, underscore' })
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'Temporary password must be at least 10 characters' })
    }
    const user = await createUserAccount({ username, password, email, role: 'job_seeker', organizationId: req.organizationId, mustChangePassword: true })
    await createStaffAssignment({ organizationId: req.organizationId, staffUserId: req.userId, jobSeekerUserId: user.id })
    await createAuditLog({ organizationId: req.organizationId, actorUserId: req.userId, targetUserId: user.id, action: 'staff.candidate.created', entityType: 'user', entityId: String(user.id), metadata: { username: user.username, role: 'job_seeker', autoAssigned: true } })
    res.json({ ok: true, id: Number(user.id), username: user.username })
  } catch (e) {
    console.error('staff.candidates.create failed', e)
    if (String(e?.message || '').includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'That username or email is already taken' })
    res.status(500).json({ error: 'Could not create candidate account' })
  }
})

// Staff: self-assign to an existing unassigned job_seeker in the org
app.post('/api/staff/self-assign', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const jobSeekerUserId = Number(req.body?.jobSeekerUserId)
    if (!jobSeekerUserId) return res.status(400).json({ error: 'jobSeekerUserId required' })
    const assignment = await createStaffAssignment({ organizationId: req.organizationId, staffUserId: req.userId, jobSeekerUserId })
    await createAuditLog({ organizationId: req.organizationId, actorUserId: req.userId, targetUserId: jobSeekerUserId, action: 'staff.self_assign', entityType: 'staff_assignment', entityId: assignment.id, metadata: { staffUserId: req.userId, jobSeekerUserId } })
    res.json({ ok: true, assignment })
  } catch (e) {
    console.error('staff.selfAssign failed', e)
    const msg = String(e?.message || '')
    if (msg.includes('required') || msg.includes('different') || msg.includes('belong') || msg.includes('staff') || msg.includes('job_seeker')) return res.status(400).json({ error: msg })
    res.status(500).json({ error: 'Could not create assignment' })
  }
})

// Staff: list unassigned job_seekers in the org (for self-assign picker)
app.get('/api/staff/unassigned-candidates', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const [allUsers, assignments] = await Promise.all([listOrganizationUsers(req.organizationId), listStaffAssignments(req.organizationId)])
    const assignedIds = new Set(assignments.map(a => String(a.jobSeekerUserId)))
    const unassigned = allUsers.filter(u => u.role === 'job_seeker' && !assignedIds.has(String(u.id)))
    res.json({ ok: true, candidates: unassigned })
  } catch (e) {
    console.error('staff.unassignedCandidates failed', e)
    res.status(500).json({ error: 'Could not list unassigned candidates' })
  }
})

app.post('/api/staff/recommendations', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const jobSeekerUserId = Number(req.body?.jobSeekerUserId)
    if (!jobSeekerUserId) return res.status(400).json({ error: 'jobSeekerUserId is required' })
    if (!await canAccessCandidate(req, jobSeekerUserId)) {
      return res.status(403).json({ error: 'Not allowed to post for this candidate' })
    }

    const company = String(req.body?.company || '').trim()
    if (!company) return res.status(400).json({ error: 'company is required' })

    const recommendation = await createJobRecommendation({
      organizationId: req.organizationId,
      staffUserId: req.userId,
      jobSeekerUserId,
      company,
      role: req.body?.role || null,
      jobUrl: req.body?.jobUrl || null,
      source: req.body?.source || null,
      fitNote: req.body?.fitNote || null,
      status: 'draft'
    })

    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: jobSeekerUserId,
      action: 'staff.recommendation.created',
      entityType: 'job_recommendation',
      entityId: recommendation.id,
      metadata: {
        company: recommendation.company,
        role: recommendation.role,
        jobUrl: recommendation.jobUrl
      }
    })

    res.json({ ok: true, recommendation })
  } catch (e) {
    console.error('staff.recommendations.create failed', e)
    res.status(500).json({ error: 'Could not create recommendation' })
  }
})

app.post('/api/staff/recommendations/:id/post-to-pipeline', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const recommendation = await getJobRecommendationById(req.params.id)
    if (!recommendation || recommendation.organizationId !== req.organizationId) {
      return res.status(404).json({ error: 'Recommendation not found' })
    }
    if (!await canAccessCandidate(req, recommendation.jobSeekerUserId)) {
      return res.status(403).json({ error: 'Not allowed to post for this candidate' })
    }
    if (recommendation.status === 'posted' || recommendation.postedPipelineEntryId) {
      return res.status(409).json({
        error: 'Recommendation already posted',
        recommendation,
        pipelineEntryId: recommendation.postedPipelineEntryId || null
      })
    }

    const pipelineEntry = await createPipelineEntry({
      Company: recommendation.company,
      Role: recommendation.role || '',
      Stage: 'Wishlist',
      'Job URL': recommendation.jobUrl || '',
      'Job Source': recommendation.source || '',
      Notes: recommendation.fitNote || '',
      Priority: 'Medium'
    }, {
      organizationId: req.organizationId,
      userId: recommendation.jobSeekerUserId
    })

    const notifyCandidate = req.body?.notifyCandidate !== false
    let notification = null
    if (notifyCandidate) {
      const topic = `New opportunity: ${recommendation.company}${recommendation.role ? ` — ${recommendation.role}` : ''}`
      const thread = await createCandidateThread({
        organizationId: req.organizationId,
        staffUserId: req.userId,
        jobSeekerUserId: recommendation.jobSeekerUserId,
        topic
      })
      const messageLines = [
        `I added a new role to your pipeline: ${recommendation.company}${recommendation.role ? ` — ${recommendation.role}` : ''}.`,
        recommendation.jobUrl ? `Job URL: ${recommendation.jobUrl}` : null,
        recommendation.fitNote ? `Why this might fit: ${recommendation.fitNote}` : null
      ].filter(Boolean)
      const message = await createCandidateMessage({
        threadId: thread.id,
        organizationId: req.organizationId,
        authorUserId: req.userId,
        visibility: 'shared_with_candidate',
        body: messageLines.join('\n')
      })
      notification = { threadId: thread.id, messageId: message.id }
    }

    const updated = await markRecommendationPosted(recommendation.id, pipelineEntry.id)
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: recommendation.jobSeekerUserId,
      action: 'staff.recommendation.posted',
      entityType: 'job_recommendation',
      entityId: recommendation.id,
      metadata: {
        recommendationId: recommendation.id,
        pipelineEntryId: pipelineEntry.id,
        company: recommendation.company,
        role: recommendation.role,
        candidateNotified: notifyCandidate
      }
    })

    res.json({ ok: true, recommendation: updated, pipelineEntryId: pipelineEntry.id, notification })
  } catch (e) {
    console.error('staff.recommendations.post failed', e)
    res.status(500).json({ error: 'Could not post recommendation to pipeline' })
  }
})

app.post('/api/staff/tasks', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const assigneeUserId = Number(req.body?.assigneeUserId || req.userId)
    const relatedUserId = req.body?.relatedUserId == null ? null : Number(req.body.relatedUserId)
    if (!assigneeUserId) return res.status(400).json({ error: 'assigneeUserId is required' })
    if (!req.isAdmin && assigneeUserId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Staff can only create tasks assigned to themselves' })
    }
    if (relatedUserId != null && !await canAccessCandidate(req, relatedUserId)) {
      return res.status(403).json({ error: 'Not allowed to create a task for this candidate' })
    }

    const task = await createStaffTask({
      organizationId: req.organizationId,
      assigneeUserId,
      relatedUserId,
      type: req.body?.type,
      priority: req.body?.priority,
      status: req.body?.status || 'todo',
      dueAt: req.body?.dueAt || null,
      notes: req.body?.notes || '',
      createdByUserId: req.userId
    })

    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: relatedUserId,
      action: 'staff.task.created',
      entityType: 'staff_task',
      entityId: task.id,
      metadata: {
        assigneeUserId,
        relatedUserId,
        type: task.type,
        priority: task.priority,
        status: task.status
      }
    })
    res.json({ ok: true, task })
  } catch (e) {
    console.error('staff.tasks.create failed', e)
    res.status(500).json({ error: 'Could not create staff task' })
  }
})

app.patch('/api/staff/tasks/:id', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const existing = await getStaffTaskById(req.params.id)
    if (!existing || existing.organizationId !== req.organizationId) {
      return res.status(404).json({ error: 'Task not found' })
    }
    if (!await canAccessStaffTask(req, existing)) {
      return res.status(403).json({ error: 'Not allowed to update this task' })
    }

    const patch = {}
    if (req.body?.status != null) patch.status = req.body.status
    if (req.body?.priority != null) patch.priority = req.body.priority
    if (req.body?.type != null) patch.type = req.body.type
    if (req.body?.notes != null) patch.notes = req.body.notes
    if (req.body?.dueAt !== undefined) patch.dueAt = req.body.dueAt

    if (req.isAdmin && req.body?.assigneeUserId != null) {
      patch.assigneeUserId = Number(req.body.assigneeUserId)
    }
    if (req.body?.relatedUserId !== undefined) {
      if (req.body.relatedUserId == null) {
        patch.relatedUserId = null
      } else {
        const relatedUserId = Number(req.body.relatedUserId)
        if (!await canAccessCandidate(req, relatedUserId)) {
          return res.status(403).json({ error: 'Not allowed to link this candidate' })
        }
        patch.relatedUserId = relatedUserId
      }
    }

    const task = await updateStaffTask(req.params.id, patch)
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: task.relatedUserId,
      action: 'staff.task.updated',
      entityType: 'staff_task',
      entityId: task.id,
      metadata: {
        status: task.status,
        priority: task.priority,
        type: task.type,
        assigneeUserId: task.assigneeUserId
      }
    })
    res.json({ ok: true, task })
  } catch (e) {
    console.error('staff.tasks.update failed', e)
    res.status(500).json({ error: 'Could not update staff task' })
  }
})

app.get('/api/staff/candidates/:candidateUserId/threads', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const candidateUserId = Number(req.params.candidateUserId)
    if (!candidateUserId) return res.status(400).json({ error: 'candidateUserId is required' })
    if (!await canAccessCandidate(req, candidateUserId)) {
      return res.status(403).json({ error: 'Not allowed to access this candidate' })
    }
    const threads = await listCandidateThreads({
      organizationId: req.organizationId,
      jobSeekerUserId: candidateUserId
    })
    res.json({ ok: true, threads })
  } catch (e) {
    console.error('staff.threads.list failed', e)
    res.status(500).json({ error: 'Could not list candidate threads' })
  }
})

app.post('/api/staff/candidates/:candidateUserId/threads', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const candidateUserId = Number(req.params.candidateUserId)
    const topic = String(req.body?.topic || '').trim()
    if (!candidateUserId) return res.status(400).json({ error: 'candidateUserId is required' })
    if (!topic) return res.status(400).json({ error: 'topic is required' })
    if (!await canAccessCandidate(req, candidateUserId)) {
      return res.status(403).json({ error: 'Not allowed to access this candidate' })
    }

    const thread = await createCandidateThread({
      organizationId: req.organizationId,
      jobSeekerUserId: candidateUserId,
      createdByUserId: req.userId,
      topic
    })

    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: candidateUserId,
      action: 'staff.thread.created',
      entityType: 'candidate_thread',
      entityId: thread.id,
      metadata: { topic: thread.topic }
    })

    res.json({ ok: true, thread })
  } catch (e) {
    console.error('staff.threads.create failed', e)
    res.status(500).json({ error: 'Could not create candidate thread' })
  }
})

app.get('/api/staff/candidates/:candidateUserId/support-summary', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const candidateUserId = Number(req.params.candidateUserId)
    if (!candidateUserId) return res.status(400).json({ error: 'candidateUserId is required' })
    if (!await canAccessCandidate(req, candidateUserId)) {
      return res.status(403).json({ error: 'Not allowed to view this candidate' })
    }

    const dashboard = await getDashboardData({ organizationId: req.organizationId, userId: candidateUserId })
    const recentLogs = dashboard?.recentLogs || []
    const lastLog = recentLogs[0] || null
    const lastCheckInIso = lastLog?._lastEditedTime || null
    const lastCheckInTs = lastCheckInIso ? Date.parse(lastCheckInIso) : null
    const supportSummary = {
      lastCheckInAt: Number.isFinite(lastCheckInTs) ? lastCheckInTs : null,
      lastCheckInDate: lastLog?.Date || null,
      queueSize: Number(dashboard?.health?.queueSize || 0),
      staleTotal: Number(dashboard?.health?.staleTotal || 0),
      duePipelineFollowUps: Number(dashboard?.duePipelineFollowUps?.length || 0),
      dueInterviewActions: Number(dashboard?.dueInterviewActions?.length || 0),
      upcomingInterviews: Number(dashboard?.upcomingInterviews?.length || 0),
      overdueContacts: Number(dashboard?.overdueContacts?.length || 0),
      topQueue: (dashboard?.todayQueue || []).slice(0, 3).map(item => ({
        id: item.id,
        title: item.title,
        route: item.route,
        type: item.type,
        dueDate: item.dueDate || null
      }))
    }

    res.json({ ok: true, supportSummary })
  } catch (e) {
    console.error('staff.candidate.supportSummary failed', e)
    res.status(500).json({ error: 'Could not load candidate support summary' })
  }
})

app.get('/api/staff/threads/:threadId/messages', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const thread = await getCandidateThreadById(req.params.threadId)
    if (!thread || thread.organizationId !== req.organizationId) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    if (!await canAccessCandidate(req, thread.jobSeekerUserId)) {
      return res.status(403).json({ error: 'Not allowed to access this thread' })
    }
    const messages = await listCandidateMessages(thread.id)
    res.json({ ok: true, thread, messages })
  } catch (e) {
    console.error('staff.messages.list failed', e)
    res.status(500).json({ error: 'Could not list thread messages' })
  }
})

app.patch('/api/staff/threads/:threadId', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const thread = await getCandidateThreadById(req.params.threadId)
    if (!thread || thread.organizationId !== req.organizationId) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    if (!await canAccessCandidate(req, thread.jobSeekerUserId)) {
      return res.status(403).json({ error: 'Not allowed to update this thread' })
    }
    const status = String(req.body?.status || '').trim()
    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'status must be open or closed' })
    }
    const updated = await updateCandidateThreadStatus(thread.id, status)
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: thread.jobSeekerUserId,
      action: 'staff.thread.updated',
      entityType: 'candidate_thread',
      entityId: thread.id,
      metadata: { status: updated.status }
    })
    res.json({ ok: true, thread: updated })
  } catch (e) {
    console.error('staff.threads.update failed', e)
    res.status(500).json({ error: 'Could not update thread' })
  }
})

app.post('/api/staff/threads/:threadId/messages', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const thread = await getCandidateThreadById(req.params.threadId)
    if (!thread || thread.organizationId !== req.organizationId) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    if (!await canAccessCandidate(req, thread.jobSeekerUserId)) {
      return res.status(403).json({ error: 'Not allowed to access this thread' })
    }
    if (thread.status === 'closed') {
      return res.status(409).json({ error: 'Thread is closed. Reopen it before sending a new message.' })
    }
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'message body is required' })

    const message = await createCandidateMessage({
      threadId: thread.id,
      organizationId: req.organizationId,
      authorUserId: req.userId,
      visibility: req.body?.visibility || 'shared_with_candidate',
      body
    })

    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: thread.jobSeekerUserId,
      action: 'staff.message.created',
      entityType: 'candidate_message',
      entityId: message.id,
      metadata: { threadId: thread.id, visibility: message.visibility }
    })

    res.json({ ok: true, message })
  } catch (e) {
    console.error('staff.messages.create failed', e)
    res.status(500).json({ error: 'Could not create message' })
  }
})

app.get('/api/member/threads', requireAuth, requireJobSeeker, async (req, res) => {
  try {
    const threads = await listCandidateThreadsForMember({
      organizationId: req.organizationId,
      jobSeekerUserId: req.userId,
      limit: 200
    })
    res.json({ ok: true, threads })
  } catch (e) {
    console.error('member.threads.list failed', e)
    res.status(500).json({ error: 'Could not list member threads' })
  }
})

app.get('/api/member/threads/:threadId/messages', requireAuth, requireJobSeeker, async (req, res) => {
  try {
    const thread = await getCandidateThreadById(req.params.threadId)
    if (!thread || thread.organizationId !== req.organizationId || Number(thread.jobSeekerUserId) !== Number(req.userId)) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    const messages = await listCandidateMessagesForMember(thread.id, req.userId, 500)
    res.json({ ok: true, thread, messages })
  } catch (e) {
    console.error('member.messages.list failed', e)
    res.status(500).json({ error: 'Could not list thread messages' })
  }
})

app.post('/api/member/threads/:threadId/messages', requireAuth, requireJobSeeker, async (req, res) => {
  try {
    const thread = await getCandidateThreadById(req.params.threadId)
    if (!thread || thread.organizationId !== req.organizationId || Number(thread.jobSeekerUserId) !== Number(req.userId)) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    if (thread.status === 'closed') {
      return res.status(409).json({ error: 'Thread is closed.' })
    }
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'message body is required' })
    const message = await createCandidateMessage({
      threadId: thread.id,
      organizationId: req.organizationId,
      authorUserId: req.userId,
      visibility: 'shared_with_candidate',
      body
    })
    await createAuditLog({
      organizationId: req.organizationId,
      actorUserId: req.userId,
      targetUserId: req.userId,
      action: 'member.message.created',
      entityType: 'candidate_message',
      entityId: message.id,
      metadata: { threadId: thread.id }
    })
    res.json({ ok: true, message })
  } catch (e) {
    console.error('member.messages.create failed', e)
    res.status(500).json({ error: 'Could not create message' })
  }
})

app.get('/api/csrf', requireAuth, (_req, res) => {
  const token = generateCsrfToken()
  setCsrfCookie(res, token)
  res.json({ ok: true, token })
})

app.get('/api/setup/status', requireAuth, async (_req, res) => {
  try {
    const onboarding = await getOnboardingStatus()
    res.json({ ok: true, ...onboarding })
  } catch (e) {
    console.error('setup.status failed', e)
    res.status(500).json({ error: 'Could not load setup status' })
  }
})

app.post('/api/setup/complete', requireAuth, async (req, res) => {
  try {
    const displayName = String(req.body?.displayName || '').trim()
    const nextUsernameRaw = req.body?.username
    const nextUsername = nextUsernameRaw == null ? '' : String(nextUsernameRaw).trim().toLowerCase()
    if (!displayName) {
      return res.status(400).json({ error: 'Display name is required' })
    }
    if (nextUsernameRaw != null) {
      if (!nextUsername) return res.status(400).json({ error: 'Username is required' })
      if (!/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
        return res.status(400).json({ error: 'Username must be 3-32 chars: letters, numbers, dot, dash, underscore' })
      }
      await updateUsername(req.userId, nextUsername)
    }
    await setAppSetting(APP_SETTINGS_KEYS.displayName, displayName)
    await setAppSetting(APP_SETTINGS_KEYS.onboardingComplete, 'true')
    const updatedUser = await getUserById(req.userId)
    res.json({ ok: true, onboardingComplete: true, displayName, username: updatedUser?.username || null })
  } catch (e) {
    console.error('setup.complete failed', e)
    if (String(e?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'That username is already taken' })
    }
    res.status(500).json({ error: 'Could not complete setup' })
  }
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
    const data = await getDashboardData(dataScope(req))
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Pipeline ──────────────────────────────────────────────────────────────────

app.get('/api/pipeline', requireAuth, async (req, res) => {
  try {
    res.json(await getPipeline(dataScope(req)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/pipeline/:id/stage', requireAuth, async (req, res) => {
  try {
    const nextStage = String(req.body.stage || '')
    const scope = dataScope(req)
    await updatePipelineStage(req.params.id, nextStage, scope)

    let interviewAutoCreated = false
    let nextActionAutoUpdated = false
    if (nextStage) {
      const result = await ensureInterviewForPipelineStage(req.params.id, nextStage, scope)
      interviewAutoCreated = !!result?.created
      const actionResult = await applyPipelineStageAutomation(req.params.id, nextStage, scope)
      nextActionAutoUpdated = !!actionResult?.updated
    }

    res.json({ ok: true, interviewAutoCreated, nextActionAutoUpdated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/pipeline/:id/followup', requireAuth, async (req, res) => {
  try {
    await updatePipelineFollowUp(req.params.id, req.body.date, dataScope(req))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/pipeline/:id', requireAuth, async (req, res) => {
  try {
    const scope = dataScope(req)
    await updatePipelineEntry(req.params.id, req.body, scope)
    let interviewAutoCreated = false
    let nextActionAutoUpdated = false
    if (req.body?.Stage) {
      const result = await ensureInterviewForPipelineStage(req.params.id, req.body.Stage, scope)
      interviewAutoCreated = !!result?.created
      const actionResult = await applyPipelineStageAutomation(req.params.id, req.body.Stage, scope)
      nextActionAutoUpdated = !!actionResult?.updated
    }
    res.json({ ok: true, interviewAutoCreated, nextActionAutoUpdated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/pipeline', requireAuth, async (req, res) => {
  try {
    const scope = dataScope(req)
    const page = await createPipelineEntry(req.body, scope)
    let interviewAutoCreated = false
    let nextActionAutoUpdated = false
    if (req.body?.Stage) {
      const result = await ensureInterviewForPipelineStage(page.id, req.body.Stage, scope)
      interviewAutoCreated = !!result?.created
      const actionResult = await applyPipelineStageAutomation(page.id, req.body.Stage, scope)
      nextActionAutoUpdated = !!actionResult?.updated
    }
    res.json({ ok: true, id: page.id, interviewAutoCreated, nextActionAutoUpdated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Contacts ──────────────────────────────────────────────────────────────────

app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    res.json(await getContacts(dataScope(req)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/contacts/:id/contacted', requireAuth, async (req, res) => {
  try {
    await markContacted(req.params.id, req.body.nextFollowUp, dataScope(req))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/contacts/:id/status', requireAuth, async (req, res) => {
  try {
    await updateContactStatus(req.params.id, req.body.status, dataScope(req))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    await updateContact(req.params.id, req.body, dataScope(req))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    const page = await createContact(req.body, dataScope(req))
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Interviews ────────────────────────────────────────────────────────────────

app.get('/api/interviews', requireAuth, async (req, res) => {
  try {
    res.json(await getInterviews(dataScope(req)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/interviews', requireAuth, async (req, res) => {
  try {
    const page = await createInterview(req.body, dataScope(req))
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/interviews/:id', requireAuth, async (req, res) => {
  try {
    await updateInterview(req.params.id, req.body, dataScope(req))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/interviews/reconcile', requireAuth, async (req, res) => {
  try {
    const result = await backfillInterviewsFromPipeline(dataScope(req))
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error('interviews.reconcile failed', e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Events ────────────────────────────────────────────────────────────────────

app.get('/api/events', requireAuth, async (req, res) => {
  try {
    res.json(await getEvents(dataScope(req)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/events', requireAuth, async (req, res) => {
  try {
    const page = await createEvent(req.body, dataScope(req))
    res.json({ ok: true, id: page.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/events/:id', requireAuth, async (req, res) => {
  try {
    await updateEvent(req.params.id, req.body, dataScope(req))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Templates ─────────────────────────────────────────────────────────────────

app.get('/api/templates', requireAuth, async (req, res) => {
  try { res.json(await getTemplates(dataScope(req))) } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/templates', requireAuth, async (req, res) => {
  try {
    const page = await createTemplate(req.body, dataScope(req))
    res.json({ ok: true, id: page.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/templates/:id', requireAuth, async (req, res) => {
  try { await updateTemplate(req.params.id, req.body, dataScope(req)); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Watchlist ─────────────────────────────────────────────────────────────────

app.get('/api/watchlist', requireAuth, async (req, res) => {
  try { res.json(await getWatchlist(dataScope(req))) } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/watchlist', requireAuth, async (req, res) => {
  try {
    const page = await createWatchlistEntry(req.body, dataScope(req))
    res.json({ ok: true, id: page.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/watchlist/:id', requireAuth, async (req, res) => {
  try { await updateWatchlistEntry(req.params.id, req.body, dataScope(req)); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Daily Log ─────────────────────────────────────────────────────────────────

app.get('/api/daily', requireAuth, async (req, res) => {
  try {
    res.json(await getDailyLogs(30, dataScope(req)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/daily/today', requireAuth, async (req, res) => {
  try {
    const dateLabel = typeof req.query?.date_label === 'string' ? req.query.date_label : undefined
    res.json(await getTodayLog(dateLabel, dataScope(req)))
  } catch (e) {
    console.error('daily.today failed', e)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/daily', requireAuth, async (req, res) => {
  try {
    const page = await createDailyLog(req.body, dataScope(req))
    res.json({ ok: true, id: page.id })
  } catch (e) {
    console.error('daily.create failed', e)
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/daily/:id', requireAuth, async (req, res) => {
  try {
    await updateDailyLog(req.params.id, req.body, dataScope(req))
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

app.get('/api/sheets/schema-check', requireAuth, async (_req, res) => {
  try {
    const overrides = await getSheetsConfigOverrides()
    const report = await getSheetsSchemaReport(overrides)
    res.json(report)
  } catch (e) {
    const normalized = normalizeSheetsSyncError(e.normalized || e)
    res.status(normalized.status || 500).json({
      error: normalized.userMessage || 'Could not run schema check',
      code: normalized.code || 'SYNC_UNKNOWN',
      fixSteps: normalized.fixSteps || [],
      details: normalized.details
    })
  }
})

app.post('/api/sheets/sync', requireAuth, async (req, res) => {
  try {
    const overrides = await getSheetsConfigOverrides()
    const result = await runSheetsSync(overrides, dataScope(req))
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
  if (!isValidInternalToken(req, 'x-sync-token', SHEETS_SYNC_CRON_TOKEN)) {
    return res.status(401).json({ error: 'Invalid sync token' })
  }

  try {
    await initDb()
    const serviceUser = await getUserByUsername(String(process.env.SHEETS_SYNC_USERNAME || process.env.DEFAULT_USERNAME || 'jason').trim().toLowerCase())
    if (!serviceUser) {
      return res.status(503).json({ error: 'No service user available for scheduled Sheets sync' })
    }
    const membership = await getPrimaryMembershipForUser(serviceUser.id)
    const scope = {
      organizationId: membership?.organizationId,
      userId: serviceUser.id,
      role: membership?.role || (serviceUser.isAdmin ? 'admin' : 'job_seeker'),
      isAdmin: !!serviceUser.isAdmin
    }
    const overrides = await getSheetsConfigOverrides()
    const result = await runSheetsSync(overrides, scope)
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

app.post('/api/internal/backup/export', async (req, res) => {
  if (!BACKUP_EXPORT_CRON_TOKEN) {
    return res.status(503).json({ error: 'BACKUP_EXPORT_CRON_TOKEN is not configured' })
  }
  if (!BACKUP_GCS_BUCKET) {
    return res.status(503).json({ error: 'BACKUP_GCS_BUCKET is not configured' })
  }
  if (!isValidInternalToken(req, 'x-backup-token', BACKUP_EXPORT_CRON_TOKEN)) {
    return res.status(401).json({ error: 'Invalid backup token' })
  }

  try {
    const snapshot = await exportBackupSnapshot()
    const payload = JSON.stringify(snapshot, null, 2)
    const iso = new Date().toISOString().replace(/[:.]/g, '-')
    const prefix = BACKUP_GCS_PREFIX.replace(/^\/+|\/+$/g, '')
    const objectName = `${prefix ? `${prefix}/` : ''}backup-${iso}.json`

    const storage = new Storage()
    const file = storage.bucket(BACKUP_GCS_BUCKET).file(objectName)
    await file.save(payload, {
      resumable: false,
      contentType: 'application/json; charset=utf-8',
      metadata: { cacheControl: 'no-store' }
    })

    res.json({
      ok: true,
      exportedAt: snapshot.exportedAt,
      bucket: BACKUP_GCS_BUCKET,
      objectName,
      bytes: Buffer.byteLength(payload, 'utf8')
    })
  } catch (e) {
    console.error('internal.backup.export failed', e)
    res.status(500).json({ error: 'Could not export backup to Cloud Storage' })
  }
})

app.post('/api/internal/cost/snapshot', async (req, res) => {
  if (!isValidInternalToken(req, 'x-cost-token', COST_SNAPSHOT_CRON_TOKEN)) {
    return res.status(401).json({ error: 'Invalid cost snapshot token' })
  }
  try {
    const source = String(req.body?.source || 'scheduler')
    const summaryText = String(req.body?.summaryText || '').trim()
    if (!summaryText) return res.status(400).json({ error: 'summaryText is required' })
    await createCostSnapshot({ source, summaryText })
    res.json({ ok: true })
  } catch (e) {
    console.error('internal.cost.snapshot failed', e)
    res.status(500).json({ error: 'Could not store cost snapshot' })
  }
})

app.get('/api/admin/cost-snapshots', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20))
    const snapshots = await getRecentCostSnapshots(limit)
    res.json({ snapshots })
  } catch (e) {
    console.error('admin.cost-snapshots failed', e)
    res.status(500).json({ error: 'Could not load cost snapshots' })
  }
})

app.post('/api/admin/cost-snapshots/run', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../scripts/cost-snapshot.sh')
    const { stdout } = await execFileAsync('bash', [scriptPath], {
      env: {
        ...process.env,
        PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || ''
      },
      maxBuffer: 1024 * 1024
    })
    const summaryText = String(stdout || '').trim()
    if (!summaryText) {
      return res.status(500).json({ error: 'Cost snapshot script returned no output' })
    }
    await createCostSnapshot({ source: 'manual-admin', summaryText })
    res.json({ ok: true })
  } catch (e) {
    console.error('admin.cost-snapshots.run failed', e)
    res.status(500).json({
      error: 'Could not run cost snapshot here. Run `npm run ops:cost:snapshot` in an environment with gcloud and post to internal endpoint.'
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
    const localLastSavedAt = await getLocalDataLastUpdatedAt()
    const googleLastSyncedAt = formattedRuns.find(run => run.status === 'ok')?.createdAt || null
    const summaryByDirection = {}
    for (const run of formattedRuns) {
      if (summaryByDirection[run.direction]) continue
      summaryByDirection[run.direction] = {
        status: run.status,
        createdAt: run.createdAt,
        summary: run.summary || null
      }
    }

    res.json({
      ok: true,
      config,
      freshness: {
        localLastSavedAt,
        googleLastSyncedAt
      },
      entities: {
        pipeline: summaryByDirection.outbound || null,
        contacts: summaryByDirection.contacts || null,
        interviews: summaryByDirection.interviews || null,
        events: summaryByDirection.events || null
      },
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

app.get('/api/sheets/sync/logs.csv', requireAuth, async (_req, res) => {
  try {
    const runs = await getRecentSheetSyncRuns(200)
    const rows = runs.map(row => {
      const createdAtIso = new Date(Number(row.created_at)).toISOString()
      let summary = ''
      try {
        summary = row.summary_json ? JSON.stringify(JSON.parse(String(row.summary_json))) : ''
      } catch {
        summary = row.summary_json ? String(row.summary_json) : ''
      }
      return [
        row.id,
        row.direction,
        row.status,
        createdAtIso,
        row.error_text || '',
        summary
      ].map(csvEscape).join(',')
    })
    const csv = [
      ['id', 'direction', 'status', 'createdAt', 'errorText', 'summaryJson'].join(','),
      ...rows
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=\"sync-logs-${new Date().toISOString().slice(0, 10)}.csv\"`)
    res.send(csv)
  } catch (e) {
    console.error('sheets.sync.logs.csv failed', e)
    res.status(500).json({ error: 'Could not export sync logs' })
  }
})

// ─── Gmail Event Import ───────────────────────────────────────────────────────

app.get('/api/gmail/status', requireAuth, async (_req, res) => {
  try {
    const config = getGmailIntegrationConfig()
    const connection = await getGmailConnection()
    res.json({
      ok: true,
      configured: config.configured,
      connected: !!connection.tokens,
      email: connection.email,
      connectedAt: connection.connectedAt,
      query: config.query
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/gmail/auth-url', requireAuth, async (_req, res) => {
  try {
    const state = crypto.randomBytes(24).toString('hex')
    await saveGmailOauthState(state)
    const { url } = buildGmailAuthUrl(state)
    res.json({ ok: true, url })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get('/api/gmail/oauth/callback', requireAuth, async (req, res) => {
  try {
    const code = String(req.query?.code || '').trim()
    const state = String(req.query?.state || '').trim()
    if (!code) return res.status(400).send('Missing OAuth code')
    const stateValid = await consumeAndValidateGmailOauthState(state)
    if (!stateValid) return res.status(400).send('Invalid OAuth state. Start Gmail connect again from Settings.')

    const { tokens, email } = await exchangeGmailCode(code)
    await setGmailConnection({ tokens, email })
    return res.redirect('/?settings=gmail-connected')
  } catch (e) {
    console.error('gmail.oauth.callback failed', e)
    return res.status(500).send(`Gmail connection failed: ${e.message}`)
  }
})

app.post('/api/gmail/disconnect', requireAuth, async (_req, res) => {
  try {
    await clearGmailConnection()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/gmail/import-events', requireAuth, async (req, res) => {
  try {
    const connection = await getGmailConnection()
    if (!connection.tokens) {
      return res.status(400).json({ error: 'Gmail is not connected yet.' })
    }

    const maxMessages = Number(req.body?.maxMessages || 40)
    const imported = await importEventsFromGmail({ tokens: connection.tokens, maxMessages })
    await setGmailConnection({ tokens: imported.tokens, email: connection.email })

    let created = 0
    let deduped = 0
    const scope = dataScope(req)
    for (const event of imported.events) {
      const existing = await getEventBySourceKey(event.sourceKey, scope)
      if (existing) {
        deduped += 1
        continue
      }
      await createEvent({
        Name: event.name,
        Date: event.date,
        Status: 'Planned',
        'Registration Link': event.registrationLink,
        Notes: event.notes,
        'Source Key': event.sourceKey
      }, scope)
      created += 1
    }

    res.json({
      ok: true,
      detected: imported.events.length,
      created,
      deduped
    })
  } catch (e) {
    console.error('gmail.import-events failed', e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Admin Backup ─────────────────────────────────────────────────────────────

app.get('/api/admin/backup/export', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const snapshot = await exportBackupSnapshot()
    res.json(snapshot)
  } catch (e) {
    console.error('backup.export failed', e)
    res.status(500).json({ error: 'Could not export backup' })
  }
})

app.get('/api/admin/backup/export-db', requireAuth, requireAdmin, async (_req, res) => {
  let tempDir = null
  let cleaned = false
  const cleanup = async () => {
    if (cleaned || !tempDir) return
    cleaned = true
    await rm(tempDir, { recursive: true, force: true })
  }

  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'job-hunt-db-export-'))
    const snapshotPath = path.join(tempDir, `backup-${Date.now()}.db`)
    await createLocalDatabaseSnapshot(snapshotPath)

    res.setHeader('Content-Type', 'application/x-sqlite3')
    res.setHeader('Content-Disposition', `attachment; filename=\"job-hunt-backup-${new Date().toISOString().slice(0, 10)}.db\"`)
    res.on('finish', () => {
      cleanup().catch(err => console.error('backup.export-db cleanup failed', err))
    })
    res.on('close', () => {
      cleanup().catch(err => console.error('backup.export-db cleanup failed', err))
    })
    res.sendFile(snapshotPath)
  } catch (e) {
    await cleanup().catch(() => {})
    console.error('backup.export-db failed', e)
    const msg = String(e?.message || '')
    if (msg.includes('local SQLite mode')) return res.status(400).json({ error: msg })
    if (msg.includes('database file not found')) return res.status(404).json({ error: msg })
    res.status(500).json({ error: 'Could not export database file' })
  }
})

app.post('/api/admin/backup/restore', requireAuth, requireAdmin, async (req, res) => {
  try {
    const snapshot = req.body?.snapshot ?? req.body
    await restoreBackupSnapshot(snapshot)
    res.json({ ok: true })
  } catch (e) {
    console.error('backup.restore failed', e)
    res.status(400).json({ error: e.message || 'Could not restore backup' })
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
