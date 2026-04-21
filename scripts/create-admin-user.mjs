#!/usr/bin/env node
import 'dotenv/config'
import { initDb, upsertLocalAdminUser } from '../server/db.js'

const username = process.argv[2]
const password = process.argv[3]

if (!username || !password) {
  console.error('Usage: node scripts/create-admin-user.mjs <username> <temporary-password>')
  process.exit(1)
}

await initDb()
const user = await upsertLocalAdminUser(username, password, { mustChangePassword: true })

console.log(JSON.stringify({
  ok: true,
  id: Number(user.id),
  username: String(user.username),
  isAdmin: !!user.isAdmin,
  mustChangePassword: !!user.mustChangePassword
}, null, 2))
