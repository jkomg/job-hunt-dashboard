#!/usr/bin/env node
import 'dotenv/config'

import {
  db,
  initDb,
  createPipelineEntry,
  createContact,
  createInterview,
  createEvent,
  createTemplate,
  createWatchlistEntry,
  createDailyLog
} from '../server/db.js'

import {
  getPipeline as getNotionPipeline,
  getContacts as getNotionContacts,
  getInterviews as getNotionInterviews,
  getEvents as getNotionEvents,
  getTemplates as getNotionTemplates,
  getWatchlist as getNotionWatchlist,
  getDailyLogs as getNotionDailyLogs
} from '../server/notion.js'

const TABLES = [
  { key: 'pipeline', table: 'pipeline_entries', getter: getNotionPipeline, creator: createPipelineEntry },
  { key: 'contacts', table: 'contacts', getter: getNotionContacts, creator: createContact },
  { key: 'interviews', table: 'interviews', getter: getNotionInterviews, creator: createInterview },
  { key: 'events', table: 'events', getter: getNotionEvents, creator: createEvent },
  { key: 'templates', table: 'templates', getter: getNotionTemplates, creator: createTemplate },
  { key: 'watchlist', table: 'watchlist', getter: getNotionWatchlist, creator: createWatchlistEntry },
  { key: 'daily', table: 'daily_logs', getter: () => getNotionDailyLogs(3650), creator: createDailyLog }
]

async function tableCount(table) {
  const res = await db.execute(`SELECT COUNT(*) AS count FROM ${table}`)
  return Number(res.rows?.[0]?.count || 0)
}

async function run() {
  if (!process.env.NOTION_TOKEN) {
    throw new Error('NOTION_TOKEN is required for migration')
  }

  await initDb()

  const summary = {}
  for (const item of TABLES) {
    const existing = await tableCount(item.table)
    if (existing > 0) {
      summary[item.key] = { skipped: true, reason: `destination has ${existing} rows` }
      continue
    }

    const rows = await item.getter()
    let inserted = 0
    for (const row of rows) {
      await item.creator({ ...row, id: row.id })
      inserted++
    }
    summary[item.key] = { skipped: false, inserted }
  }

  console.log(JSON.stringify(summary, null, 2))
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
