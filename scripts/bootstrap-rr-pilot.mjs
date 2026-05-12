#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@libsql/client'

const DATABASE_URL = process.env.DATABASE_URL || 'file:./data/app.db'
const DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined
const PILOT_ORG_ID = String(process.env.PILOT_ORG_ID || 'remote-rebellion').trim()
const PILOT_ORG_NAME = String(process.env.PILOT_ORG_NAME || 'Remote Rebellion').trim()
const PILOT_USERNAMES = String(process.env.PILOT_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

const db = createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })
const now = Date.now()

async function run() {
  await db.execute({
    sql: `
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        updated_at = excluded.updated_at
    `,
    args: [PILOT_ORG_ID, PILOT_ORG_NAME, PILOT_ORG_ID, now, now]
  })

  const usersRes = await db.execute('SELECT id, username, is_admin FROM users')
  const allUsers = (usersRes.rows || []).map(r => ({
    id: Number(r.id),
    username: String(r.username || '').toLowerCase(),
    isAdmin: Number(r.is_admin || 0) === 1
  }))
  const targetUsers = PILOT_USERNAMES.length
    ? allUsers.filter(u => PILOT_USERNAMES.includes(u.username))
    : allUsers

  for (const user of targetUsers) {
    const role = user.isAdmin ? 'admin' : 'job_seeker'
    const membershipId = `${PILOT_ORG_ID}:${user.id}`
    await db.execute({
      sql: `
        INSERT INTO memberships (id, organization_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, user_id) DO UPDATE SET
          role = CASE WHEN memberships.role = 'admin' THEN memberships.role ELSE excluded.role END,
          updated_at = excluded.updated_at
      `,
      args: [membershipId, PILOT_ORG_ID, user.id, role, now, now]
    })
  }

  const reportRes = await db.execute({
    sql: `
      SELECT
        o.id AS organization_id,
        o.name AS organization_name,
        COUNT(m.user_id) AS membership_count
      FROM organizations o
      LEFT JOIN memberships m ON m.organization_id = o.id
      WHERE o.id = ?
      GROUP BY o.id, o.name
    `,
    args: [PILOT_ORG_ID]
  })
  const report = (reportRes.rows || [])[0] || null
  console.log(JSON.stringify({
    ok: true,
    organizationId: PILOT_ORG_ID,
    organizationName: PILOT_ORG_NAME,
    targetedUsernames: targetUsers.map(u => u.username),
    membershipCount: Number(report?.membership_count || 0)
  }, null, 2))
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2))
  process.exit(1)
})
