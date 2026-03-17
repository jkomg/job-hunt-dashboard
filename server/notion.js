import { Client } from '@notionhq/client'
import 'dotenv/config'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

const DB = {
  pipeline: process.env.NOTION_PIPELINE_DB,
  contacts: process.env.NOTION_CONTACTS_DB,
  daily: process.env.NOTION_DAILY_LOG_DB
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pageToRecord(page) {
  const props = page.properties
  const out = { id: page.id, url: page.url }

  for (const [key, val] of Object.entries(props)) {
    switch (val.type) {
      case 'title':
        out[key] = val.title.map(t => t.plain_text).join('') || ''
        break
      case 'rich_text':
        out[key] = val.rich_text.map(t => t.plain_text).join('') || ''
        break
      case 'select':
        out[key] = val.select?.name || null
        break
      case 'multi_select':
        out[key] = val.multi_select.map(s => s.name)
        break
      case 'date':
        out[key] = val.date?.start || null
        break
      case 'number':
        out[key] = val.number
        break
      case 'checkbox':
        out[key] = val.checkbox
        break
      case 'url':
        out[key] = val.url || null
        break
      default:
        out[key] = null
    }
  }
  return out
}

async function queryAll(databaseId, filter, sorts) {
  const pages = []
  let cursor

  while (true) {
    const res = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: 100
    })
    pages.push(...res.results)
    if (!res.has_more) break
    cursor = res.next_cursor
  }

  return pages.map(pageToRecord)
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function getPipeline() {
  return queryAll(DB.pipeline, undefined, [
    { property: 'Stage', direction: 'ascending' }
  ])
}

export async function updatePipelineStage(pageId, stage) {
  return notion.pages.update({
    page_id: pageId,
    properties: { Stage: { select: { name: stage } } }
  })
}

export async function updatePipelineFollowUp(pageId, date) {
  return notion.pages.update({
    page_id: pageId,
    properties: {
      'Follow-Up Date': date ? { date: { start: date } } : { date: null }
    }
  })
}

export async function createPipelineEntry(data) {
  const properties = {
    Company: { title: [{ text: { content: data.Company || '' } }] },
    Role: { rich_text: [{ text: { content: data.Role || '' } }] },
    Stage: { select: { name: data.Stage || '🔍 Researching' } }
  }
  if (data.Priority) properties.Priority = { select: { name: data.Priority } }
  if (data['Job URL']) properties['Job URL'] = { url: data['Job URL'] }
  if (data.Sector) properties.Sector = { select: { name: data.Sector } }
  if (data['Salary Range']) properties['Salary Range'] = { rich_text: [{ text: { content: data['Salary Range'] } }] }
  if (data['Date Applied']) properties['Date Applied'] = { date: { start: data['Date Applied'] } }
  if (data['Follow-Up Date']) properties['Follow-Up Date'] = { date: { start: data['Follow-Up Date'] } }
  if (data['Contact Name']) properties['Contact Name'] = { rich_text: [{ text: { content: data['Contact Name'] } }] }
  if (data['Contact Title']) properties['Contact Title'] = { rich_text: [{ text: { content: data['Contact Title'] } }] }
  if (data['Outreach Method']) properties['Outreach Method'] = { select: { name: data['Outreach Method'] } }
  if (data['Resume Version']) properties['Resume Version'] = { select: { name: data['Resume Version'] } }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }

  return notion.pages.create({ parent: { database_id: DB.pipeline }, properties })
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts() {
  return queryAll(DB.contacts, undefined, [
    { property: 'Next Follow-Up', direction: 'ascending' }
  ])
}

export async function getOverdueFollowUps() {
  const today = new Date().toISOString().split('T')[0]
  return queryAll(DB.contacts, {
    and: [
      { property: 'Next Follow-Up', date: { on_or_before: today } },
      {
        or: [
          { property: 'Status', select: { equals: 'Need to reach out' } },
          { property: 'Status', select: { equals: 'Waiting on response' } },
          { property: 'Status', select: { equals: 'In conversation' } }
        ]
      }
    ]
  })
}

export async function markContacted(pageId, nextFollowUp) {
  const today = new Date().toISOString().split('T')[0]
  const props = {
    'Last Contact': { date: { start: today } },
    Status: { select: { name: 'Waiting on response' } }
  }
  if (nextFollowUp) props['Next Follow-Up'] = { date: { start: nextFollowUp } }
  return notion.pages.update({ page_id: pageId, properties: props })
}

export async function updateContactStatus(pageId, status) {
  return notion.pages.update({
    page_id: pageId,
    properties: { Status: { select: { name: status } } }
  })
}

export async function createContact(data) {
  const properties = {
    Name: { title: [{ text: { content: data.Name || '' } }] }
  }
  if (data.Title) properties.Title = { rich_text: [{ text: { content: data.Title } }] }
  if (data.Company) properties.Company = { rich_text: [{ text: { content: data.Company } }] }
  if (data.Warmth) properties.Warmth = { select: { name: data.Warmth } }
  if (data.Status) properties.Status = { select: { name: data.Status } }
  if (data['How We Know Each Other']) properties['How We Know Each Other'] = { select: { name: data['How We Know Each Other'] } }
  if (data['LinkedIn URL']) properties['LinkedIn URL'] = { url: data['LinkedIn URL'] }
  if (data['Next Follow-Up']) properties['Next Follow-Up'] = { date: { start: data['Next Follow-Up'] } }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }

  return notion.pages.create({ parent: { database_id: DB.contacts }, properties })
}

// ─── Daily Action Log ──────────────────────────────────────────────────────────

export async function getDailyLogs(limit = 30) {
  const pages = []
  let cursor

  while (pages.length < limit) {
    const res = await notion.databases.query({
      database_id: DB.daily,
      sorts: [{ property: 'Date', direction: 'descending' }],
      start_cursor: cursor,
      page_size: Math.min(limit - pages.length, 100)
    })
    pages.push(...res.results)
    if (!res.has_more || pages.length >= limit) break
    cursor = res.next_cursor
  }

  return pages.slice(0, limit).map(pageToRecord)
}

// Returns the most recent entry with raw timestamps — client decides if it's "today"
export async function getTodayLog() {
  const res = await notion.databases.query({
    database_id: DB.daily,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 1
  })
  if (!res.results.length) return null
  const page = res.results[0]
  const record = pageToRecord(page)
  record._createdTime = page.created_time       // UTC ISO string — browser converts to local
  record._lastEditedTime = page.last_edited_time
  return record
}

// Returns recent logs with raw timestamps so the client can identify yesterday's entry
export async function getRecentLogs(n = 5) {
  const res = await notion.databases.query({
    database_id: DB.daily,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: n
  })
  return res.results.map(page => {
    const record = pageToRecord(page)
    record._createdTime = page.created_time
    return record
  })
}

export async function createDailyLog(data) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  const properties = {
    Date: { title: [{ text: { content: data.Date || today } }] }
  }

  if (data['Mindset (1-10)'] != null) properties['Mindset (1-10)'] = { number: Number(data['Mindset (1-10)']) }
  if (data['Energy (1-10)'] != null) properties['Energy (1-10)'] = { number: Number(data['Energy (1-10)']) }
  if (data['Outreach Sent'] != null) properties['Outreach Sent'] = { number: Number(data['Outreach Sent']) }
  if (data['Responses Received'] != null) properties['Responses Received'] = { number: Number(data['Responses Received']) }
  if (data['Applications Submitted'] != null) properties['Applications Submitted'] = { number: Number(data['Applications Submitted']) }
  if (data['Conversations / Calls'] != null) properties['Conversations / Calls'] = { number: Number(data['Conversations / Calls']) }
  if (data['LinkedIn Posts'] != null) properties['LinkedIn Posts'] = { checkbox: !!data['LinkedIn Posts'] }
  if (data['Volunteer Activity'] != null) properties['Volunteer Activity'] = { checkbox: !!data['Volunteer Activity'] }
  if (data.Exercise) properties.Exercise = { select: { name: data.Exercise } }
  if (data['Cert Progress']) properties['Cert Progress'] = { select: { name: data['Cert Progress'] } }
  if (data['Win of the Day']) properties['Win of the Day'] = { rich_text: [{ text: { content: data['Win of the Day'] } }] }
  if (data['Gratitude / Reflection']) properties['Gratitude / Reflection'] = { rich_text: [{ text: { content: data['Gratitude / Reflection'] } }] }
  if (data["Tomorrow's Top 3"]) properties["Tomorrow's Top 3"] = { rich_text: [{ text: { content: data["Tomorrow's Top 3"] } }] }

  return notion.pages.create({ parent: { database_id: DB.daily }, properties })
}

export async function updateDailyLog(pageId, data) {
  const properties = {}

  if (data['Mindset (1-10)'] != null) properties['Mindset (1-10)'] = { number: Number(data['Mindset (1-10)']) }
  if (data['Energy (1-10)'] != null) properties['Energy (1-10)'] = { number: Number(data['Energy (1-10)']) }
  if (data['Outreach Sent'] != null) properties['Outreach Sent'] = { number: Number(data['Outreach Sent']) }
  if (data['Responses Received'] != null) properties['Responses Received'] = { number: Number(data['Responses Received']) }
  if (data['Applications Submitted'] != null) properties['Applications Submitted'] = { number: Number(data['Applications Submitted']) }
  if (data['Conversations / Calls'] != null) properties['Conversations / Calls'] = { number: Number(data['Conversations / Calls']) }
  if (data['LinkedIn Posts'] != null) properties['LinkedIn Posts'] = { checkbox: !!data['LinkedIn Posts'] }
  if (data['Volunteer Activity'] != null) properties['Volunteer Activity'] = { checkbox: !!data['Volunteer Activity'] }
  if (data.Exercise) properties.Exercise = { select: { name: data.Exercise } }
  if (data['Cert Progress']) properties['Cert Progress'] = { select: { name: data['Cert Progress'] } }
  if (data['Win of the Day'] != null) properties['Win of the Day'] = { rich_text: [{ text: { content: data['Win of the Day'] } }] }
  if (data['Gratitude / Reflection'] != null) properties['Gratitude / Reflection'] = { rich_text: [{ text: { content: data['Gratitude / Reflection'] } }] }
  if (data["Tomorrow's Top 3"] != null) properties["Tomorrow's Top 3"] = { rich_text: [{ text: { content: data["Tomorrow's Top 3"] } }] }

  return notion.pages.update({ page_id: pageId, properties })
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

export async function getDashboardData() {
  const [overdueContacts, recentLogs, pipeline] = await Promise.all([
    getOverdueFollowUps(),
    getRecentLogs(8),   // includes timestamps so client finds yesterday
    getPipeline()
  ])

  const activeItems = pipeline.filter(p =>
    ['💬 In Conversation', '📞 Interview Scheduled', '🎯 Interviewing'].includes(p.Stage)
  )

  // Week stats from recent logs (client will filter by date, we send all recent)
  const weekStats = recentLogs.reduce((acc, log) => {
    acc.outreach += log['Outreach Sent'] || 0
    acc.responses += log['Responses Received'] || 0
    acc.applications += log['Applications Submitted'] || 0
    acc.linkedInPosts += log['LinkedIn Posts'] ? 1 : 0
    return acc
  }, { outreach: 0, responses: 0, applications: 0, linkedInPosts: 0 })

  return {
    overdueContacts,
    recentLogs,   // client picks yesterday's Top 3 using its local timezone
    activeItems,
    weekStats
  }
}
