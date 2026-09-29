import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { exportBackupSnapshot } from '../server/db.js'

const outputPath = path.resolve(
  String(process.env.BACKUP_OUTPUT_PATH || '').trim() ||
  `job-hunt-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
)

if (!String(process.env.DATABASE_URL || '').startsWith('libsql://')) {
  throw new Error('Refusing production backup without a libsql DATABASE_URL')
}

if (!String(process.env.TURSO_AUTH_TOKEN || '').trim()) {
  throw new Error('Refusing production backup without TURSO_AUTH_TOKEN')
}

const snapshot = await exportBackupSnapshot()

if (!snapshot.exportedAt || !snapshot.tables || typeof snapshot.tables !== 'object') {
  throw new Error('Backup snapshot validation failed')
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 })

console.log(`Validated production backup with ${Object.keys(snapshot.tables).length} tables at ${snapshot.exportedAt}`)
