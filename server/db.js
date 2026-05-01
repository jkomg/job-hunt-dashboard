import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
  { id: 'interview_readiness', label: '1) Interview Readiness', route: 'interviews' },
  { id: 'follow_ups_due', label: '2) Follow-Ups Due', route: 'pipeline' },
  { id: 'pipeline_momentum', label: '3) Pipeline Momentum', route: 'pipeline' },
  { id: 'networking_consistency', label: '4) Networking Consistency', route: 'contacts' },
  { id: 'application_throughput', label: '5) Application Throughput', route: 'pipeline' },
  { id: 'events_market_presence', label: '6) Events & Market Presence', route: 'events' }
]

const BACKUP_TABLES = [
  'schema_migrations',
  'organizations',
  'memberships',
  'staff_assignments',
  'job_recommendations',
  'staff_tasks',
  'candidate_threads',
  'candidate_messages',
  'audit_log',
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

const DEFAULT_ORG_ID = 'remote-rebellion'
const DEFAULT_ORG_NAME = 'Remote Rebellion'
const USER_OWNED_TABLES = [
  'daily_logs',
  'pipeline_entries',
  'contacts',
  'interviews',
  'events',
  'templates',
  'watchlist'
]

async function getTableColumnSet(table) {
  const res = await db.execute(`PRAGMA table_info(${table})`)
  return new Set((res.rows || []).map(r => String(r.name || '').toLowerCase()))
}

async function getUserColumns() {
  return getTableColumnSet('users')
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
  const pipelineCols = await getTableColumnSet('pipeline_entries')
  if (!pipelineCols.has('next_action')) {
    await db.execute('ALTER TABLE pipeline_entries ADD COLUMN next_action TEXT')
  }
  if (!pipelineCols.has('next_action_date')) {
    await db.execute('ALTER TABLE pipeline_entries ADD COLUMN next_action_date TEXT')
  }
  if (!pipelineCols.has('cover_letter')) {
    await db.execute('ALTER TABLE pipeline_entries ADD COLUMN cover_letter TEXT')
  }
  if (!pipelineCols.has('application_contacts_json')) {
    await db.execute('ALTER TABLE pipeline_entries ADD COLUMN application_contacts_json TEXT')
  }

  const contactCols = await getTableColumnSet('contacts')
  if (!contactCols.has('next_action')) {
    await db.execute('ALTER TABLE contacts ADD COLUMN next_action TEXT')
  }
  if (!contactCols.has('next_action_date')) {
    await db.execute('ALTER TABLE contacts ADD COLUMN next_action_date TEXT')
  }

  const interviewCols = await getTableColumnSet('interviews')
  if (!interviewCols.has('next_action')) {
    await db.execute('ALTER TABLE interviews ADD COLUMN next_action TEXT')
  }
  if (!interviewCols.has('next_action_date')) {
    await db.execute('ALTER TABLE interviews ADD COLUMN next_action_date TEXT')
  }
}

async function ensureTenantSchema() {
  await db.batch([
    `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS memberships (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(organization_id, user_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS staff_assignments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        staff_user_id INTEGER NOT NULL,
        job_seeker_user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(organization_id, staff_user_id, job_seeker_user_id)
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        actor_user_id INTEGER,
        target_user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        metadata_json TEXT,
        created_at INTEGER NOT NULL
      )
    `
  ])

  const ts = now()
  await db.execute({
    sql: `
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        updated_at = excluded.updated_at
    `,
    args: [DEFAULT_ORG_ID, DEFAULT_ORG_NAME, DEFAULT_ORG_ID, ts, ts]
  })

  for (const table of USER_OWNED_TABLES) {
    const columns = await getTableColumnSet(table)
    if (!columns.has('organization_id')) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN organization_id TEXT`)
    }
    if (!columns.has('user_id')) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`)
    }
    await db.execute(`CREATE INDEX IF NOT EXISTS ${table}_tenant_user_idx ON ${table}(organization_id, user_id)`)
  }

  await backfillDefaultOrganizationMemberships()
  await backfillTenantOwnership()
}

async function ensureStaffOpsSchema() {
  await db.batch([
    `
      CREATE TABLE IF NOT EXISTS job_recommendations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        staff_user_id INTEGER NOT NULL,
        job_seeker_user_id INTEGER NOT NULL,
        company TEXT NOT NULL,
        role TEXT,
        job_url TEXT,
        source TEXT,
        fit_note TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        posted_pipeline_entry_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS staff_tasks (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        assignee_user_id INTEGER NOT NULL,
        related_user_id INTEGER,
        type TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'todo',
        due_at INTEGER,
        notes TEXT,
        created_by_user_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS candidate_threads (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        job_seeker_user_id INTEGER NOT NULL,
        created_by_user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS candidate_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        author_user_id INTEGER NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'shared_with_candidate',
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `
  ])

  await db.execute('CREATE INDEX IF NOT EXISTS job_recommendations_org_staff_idx ON job_recommendations(organization_id, staff_user_id, updated_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS job_recommendations_org_seeker_idx ON job_recommendations(organization_id, job_seeker_user_id, updated_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS staff_tasks_org_assignee_idx ON staff_tasks(organization_id, assignee_user_id, status, due_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS candidate_threads_org_user_idx ON candidate_threads(organization_id, job_seeker_user_id, updated_at)')
  await db.execute('CREATE INDEX IF NOT EXISTS candidate_messages_thread_idx ON candidate_messages(thread_id, created_at)')
}

async function getDefaultUserId() {
  const res = await db.execute('SELECT id FROM users ORDER BY is_admin DESC, id ASC LIMIT 1')
  const row = firstRow(res)
  return row?.id == null ? null : Number(row.id)
}

async function backfillDefaultOrganizationMemberships() {
  const res = await db.execute('SELECT id, is_admin FROM users')
  for (const row of res.rows || []) {
    const existing = await db.execute({
      sql: 'SELECT id FROM memberships WHERE user_id = ? LIMIT 1',
      args: [Number(row.id)]
    })
    if (firstRow(existing)) continue
    await ensureUserMembership(Number(row.id), {
      organizationId: DEFAULT_ORG_ID,
      role: Number(row.is_admin || 0) === 1 ? 'admin' : 'job_seeker'
    })
  }
}

async function backfillTenantOwnership() {
  const defaultUserId = await getDefaultUserId()
  if (!defaultUserId) return

  for (const table of USER_OWNED_TABLES) {
    await db.execute({
      sql: `UPDATE ${table} SET organization_id = ? WHERE organization_id IS NULL OR organization_id = ''`,
      args: [DEFAULT_ORG_ID]
    })
    await db.execute({
      sql: `UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`,
      args: [defaultUserId]
    })
  }
}

async function listAppliedMigrations() {
  const res = await db.execute('SELECT id FROM schema_migrations')
  return new Set((res.rows || []).map(r => String(r.id)))
}

async function markMigrationApplied(id, description) {
  await db.execute({
    sql: `
      INSERT INTO schema_migrations (id, description, applied_at)
      VALUES (?, ?, ?)
    `,
    args: [String(id), String(description || ''), now()]
  })
}

async function runMigrations() {
  const applied = await listAppliedMigrations()
  const migrations = [
    { id: '2026-04-24-001-user-schema', description: 'users email/admin/password-change fields', up: ensureUserSchema },
    { id: '2026-04-24-002-interview-schema', description: 'interview pipeline link + index', up: ensureInterviewSchema },
    { id: '2026-04-24-003-event-schema', description: 'event source key + index', up: ensureEventSchema },
    { id: '2026-04-24-004-action-schema', description: 'next action fields across entities', up: ensureActionSchema },
    { id: '2026-04-29-001-tenant-schema', description: 'organizations memberships and user-owned record scope', up: ensureTenantSchema },
    { id: '2026-04-30-001-staff-ops-schema', description: 'staff recommendations and tasks tables', up: ensureStaffOpsSchema },
    { id: '2026-04-30-002-candidate-messaging-schema', description: 'candidate thread and message tables', up: ensureStaffOpsSchema },
    { id: '2026-05-01-001-pipeline-contacts-schema', description: 'pipeline multi-contact JSON field', up: ensureActionSchema }
  ]

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue
    await migration.up()
    await markMigrationApplied(migration.id, migration.description)
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

function toMembership(row) {
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: Number(row.user_id),
    role: row.role
  }
}

function toOrganizationUser(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email || null,
    isAdmin: Number(row.is_admin || 0) === 1,
    mustChangePassword: Number(row.must_change_password || 0) === 1,
    organizationId: row.organization_id,
    role: row.role,
    createdAt: row.membership_created_at || null
  }
}

function toStaffAssignment(row) {
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organization_id,
    staffUserId: Number(row.staff_user_id),
    jobSeekerUserId: Number(row.job_seeker_user_id),
    staffUsername: row.staff_username || null,
    jobSeekerUsername: row.job_seeker_username || null,
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0)
  }
}

function toAuditLog(row) {
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id == null ? null : Number(row.actor_user_id),
    targetUserId: row.target_user_id == null ? null : Number(row.target_user_id),
    action: row.action,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    metadata: parseJsonSafe(row.metadata_json, {}),
    createdAt: Number(row.created_at || 0)
  }
}

function toJobRecommendation(row) {
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organization_id,
    staffUserId: Number(row.staff_user_id),
    jobSeekerUserId: Number(row.job_seeker_user_id),
    company: row.company || '',
    role: row.role || '',
    jobUrl: row.job_url || '',
    source: row.source || '',
    fitNote: row.fit_note || '',
    status: row.status || 'draft',
    postedPipelineEntryId: row.posted_pipeline_entry_id || null,
    staffUsername: row.staff_username || null,
    jobSeekerUsername: row.job_seeker_username || null,
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0)
  }
}

function toStaffTask(row) {
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organization_id,
    assigneeUserId: Number(row.assignee_user_id),
    relatedUserId: row.related_user_id == null ? null : Number(row.related_user_id),
    type: row.type,
    priority: row.priority || 'normal',
    status: row.status || 'todo',
    dueAt: row.due_at == null ? null : Number(row.due_at),
    notes: row.notes || '',
    createdByUserId: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
    assigneeUsername: row.assignee_username || null,
    relatedUsername: row.related_username || null,
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0)
  }
}

function toCandidateThread(row) {
  if (!row) return null
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobSeekerUserId: Number(row.job_seeker_user_id),
    createdByUserId: Number(row.created_by_user_id),
    topic: row.topic || '',
    status: row.status || 'open',
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
    createdByUsername: row.created_by_username || null,
    jobSeekerUsername: row.job_seeker_username || null
  }
}

function toCandidateMessage(row) {
  if (!row) return null
  return {
    id: row.id,
    threadId: row.thread_id,
    organizationId: row.organization_id,
    authorUserId: Number(row.author_user_id),
    visibility: row.visibility || 'shared_with_candidate',
    body: row.body || '',
    createdAt: Number(row.created_at || 0),
    authorUsername: row.author_username || null
  }
}

function parseJsonSafe(raw, fallback = null) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function ensureUserMembership(userId, { organizationId = DEFAULT_ORG_ID, role = 'job_seeker' } = {}) {
  if (!userId) return null
  const ts = now()
  const membershipId = `${organizationId}:${userId}`
  await db.execute({
    sql: `
      INSERT INTO memberships (id, organization_id, user_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        role = CASE
          WHEN memberships.role = 'admin' THEN memberships.role
          ELSE excluded.role
        END,
        updated_at = excluded.updated_at
    `,
    args: [membershipId, organizationId, Number(userId), role, ts, ts]
  })

  const res = await db.execute({
    sql: 'SELECT * FROM memberships WHERE organization_id = ? AND user_id = ? LIMIT 1',
    args: [organizationId, Number(userId)]
  })
  return toMembership(firstRow(res))
}

export async function getPrimaryMembershipForUser(userId) {
  if (!userId) return null
  const res = await db.execute({
    sql: `
      SELECT * FROM memberships
      WHERE user_id = ?
      ORDER BY
        CASE role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END,
        created_at ASC
      LIMIT 1
    `,
    args: [Number(userId)]
  })
  return toMembership(firstRow(res)) || ensureUserMembership(userId)
}

export async function listOrganizationUsers(organizationId = DEFAULT_ORG_ID) {
  const res = await db.execute({
    sql: `
      SELECT
        u.id,
        u.username,
        u.email,
        u.is_admin,
        u.must_change_password,
        m.organization_id,
        m.role,
        m.created_at AS membership_created_at
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ?
      ORDER BY
        CASE m.role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END,
        u.username ASC
    `,
    args: [String(organizationId)]
  })
  return toPlainRows(res).map(toOrganizationUser)
}

export async function listAssignedUsersForStaff(staffUserId, organizationId = DEFAULT_ORG_ID) {
  const res = await db.execute({
    sql: `
      SELECT
        u.id,
        u.username,
        u.email,
        u.is_admin,
        u.must_change_password,
        m.organization_id,
        m.role,
        m.created_at AS membership_created_at
      FROM staff_assignments sa
      JOIN users u ON u.id = sa.job_seeker_user_id
      JOIN memberships m ON m.user_id = u.id AND m.organization_id = sa.organization_id
      WHERE sa.organization_id = ? AND sa.staff_user_id = ?
      ORDER BY u.username ASC
    `,
    args: [String(organizationId), Number(staffUserId)]
  })
  return toPlainRows(res).map(toOrganizationUser)
}

export async function listStaffAssignments(organizationId = DEFAULT_ORG_ID) {
  const res = await db.execute({
    sql: `
      SELECT
        sa.*,
        staff.username AS staff_username,
        seeker.username AS job_seeker_username
      FROM staff_assignments sa
      JOIN users staff ON staff.id = sa.staff_user_id
      JOIN users seeker ON seeker.id = sa.job_seeker_user_id
      WHERE sa.organization_id = ?
      ORDER BY sa.created_at DESC
    `,
    args: [String(organizationId)]
  })
  return toPlainRows(res).map(toStaffAssignment)
}

export async function createStaffAssignment({ organizationId = DEFAULT_ORG_ID, staffUserId, jobSeekerUserId }) {
  const orgId = String(organizationId)
  const staffId = Number(staffUserId)
  const seekerId = Number(jobSeekerUserId)
  if (!staffId || !seekerId) throw new Error('staffUserId and jobSeekerUserId are required')
  if (staffId === seekerId) throw new Error('staff and job seeker must be different users')

  const staffMembership = await getMembership(orgId, staffId)
  const seekerMembership = await getMembership(orgId, seekerId)
  if (!staffMembership || !seekerMembership) throw new Error('Both users must belong to the organization')
  if (!['staff', 'admin'].includes(staffMembership.role)) throw new Error('Assigned staff user must have staff or admin role')
  if (seekerMembership.role !== 'job_seeker') throw new Error('Assigned user must have job_seeker role')

  const ts = now()
  const id = `${orgId}:${staffId}:${seekerId}`
  await db.execute({
    sql: `
      INSERT INTO staff_assignments (id, organization_id, staff_user_id, job_seeker_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id, staff_user_id, job_seeker_user_id) DO UPDATE SET
        updated_at = excluded.updated_at
    `,
    args: [id, orgId, staffId, seekerId, ts, ts]
  })
  return getStaffAssignment(orgId, staffId, seekerId)
}

export async function deleteStaffAssignment({ organizationId = DEFAULT_ORG_ID, staffUserId, jobSeekerUserId }) {
  const res = await db.execute({
    sql: 'DELETE FROM staff_assignments WHERE organization_id = ? AND staff_user_id = ? AND job_seeker_user_id = ?',
    args: [String(organizationId), Number(staffUserId), Number(jobSeekerUserId)]
  })
  return Number(res.rowsAffected || 0) > 0
}

export async function createAuditLog({
  organizationId = DEFAULT_ORG_ID,
  actorUserId = null,
  targetUserId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = null
} = {}) {
  if (!action) throw new Error('audit action is required')
  const id = crypto.randomUUID()
  await db.execute({
    sql: `
      INSERT INTO audit_log (
        id, organization_id, actor_user_id, target_user_id, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      String(organizationId),
      actorUserId == null ? null : Number(actorUserId),
      targetUserId == null ? null : Number(targetUserId),
      String(action),
      entityType == null ? null : String(entityType),
      entityId == null ? null : String(entityId),
      metadata == null ? null : JSON.stringify(metadata),
      now()
    ]
  })
  return { id }
}

export async function getAuditLogs({ organizationId = DEFAULT_ORG_ID, limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100))
  const res = await db.execute({
    sql: `
      SELECT * FROM audit_log
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [String(organizationId), safeLimit]
  })
  return toPlainRows(res).map(toAuditLog)
}

export async function hasStaffAssignment({ organizationId = DEFAULT_ORG_ID, staffUserId, jobSeekerUserId }) {
  const res = await db.execute({
    sql: `
      SELECT id FROM staff_assignments
      WHERE organization_id = ? AND staff_user_id = ? AND job_seeker_user_id = ?
      LIMIT 1
    `,
    args: [String(organizationId), Number(staffUserId), Number(jobSeekerUserId)]
  })
  return !!firstRow(res)
}

export async function listJobRecommendations({
  organizationId = DEFAULT_ORG_ID,
  staffUserId = null,
  jobSeekerUserId = null,
  limit = 200
} = {}) {
  const clauses = ['jr.organization_id = ?']
  const args = [String(organizationId)]
  if (staffUserId != null) {
    clauses.push('jr.staff_user_id = ?')
    args.push(Number(staffUserId))
  }
  if (jobSeekerUserId != null) {
    clauses.push('jr.job_seeker_user_id = ?')
    args.push(Number(jobSeekerUserId))
  }
  args.push(Math.max(1, Math.min(500, Number(limit) || 200)))

  const res = await db.execute({
    sql: `
      SELECT
        jr.*,
        staff.username AS staff_username,
        seeker.username AS job_seeker_username
      FROM job_recommendations jr
      JOIN users staff ON staff.id = jr.staff_user_id
      JOIN users seeker ON seeker.id = jr.job_seeker_user_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY jr.updated_at DESC
      LIMIT ?
    `,
    args
  })
  return toPlainRows(res).map(toJobRecommendation)
}

export async function getJobRecommendationById(id) {
  const res = await db.execute({
    sql: `
      SELECT
        jr.*,
        staff.username AS staff_username,
        seeker.username AS job_seeker_username
      FROM job_recommendations jr
      JOIN users staff ON staff.id = jr.staff_user_id
      JOIN users seeker ON seeker.id = jr.job_seeker_user_id
      WHERE jr.id = ?
      LIMIT 1
    `,
    args: [String(id)]
  })
  return toJobRecommendation(firstRow(res))
}

export async function createJobRecommendation({
  organizationId = DEFAULT_ORG_ID,
  staffUserId,
  jobSeekerUserId,
  company,
  role = null,
  jobUrl = null,
  source = null,
  fitNote = null,
  status = 'draft'
} = {}) {
  const ts = now()
  const id = crypto.randomUUID()
  await db.execute({
    sql: `
      INSERT INTO job_recommendations (
        id, organization_id, staff_user_id, job_seeker_user_id, company, role, job_url, source, fit_note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      String(organizationId),
      Number(staffUserId),
      Number(jobSeekerUserId),
      String(company || '').trim(),
      role == null ? null : String(role).trim(),
      jobUrl == null ? null : String(jobUrl).trim(),
      source == null ? null : String(source).trim(),
      fitNote == null ? null : String(fitNote).trim(),
      String(status || 'draft'),
      ts,
      ts
    ]
  })
  return getJobRecommendationById(id)
}

export async function markRecommendationPosted(id, pipelineEntryId) {
  await db.execute({
    sql: `
      UPDATE job_recommendations
      SET status = 'posted',
          posted_pipeline_entry_id = ?,
          updated_at = ?
      WHERE id = ?
    `,
    args: [String(pipelineEntryId), now(), String(id)]
  })
  return getJobRecommendationById(id)
}

export async function listStaffTasks({
  organizationId = DEFAULT_ORG_ID,
  assigneeUserId = null,
  limit = 200
} = {}) {
  const clauses = ['t.organization_id = ?']
  const args = [String(organizationId)]
  if (assigneeUserId != null) {
    clauses.push('t.assignee_user_id = ?')
    args.push(Number(assigneeUserId))
  }
  args.push(Math.max(1, Math.min(500, Number(limit) || 200)))

  const res = await db.execute({
    sql: `
      SELECT
        t.*,
        a.username AS assignee_username,
        r.username AS related_username
      FROM staff_tasks t
      JOIN users a ON a.id = t.assignee_user_id
      LEFT JOIN users r ON r.id = t.related_user_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY
        CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        COALESCE(t.due_at, t.updated_at) ASC
      LIMIT ?
    `,
    args
  })
  return toPlainRows(res).map(toStaffTask)
}

export async function listCandidateThreads({
  organizationId = DEFAULT_ORG_ID,
  jobSeekerUserId,
  limit = 100
} = {}) {
  const res = await db.execute({
    sql: `
      SELECT
        t.*,
        c.username AS created_by_username,
        j.username AS job_seeker_username
      FROM candidate_threads t
      JOIN users c ON c.id = t.created_by_user_id
      JOIN users j ON j.id = t.job_seeker_user_id
      WHERE t.organization_id = ? AND t.job_seeker_user_id = ?
      ORDER BY t.updated_at DESC
      LIMIT ?
    `,
    args: [String(organizationId), Number(jobSeekerUserId), Math.max(1, Math.min(500, Number(limit) || 100))]
  })
  return toPlainRows(res).map(toCandidateThread)
}

export async function listCandidateThreadsForMember({
  organizationId = DEFAULT_ORG_ID,
  jobSeekerUserId,
  limit = 200
} = {}) {
  return listCandidateThreads({ organizationId, jobSeekerUserId, limit })
}

export async function listCandidateThreadsByScope({
  organizationId = DEFAULT_ORG_ID,
  staffUserId = null,
  limit = 500
} = {}) {
  const args = [String(organizationId)]
  let where = 't.organization_id = ?'
  if (staffUserId != null) {
    where += ' AND EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.organization_id = t.organization_id AND sa.staff_user_id = ? AND sa.job_seeker_user_id = t.job_seeker_user_id)'
    args.push(Number(staffUserId))
  }
  args.push(Math.max(1, Math.min(2000, Number(limit) || 500)))
  const res = await db.execute({
    sql: `
      SELECT
        t.*,
        c.username AS created_by_username,
        j.username AS job_seeker_username
      FROM candidate_threads t
      JOIN users c ON c.id = t.created_by_user_id
      JOIN users j ON j.id = t.job_seeker_user_id
      WHERE ${where}
      ORDER BY t.updated_at DESC
      LIMIT ?
    `,
    args
  })
  return toPlainRows(res).map(toCandidateThread)
}

export async function getCandidateThreadById(id) {
  const res = await db.execute({
    sql: `
      SELECT
        t.*,
        c.username AS created_by_username,
        j.username AS job_seeker_username
      FROM candidate_threads t
      JOIN users c ON c.id = t.created_by_user_id
      JOIN users j ON j.id = t.job_seeker_user_id
      WHERE t.id = ?
      LIMIT 1
    `,
    args: [String(id)]
  })
  return toCandidateThread(firstRow(res))
}

export async function createCandidateThread({
  organizationId = DEFAULT_ORG_ID,
  jobSeekerUserId,
  createdByUserId,
  topic
} = {}) {
  const ts = now()
  const id = crypto.randomUUID()
  await db.execute({
    sql: `
      INSERT INTO candidate_threads (
        id, organization_id, job_seeker_user_id, created_by_user_id, topic, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `,
    args: [id, String(organizationId), Number(jobSeekerUserId), Number(createdByUserId), String(topic || '').trim(), ts, ts]
  })
  return getCandidateThreadById(id)
}

export async function updateCandidateThreadStatus(id, status = 'open') {
  const safeStatus = ['open', 'closed'].includes(String(status)) ? String(status) : 'open'
  await db.execute({
    sql: 'UPDATE candidate_threads SET status = ?, updated_at = ? WHERE id = ?',
    args: [safeStatus, now(), String(id)]
  })
  return getCandidateThreadById(id)
}

export async function listCandidateMessages(threadId, limit = 200) {
  const res = await db.execute({
    sql: `
      SELECT
        m.*,
        u.username AS author_username
      FROM candidate_messages m
      JOIN users u ON u.id = m.author_user_id
      WHERE m.thread_id = ?
      ORDER BY m.created_at ASC
      LIMIT ?
    `,
    args: [String(threadId), Math.max(1, Math.min(1000, Number(limit) || 200))]
  })
  return toPlainRows(res).map(toCandidateMessage)
}

export async function listCandidateMessagesForMember(threadId, jobSeekerUserId, limit = 200) {
  const res = await db.execute({
    sql: `
      SELECT
        m.*,
        u.username AS author_username
      FROM candidate_messages m
      JOIN users u ON u.id = m.author_user_id
      JOIN candidate_threads t ON t.id = m.thread_id
      WHERE m.thread_id = ?
        AND t.job_seeker_user_id = ?
        AND (m.visibility = 'shared_with_candidate' OR m.author_user_id = ?)
      ORDER BY m.created_at ASC
      LIMIT ?
    `,
    args: [String(threadId), Number(jobSeekerUserId), Number(jobSeekerUserId), Math.max(1, Math.min(1000, Number(limit) || 200))]
  })
  return toPlainRows(res).map(toCandidateMessage)
}

export async function createCandidateMessage({
  threadId,
  organizationId = DEFAULT_ORG_ID,
  authorUserId,
  visibility = 'shared_with_candidate',
  body
} = {}) {
  const safeVisibility = ['shared_with_candidate', 'internal_staff'].includes(String(visibility))
    ? String(visibility)
    : 'shared_with_candidate'
  const id = crypto.randomUUID()
  const ts = now()
  await db.execute({
    sql: `
      INSERT INTO candidate_messages (
        id, thread_id, organization_id, author_user_id, visibility, body, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, String(threadId), String(organizationId), Number(authorUserId), safeVisibility, String(body || '').trim(), ts]
  })
  await db.execute({
    sql: 'UPDATE candidate_threads SET updated_at = ? WHERE id = ?',
    args: [ts, String(threadId)]
  })
  const created = await db.execute({
    sql: `
      SELECT
        m.*,
        u.username AS author_username
      FROM candidate_messages m
      JOIN users u ON u.id = m.author_user_id
      WHERE m.id = ?
      LIMIT 1
    `,
    args: [id]
  })
  return toCandidateMessage(firstRow(created))
}

export async function getStaffTaskById(id) {
  const res = await db.execute({
    sql: `
      SELECT
        t.*,
        a.username AS assignee_username,
        r.username AS related_username
      FROM staff_tasks t
      JOIN users a ON a.id = t.assignee_user_id
      LEFT JOIN users r ON r.id = t.related_user_id
      WHERE t.id = ?
      LIMIT 1
    `,
    args: [String(id)]
  })
  return toStaffTask(firstRow(res))
}

export async function createStaffTask({
  organizationId = DEFAULT_ORG_ID,
  assigneeUserId,
  relatedUserId = null,
  type = 'admin',
  priority = 'normal',
  status = 'todo',
  dueAt = null,
  notes = '',
  createdByUserId = null
} = {}) {
  const safeType = ['research', 'follow_up', 'interview_prep', 'admin'].includes(String(type)) ? String(type) : 'admin'
  const safePriority = ['low', 'normal', 'high', 'urgent'].includes(String(priority)) ? String(priority) : 'normal'
  const safeStatus = ['todo', 'in_progress', 'done'].includes(String(status)) ? String(status) : 'todo'
  const id = crypto.randomUUID()
  const ts = now()
  await db.execute({
    sql: `
      INSERT INTO staff_tasks (
        id, organization_id, assignee_user_id, related_user_id, type, priority, status, due_at, notes, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      String(organizationId),
      Number(assigneeUserId),
      relatedUserId == null ? null : Number(relatedUserId),
      safeType,
      safePriority,
      safeStatus,
      dueAt == null ? null : Number(dueAt),
      String(notes || ''),
      createdByUserId == null ? null : Number(createdByUserId),
      ts,
      ts
    ]
  })
  return getStaffTaskById(id)
}

export async function updateStaffTask(id, data = {}) {
  const set = []
  const args = []
  function put(column, value) {
    set.push(`${column} = ?`)
    args.push(value)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'assigneeUserId')) {
    put('assignee_user_id', Number(data.assigneeUserId))
  }
  if (Object.prototype.hasOwnProperty.call(data, 'relatedUserId')) {
    put('related_user_id', data.relatedUserId == null ? null : Number(data.relatedUserId))
  }
  if (Object.prototype.hasOwnProperty.call(data, 'type')) {
    const safeType = ['research', 'follow_up', 'interview_prep', 'admin'].includes(String(data.type)) ? String(data.type) : 'admin'
    put('type', safeType)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'priority')) {
    const safePriority = ['low', 'normal', 'high', 'urgent'].includes(String(data.priority)) ? String(data.priority) : 'normal'
    put('priority', safePriority)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const safeStatus = ['todo', 'in_progress', 'done'].includes(String(data.status)) ? String(data.status) : 'todo'
    put('status', safeStatus)
  }
  if (Object.prototype.hasOwnProperty.call(data, 'dueAt')) {
    put('due_at', data.dueAt == null ? null : Number(data.dueAt))
  }
  if (Object.prototype.hasOwnProperty.call(data, 'notes')) {
    put('notes', String(data.notes || ''))
  }
  if (!set.length) return getStaffTaskById(id)

  set.push('updated_at = ?')
  args.push(now())
  args.push(String(id))
  await db.execute({
    sql: `UPDATE staff_tasks SET ${set.join(', ')} WHERE id = ?`,
    args
  })
  return getStaffTaskById(id)
}

async function getMembership(organizationId, userId) {
  const res = await db.execute({
    sql: 'SELECT * FROM memberships WHERE organization_id = ? AND user_id = ? LIMIT 1',
    args: [String(organizationId), Number(userId)]
  })
  return toMembership(firstRow(res))
}

async function getStaffAssignment(organizationId, staffUserId, jobSeekerUserId) {
  const res = await db.execute({
    sql: `
      SELECT
        sa.*,
        staff.username AS staff_username,
        seeker.username AS job_seeker_username
      FROM staff_assignments sa
      JOIN users staff ON staff.id = sa.staff_user_id
      JOIN users seeker ON seeker.id = sa.job_seeker_user_id
      WHERE sa.organization_id = ? AND sa.staff_user_id = ? AND sa.job_seeker_user_id = ?
      LIMIT 1
    `,
    args: [String(organizationId), Number(staffUserId), Number(jobSeekerUserId)]
  })
  return toStaffAssignment(firstRow(res))
}

async function resolveDataScope(scope = {}) {
  if (scope?.organizationId && scope?.userId) {
    return {
      organizationId: String(scope.organizationId),
      userId: Number(scope.userId)
    }
  }
  throw new Error('Tenant data scope is required')
}

async function scopedOwnerWhere(scope, prefix = '') {
  const resolved = await resolveDataScope(scope)
  const columnPrefix = prefix ? `${prefix}.` : ''
  return {
    ...resolved,
    clause: `${columnPrefix}organization_id = ? AND ${columnPrefix}user_id = ?`,
    args: [resolved.organizationId, resolved.userId]
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
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        description TEXT,
        applied_at INTEGER NOT NULL
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
        cover_letter TEXT,
        application_contacts_json TEXT,
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

  await runMigrations()

  const seedUsername = String(process.env.DEFAULT_USERNAME || 'jason').trim().toLowerCase() || 'jason'
  const userCountRes = await db.execute('SELECT COUNT(*) AS count FROM users')
  const userCount = Number(firstRow(userCountRes)?.count || 0)

  if (userCount === 0) {
    const seedPassword = String(process.env.DEFAULT_PASSWORD || 'jobhunt2026')
    const hash = bcrypt.hashSync(seedPassword, 10)
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES (?, ?, ?, ?)',
      args: [seedUsername, hash, 1, 1]
    })
    console.log(`Default user created: ${seedUsername}`)
  }

  await backfillDefaultOrganizationMemberships()
  await backfillTenantOwnership()

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
  const contacts = parseJsonSafe(row.application_contacts_json, [])
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
    'Cover Letter': row.cover_letter || '',
    'Application Contacts': Array.isArray(contacts) ? contacts : [],
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

export async function createUserAccount({
  username,
  password,
  email = null,
  role = 'job_seeker',
  organizationId = DEFAULT_ORG_ID,
  mustChangePassword = true
} = {}) {
  const normalizedUsername = String(username || '').trim().toLowerCase()
  const rawPassword = String(password || '')
  const normalizedEmail = normalizeEmail(email) || null
  const safeRole = ['admin', 'staff', 'job_seeker'].includes(String(role)) ? String(role) : 'job_seeker'

  if (!normalizedUsername || !rawPassword) {
    throw new Error('username and password are required')
  }

  const hash = bcrypt.hashSync(rawPassword, 10)
  await db.execute({
    sql: `
      INSERT INTO users (username, password_hash, email, is_admin, must_change_password)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [normalizedUsername, hash, normalizedEmail, safeRole === 'admin' ? 1 : 0, mustChangePassword ? 1 : 0]
  })

  const user = await getUserByUsername(normalizedUsername)
  await ensureUserMembership(user.id, { organizationId, role: safeRole })
  return user
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

export async function updateUsername(userId, nextUsername) {
  const normalized = String(nextUsername || '').trim().toLowerCase()
  if (!normalized) throw new Error('Username is required')
  await db.execute({
    sql: 'UPDATE users SET username = ? WHERE id = ?',
    args: [normalized, userId]
  })
  return getUserById(userId)
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

export async function getLocalDataLastUpdatedAt() {
  const tables = ['daily_logs', 'pipeline_entries', 'contacts', 'interviews', 'events', 'templates', 'watchlist']
  let latest = 0
  for (const table of tables) {
    const res = await db.execute(`SELECT MAX(updated_at) AS max_ts FROM ${table}`)
    const value = Number(firstRow(res)?.max_ts || 0)
    if (value > latest) latest = value
  }
  return latest > 0 ? new Date(latest).toISOString() : null
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

export function getLocalDatabaseFilePath() {
  const rawUrl = String(DATABASE_URL || '').trim()
  if (!rawUrl.startsWith('file:')) return null

  if (rawUrl.startsWith('file://')) {
    try {
      return fileURLToPath(rawUrl)
    } catch {
      return null
    }
  }

  const filePart = rawUrl.slice('file:'.length)
  if (!filePart) return null
  return path.resolve(process.cwd(), filePart)
}

export async function createLocalDatabaseSnapshot(snapshotPath) {
  const localDbPath = getLocalDatabaseFilePath()
  if (!localDbPath) {
    throw new Error('Raw .db export is only available in local SQLite mode.')
  }
  if (!existsSync(localDbPath)) {
    throw new Error('Local database file not found.')
  }

  const outPath = path.resolve(String(snapshotPath || '').trim())
  if (!outPath) {
    throw new Error('Snapshot path is required')
  }

  const escapedPath = outPath.replace(/'/g, "''")
  await db.execute(`VACUUM INTO '${escapedPath}'`)
  return outPath
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

export async function getDailyLogs(limit = 30, scope = {}) {
  const safeLimit = Math.max(1, Math.min(365, Number(limit) || 30))
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM daily_logs
      WHERE ${owner.clause}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [...owner.args, safeLimit]
  })
  return toPlainRows(res).map(dailyRowToRecord)
}

export async function getTodayLog(dateLabel = todayLabel(), scope = {}) {
  const targetDateLabel = String(dateLabel || '').trim() || todayLabel()
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM daily_logs
      WHERE date_label = ? AND ${owner.clause}
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    args: [targetDateLabel, ...owner.args]
  })
  return dailyRowToRecord(firstRow(res))
}

export async function getRecentLogs(n = 8, scope = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(n) || 8))
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM daily_logs
      WHERE ${owner.clause}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [...owner.args, safeLimit]
  })
  return toPlainRows(res).map(dailyRowToRecord)
}

export async function createDailyLog(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)

  await db.execute({
    sql: `
      INSERT INTO daily_logs (
        id, date_label, mindset, energy, outreach_sent, responses_received, applications_submitted,
        conversations_calls, linkedin_posts, volunteer_activity, exercise, cert_progress, win_of_day,
        gratitude_reflection, tomorrow_top3, organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })

  return { id }
}

export async function updateDailyLog(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE daily_logs SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function getPipeline(scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM pipeline_entries
      WHERE ${owner.clause}
      ORDER BY stage ASC, created_at DESC
    `,
    args: owner.args
  })
  return toPlainRows(res).map(pipelineRowToRecord)
}

export async function getPipelineEntryById(id, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `SELECT * FROM pipeline_entries WHERE id = ? AND ${owner.clause} LIMIT 1`,
    args: [String(id), ...owner.args]
  })
  return pipelineRowToRecord(firstRow(res))
}

export async function createPipelineEntry(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)

  const contactsRaw = Array.isArray(data['Application Contacts']) ? data['Application Contacts'] : []
  const contacts = contactsRaw
    .slice(0, 3)
    .map((c) => ({
      name: String(c?.name || '').trim(),
      title: String(c?.title || '').trim(),
      email: String(c?.email || '').trim(),
      linkedinUrl: String(c?.linkedinUrl || '').trim(),
      note: String(c?.note || '').trim()
    }))
    .filter((c) => c.name || c.title || c.email || c.linkedinUrl || c.note)

  await db.execute({
    sql: `
      INSERT INTO pipeline_entries (
        id, company, role, stage, priority, sector, job_source, job_url, salary_range,
        date_applied, follow_up_date, contact_name, contact_title, outreach_method, resume_version,
        company_address, company_phone, notes, research_notes, filed_for_unemployment, outcome,
        resume_url, cover_letter, application_contacts_json, work_location, next_action, next_action_date, organization_id, user_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data['Cover Letter'] || null,
      contacts.length ? JSON.stringify(contacts) : null,
      data['Work Location'] || null,
      data['Next Action'] || null,
      data['Next Action Date'] || null,
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })

  return { id }
}

export async function updatePipelineEntry(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  setIfPresent('cover_letter', data['Cover Letter'] === undefined ? undefined : (data['Cover Letter'] || null))
  if (data['Application Contacts'] !== undefined) {
    const contactsRaw = Array.isArray(data['Application Contacts']) ? data['Application Contacts'] : []
    const contacts = contactsRaw
      .slice(0, 3)
      .map((c) => ({
        name: String(c?.name || '').trim(),
        title: String(c?.title || '').trim(),
        email: String(c?.email || '').trim(),
        linkedinUrl: String(c?.linkedinUrl || '').trim(),
        note: String(c?.note || '').trim()
      }))
      .filter((c) => c.name || c.title || c.email || c.linkedinUrl || c.note)
    setIfPresent('application_contacts_json', contacts.length ? JSON.stringify(contacts) : null)
  }
  setIfPresent('work_location', data['Work Location'] === undefined ? undefined : (data['Work Location'] || null))
  setIfPresent('next_action', data['Next Action'] === undefined ? undefined : (data['Next Action'] || null))
  setIfPresent('next_action_date', data['Next Action Date'] === undefined ? undefined : (data['Next Action Date'] || null))

  updates.push('updated_at = ?')
  args.push(now())
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE pipeline_entries SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function updatePipelineStage(id, stage, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  await db.execute({
    sql: `UPDATE pipeline_entries SET stage = ?, updated_at = ? WHERE id = ? AND ${owner.clause}`,
    args: [stage, now(), String(id), ...owner.args]
  })
}

const INTERVIEW_TRIGGER_STAGES = new Set(['📞 Interview Scheduled', '🎯 Interviewing'])

export async function ensureInterviewForPipelineStage(pipelineId, stageOverride = null, scope = {}) {
  const owner = await resolveDataScope(scope)
  const pipeline = await getPipelineEntryById(pipelineId, owner)
  if (!pipeline) return { created: false, reason: 'pipeline_not_found' }

  const stage = stageOverride || pipeline.Stage
  if (!INTERVIEW_TRIGGER_STAGES.has(stage)) {
    return { created: false, reason: 'not_interview_stage' }
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM interviews WHERE pipeline_entry_id = ? AND organization_id = ? AND user_id = ? LIMIT 1',
    args: [String(pipeline.id), owner.organizationId, owner.userId]
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
        questions_asked, feedback_received, follow_up_sent, notes, pipeline_entry_id, next_action, next_action_date,
        organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      owner.organizationId,
      owner.userId,
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

export async function applyPipelineStageAutomation(pipelineId, stageOverride = null, scope = {}) {
  const pipeline = await getPipelineEntryById(pipelineId, scope)
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

  await updatePipelineEntry(pipelineId, updates, scope)
  return { updated: true, updates }
}

export async function backfillInterviewsFromPipeline(scope = {}) {
  const pipeline = await getPipeline(scope)
  let created = 0
  let alreadyExists = 0
  let skipped = 0

  for (const item of pipeline) {
    if (!INTERVIEW_TRIGGER_STAGES.has(item.Stage)) {
      skipped += 1
      continue
    }
    const result = await ensureInterviewForPipelineStage(item.id, item.Stage, scope)
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

export async function updatePipelineFollowUp(id, date, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  await db.execute({
    sql: `UPDATE pipeline_entries SET follow_up_date = ?, updated_at = ? WHERE id = ? AND ${owner.clause}`,
    args: [date || null, now(), String(id), ...owner.args]
  })
}

export async function countPipelineEntries() {
  const res = await db.execute('SELECT COUNT(*) AS count FROM pipeline_entries')
  return Number(firstRow(res)?.count || 0)
}

export async function getContacts(scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM contacts
      WHERE ${owner.clause}
      ORDER BY
        CASE WHEN next_follow_up IS NULL OR next_follow_up = '' THEN 1 ELSE 0 END,
        next_follow_up ASC,
        created_at DESC
    `,
    args: owner.args
  })
  return toPlainRows(res).map(contactRowToRecord)
}

export async function getOverdueFollowUps(scope = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM contacts
      WHERE
        ${owner.clause}
        AND
        next_follow_up IS NOT NULL
        AND next_follow_up != ''
        AND next_follow_up <= ?
        AND status IN ('Need to reach out', 'Waiting on response', 'In conversation')
      ORDER BY next_follow_up ASC, updated_at DESC
    `,
    args: [...owner.args, today]
  })
  return toPlainRows(res).map(contactRowToRecord)
}

export async function markContacted(id, nextFollowUp, scope = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const owner = await scopedOwnerWhere(scope)
  if (nextFollowUp) {
    await db.execute({
      sql: `UPDATE contacts SET last_contact = ?, status = ?, next_follow_up = ?, updated_at = ? WHERE id = ? AND ${owner.clause}`,
      args: [today, 'Waiting on response', nextFollowUp, now(), String(id), ...owner.args]
    })
    return
  }
  await db.execute({
    sql: `UPDATE contacts SET last_contact = ?, status = ?, updated_at = ? WHERE id = ? AND ${owner.clause}`,
    args: [today, 'Waiting on response', now(), String(id), ...owner.args]
  })
}

export async function updateContactStatus(id, status, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  await db.execute({
    sql: `UPDATE contacts SET status = ?, updated_at = ? WHERE id = ? AND ${owner.clause}`,
    args: [status || '', now(), String(id), ...owner.args]
  })
}

export async function createContact(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)
  await db.execute({
    sql: `
      INSERT INTO contacts (
        id, name, title, company, email, phone, warmth, status, how_we_know_each_other,
        linkedin_url, next_follow_up, last_contact, resume_used, notes, next_action, next_action_date,
        organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateContact(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE contacts SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function getInterviews(scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM interviews
      WHERE ${owner.clause}
      ORDER BY
        CASE WHEN date IS NULL OR date = '' THEN 1 ELSE 0 END,
        date DESC,
        created_at DESC
    `,
    args: owner.args
  })
  return toPlainRows(res).map(interviewRowToRecord)
}

export async function createInterview(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)
  await db.execute({
    sql: `
      INSERT INTO interviews (
        id, company, job_title, date, round, format, outcome, interviewer,
        questions_asked, feedback_received, follow_up_sent, notes, pipeline_entry_id, next_action, next_action_date,
        organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateInterview(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE interviews SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function getEvents(scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM events
      WHERE ${owner.clause}
      ORDER BY
        CASE WHEN date IS NULL OR date = '' THEN 1 ELSE 0 END,
        date ASC,
        created_at DESC
    `,
    args: owner.args
  })
  return toPlainRows(res).map(eventRowToRecord)
}

export async function createEvent(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)
  await db.execute({
    sql: `
      INSERT INTO events (
        id, name, date, price, status, registration_link, notes, source_key, organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })
  return { id }
}

export async function getEventBySourceKey(sourceKey, scope = {}) {
  if (!sourceKey) return null
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `SELECT * FROM events WHERE source_key = ? AND ${owner.clause} LIMIT 1`,
    args: [String(sourceKey), ...owner.args]
  })
  return eventRowToRecord(firstRow(res))
}

export async function updateEvent(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE events SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function getTemplates(scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM templates
      WHERE ${owner.clause}
      ORDER BY updated_at DESC, created_at DESC
    `,
    args: owner.args
  })
  return toPlainRows(res).map(templateRowToRecord)
}

export async function createTemplate(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)
  await db.execute({
    sql: `
      INSERT INTO templates (
        id, name, category, body, notes, organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.Name || '',
      data.Category || null,
      data.Body || null,
      data.Notes || null,
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateTemplate(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE templates SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function getWatchlist(scope = {}) {
  const owner = await scopedOwnerWhere(scope)
  const res = await db.execute({
    sql: `
      SELECT * FROM watchlist
      WHERE ${owner.clause}
      ORDER BY
        CASE WHEN follow_up IS NULL OR follow_up = '' THEN 1 ELSE 0 END,
        follow_up ASC,
        created_at DESC
    `,
    args: owner.args
  })
  return toPlainRows(res).map(watchlistRowToRecord)
}

export async function createWatchlistEntry(data = {}, scope = {}) {
  const ts = now()
  const id = String(data.id || crypto.randomUUID())
  const owner = await resolveDataScope(scope)
  await db.execute({
    sql: `
      INSERT INTO watchlist (
        id, company, industry, website, connections_there, know_the_founder,
        open_application, follow_up, status, notes, organization_id, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      owner.organizationId,
      owner.userId,
      ts,
      ts
    ]
  })
  return { id }
}

export async function updateWatchlistEntry(id, data = {}, scope = {}) {
  const owner = await scopedOwnerWhere(scope)
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
  args.push(String(id), ...owner.args)

  await db.execute({
    sql: `UPDATE watchlist SET ${updates.join(', ')} WHERE id = ? AND ${owner.clause}`,
    args
  })
}

export async function getDashboardData(scope = {}) {
  const [overdueContacts, recentLogs, pipeline, interviews, events, contacts] = await Promise.all([
    getOverdueFollowUps(scope),
    getRecentLogs(8, scope),
    getPipeline(scope),
    getInterviews(scope),
    getEvents(scope),
    getContacts(scope)
  ])
  const today = new Date().toISOString().slice(0, 10)
  const weekAhead = addDaysIso(7)

  const activeItems = pipeline.filter(p =>
    ['💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing'].includes(p.Stage)
  )
  const getPipelineDueDate = (p) => {
    const nextActionDate = String(p['Next Action Date'] || '').trim()
    if (nextActionDate) return nextActionDate
    return String(p['Follow-Up Date'] || '').trim()
  }
  const duePipelineFollowUps = pipeline
    .filter(p => {
      const due = getPipelineDueDate(p)
      const stage = String(p.Stage || '')
      if (!due) return false
      if (stage.includes('Closed')) return false
      return due <= today
    })
    .sort((a, b) => getPipelineDueDate(a).localeCompare(getPipelineDueDate(b)))

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
      priority: 2
    })),
    ...duePipelineFollowUps.map(p => ({
      id: `pipeline-followup-${p.id}`,
      entityId: p.id,
      type: 'pipeline_follow_up',
      pillarId: 'follow_ups_due',
      title: `${p.Company}: ${p['Next Action'] || 'Follow up on application'}`,
      subtitle: p.Role || p.Stage,
      dueDate: getPipelineDueDate(p),
      reason: `Pipeline follow-up date is due (${getPipelineDueDate(p)}).`,
      actionLabel: 'Open Pipeline',
      route: 'pipeline',
      priority: 2
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
      priority: 1
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
      priority: 1
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
