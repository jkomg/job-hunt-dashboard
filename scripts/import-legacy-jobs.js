/**
 * One-time import of legacy "Jobs applied to" Notion page into the pipeline.
 * Run with: node scripts/import-legacy-jobs.js
 * Safe to re-run — skips entries that fail but does not deduplicate.
 */

import { Client } from '@notionhq/client'
import 'dotenv/config'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const SOURCE_PAGE_ID = '28e3a3e5cab1805ea40bfe64c22a5122'
const PIPELINE_DB   = process.env.NOTION_PIPELINE_DB

// ── Helpers ──────────────────────────────────────────────────────────────────

function richToPlain(richText) {
  return richText.map(t => t.plain_text).join('')
}

function isStruck(richText) {
  return richText.some(t => t.annotations?.strikethrough)
}

// Override with IMPORT_YEAR env var if your list spans a different year.
// Default: months after the current month are assumed to be last year.
const BASE_YEAR = process.env.IMPORT_YEAR
  ? parseInt(process.env.IMPORT_YEAR, 10)
  : new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

/** "10/15" → "2024-10-15", "1/7" → "2025-01-07" (year derived dynamically) */
function parseDate(str) {
  const m = str.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (!m) return null
  const month = parseInt(m[1], 10)
  const day   = parseInt(m[2], 10)
  const year  = month > CURRENT_MONTH ? BASE_YEAR - 1 : BASE_YEAR
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Pull the first https URL out of plain text */
function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s)>\]]+/)
  return m ? m[0].replace(/[.,;]+$/, '') : null
}

/**
 * Best-effort parse of a messy list item like:
 *   "Runway - https://… - Technical Customer Experience Manager - 10/15"
 *   "HappyCo: Strategic Account Executive: https://… 10/19"
 *   "~~Zapier - https://… 150-350K 10/23 - rejected 11/12~~"
 */
function parseEntry(rawText, struck) {
  // Strip strikethrough markers (~~…~~) for easier parsing
  const text = rawText.replace(/~~/g, '')

  const url         = extractUrl(text)
  const dateApplied = parseDate(text)
  const lower       = text.toLowerCase()

  // Outcome
  let outcome = null
  if (lower.includes('rejected')) {
    outcome = 'Rejected — No Interview'
  } else if (struck) {
    outcome = 'Ghosted'
  }

  // Remove URL and date from text to make company/role extraction easier
  let remainder = text
    .replace(/https?:\/\/[^\s)>\]]+/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, '')
    .replace(/\d{2,3}[-–]\d{2,3}K/gi, '')   // salary ranges
    .replace(/\$\d[\d,K–-]*/gi, '')
    .replace(/job (no longer|is gone|gone)/gi, '')
    .replace(/role is gone/gi, '')
    .replace(/rejected/gi, '')
    .replace(/reached out to recruiter[^,]*/gi, '')
    .replace(/no response/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Split on common separators to get segments
  const segments = remainder
    .split(/\s*[-–:]\s*/)
    .map(s => s.trim())
    .filter(Boolean)

  const company = segments[0] || 'Unknown'

  // Role: first non-empty segment after company that looks like a title
  //   (skip very short segments, numbers-only segments)
  const role = segments.slice(1).find(s => s.length > 4 && !/^\d+$/.test(s)) || ''

  return { company, role, url, dateApplied, outcome }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function fetchBlocks(pageId) {
  const blocks = []
  let cursor
  while (true) {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100
    })
    blocks.push(...res.results)
    if (!res.has_more) break
    cursor = res.next_cursor
  }
  return blocks
}

async function createEntry({ company, role, url, dateApplied, outcome }) {
  const properties = {
    Company: { title: [{ text: { content: company } }] },
    Stage:   { select: { name: '❌ Closed' } }
  }
  if (role)         properties.Role         = { rich_text: [{ text: { content: role } }] }
  if (url)          properties['Job URL']   = { url }
  if (dateApplied)  properties['Date Applied'] = { date: { start: dateApplied } }
  if (outcome)      properties.Outcome      = { select: { name: outcome } }

  return notion.pages.create({ parent: { database_id: PIPELINE_DB }, properties })
}

async function run() {
  console.log('Fetching source page blocks…')
  const blocks   = await fetchBlocks(SOURCE_PAGE_ID)
  const listItems = blocks.filter(b => b.type === 'numbered_list_item')

  console.log(`Found ${listItems.length} entries. Importing…\n`)

  let ok = 0, fail = 0

  for (const block of listItems) {
    const rt   = block.numbered_list_item?.rich_text || []
    const text = richToPlain(rt)
    const struck = isStruck(rt)

    if (!text.trim()) continue

    const entry = parseEntry(text, struck)

    try {
      await createEntry(entry)
      const tag = entry.outcome ? ` [${entry.outcome}]` : ''
      console.log(`  ✓ ${entry.company}${entry.role ? ' — ' + entry.role : ''}${tag}`)
      ok++
    } catch (e) {
      console.error(`  ✗ ${entry.company}: ${e.message}`)
      fail++
    }

    // Respect Notion rate limits
    await new Promise(r => setTimeout(r, 334))
  }

  console.log(`\nDone. ${ok} imported, ${fail} failed.`)
}

run().catch(err => { console.error(err); process.exit(1) })
