import { Client } from '@notionhq/client'
import 'dotenv/config'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

const DB = {
  pipeline: process.env.NOTION_PIPELINE_DB,
  contacts: process.env.NOTION_CONTACTS_DB,
  daily: process.env.NOTION_DAILY_LOG_DB,
  interviews: process.env.NOTION_INTERVIEWS_DB,
  events: process.env.NOTION_EVENTS_DB,
  templates: process.env.NOTION_TEMPLATES_DB
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
      case 'phone_number':
        out[key] = val.phone_number || null
        break
      case 'email':
        out[key] = val.email || null
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

export async function updatePipelineEntry(pageId, data) {
  const properties = {}
  if (data.Company) properties.Company = { title: [{ text: { content: data.Company } }] }
  if (data.Role != null) properties.Role = { rich_text: [{ text: { content: data.Role || '' } }] }
  if (data.Stage) properties.Stage = { select: { name: data.Stage } }
  if (data.Priority !== undefined) properties.Priority = data.Priority ? { select: { name: data.Priority } } : { select: null }
  if (data.Sector !== undefined) properties.Sector = data.Sector ? { select: { name: data.Sector } } : { select: null }
  if (data['Salary Range'] != null) properties['Salary Range'] = { rich_text: [{ text: { content: data['Salary Range'] || '' } }] }
  if (data['Job URL'] != null) properties['Job URL'] = { url: data['Job URL'] || null }
  if (data['Date Applied'] != null) properties['Date Applied'] = data['Date Applied'] ? { date: { start: data['Date Applied'] } } : { date: null }
  if (data['Follow-Up Date'] != null) properties['Follow-Up Date'] = data['Follow-Up Date'] ? { date: { start: data['Follow-Up Date'] } } : { date: null }
  if (data['Contact Name'] != null) properties['Contact Name'] = { rich_text: [{ text: { content: data['Contact Name'] || '' } }] }
  if (data['Contact Title'] != null) properties['Contact Title'] = { rich_text: [{ text: { content: data['Contact Title'] || '' } }] }
  if (data['Outreach Method'] !== undefined) properties['Outreach Method'] = data['Outreach Method'] ? { select: { name: data['Outreach Method'] } } : { select: null }
  if (data['Resume Version'] !== undefined) properties['Resume Version'] = data['Resume Version'] ? { select: { name: data['Resume Version'] } } : { select: null }
  if (data['Company Address'] != null) properties['Company Address'] = { rich_text: [{ text: { content: data['Company Address'] || '' } }] }
  if (data['Company Phone'] != null) properties['Company Phone'] = { phone_number: data['Company Phone'] || null }
  if (data.Notes != null) properties.Notes = { rich_text: [{ text: { content: data.Notes || '' } }] }
  if (data['Research Notes'] != null) properties['Research Notes'] = { rich_text: [{ text: { content: data['Research Notes'] || '' } }] }
  if (data['Filed for Unemployment'] != null) properties['Filed for Unemployment'] = { checkbox: !!data['Filed for Unemployment'] }
  if (data.Outcome) properties.Outcome = { select: { name: data.Outcome } }
  return notion.pages.update({ page_id: pageId, properties })
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
  if (data['Company Address']) properties['Company Address'] = { rich_text: [{ text: { content: data['Company Address'] } }] }
  if (data['Company Phone']) properties['Company Phone'] = { phone_number: data['Company Phone'] }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }
  if (data['Research Notes']) properties['Research Notes'] = { rich_text: [{ text: { content: data['Research Notes'] } }] }
  if (data['Filed for Unemployment']) properties['Filed for Unemployment'] = { checkbox: !!data['Filed for Unemployment'] }
  if (data.Outcome) properties.Outcome = { select: { name: data.Outcome } }

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
  if (data.Email) properties.Email = { email: data.Email }
  if (data.Phone) properties.Phone = { phone_number: data.Phone }
  if (data['Resume Used']) properties['Resume Used'] = { rich_text: [{ text: { content: data['Resume Used'] } }] }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }

  return notion.pages.create({ parent: { database_id: DB.contacts }, properties })
}

export async function updateContact(pageId, data) {
  const properties = {}
  if (data.Name) properties.Name = { title: [{ text: { content: data.Name } }] }
  if (data.Title != null) properties.Title = { rich_text: [{ text: { content: data.Title || '' } }] }
  if (data.Company != null) properties.Company = { rich_text: [{ text: { content: data.Company || '' } }] }
  if (data.Warmth) properties.Warmth = { select: { name: data.Warmth } }
  if (data.Status) properties.Status = { select: { name: data.Status } }
  if (data['How We Know Each Other'] !== undefined) properties['How We Know Each Other'] = data['How We Know Each Other'] ? { select: { name: data['How We Know Each Other'] } } : { select: null }
  if (data['LinkedIn URL'] != null) properties['LinkedIn URL'] = { url: data['LinkedIn URL'] || null }
  if (data['Next Follow-Up'] != null) properties['Next Follow-Up'] = data['Next Follow-Up'] ? { date: { start: data['Next Follow-Up'] } } : { date: null }
  if (data.Email != null) properties.Email = { email: data.Email || null }
  if (data.Phone != null) properties.Phone = { phone_number: data.Phone || null }
  if (data['Resume Used'] != null) properties['Resume Used'] = { rich_text: [{ text: { content: data['Resume Used'] || '' } }] }
  if (data.Notes != null) properties.Notes = { rich_text: [{ text: { content: data.Notes || '' } }] }
  return notion.pages.update({ page_id: pageId, properties })
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

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates() {
  return queryAll(DB.templates, undefined, [
    { property: 'Category', direction: 'ascending' }
  ])
}

export async function createTemplate(data) {
  const properties = {
    Name: { title: [{ text: { content: data.Name || '' } }] }
  }
  if (data.Category) properties.Category = { select: { name: data.Category } }
  if (data.Body) properties.Body = { rich_text: [{ text: { content: data.Body } }] }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }
  return notion.pages.create({ parent: { database_id: DB.templates }, properties })
}

export async function updateTemplate(pageId, data) {
  const properties = {}
  if (data.Name) properties.Name = { title: [{ text: { content: data.Name } }] }
  if (data.Category !== undefined) properties.Category = data.Category ? { select: { name: data.Category } } : { select: null }
  if (data.Body != null) properties.Body = { rich_text: [{ text: { content: data.Body || '' } }] }
  if (data.Notes != null) properties.Notes = { rich_text: [{ text: { content: data.Notes || '' } }] }
  return notion.pages.update({ page_id: pageId, properties })
}

// ─── Interviews ───────────────────────────────────────────────────────────────

export async function getInterviews() {
  return queryAll(DB.interviews, undefined, [
    { property: 'Date', direction: 'descending' }
  ])
}

export async function createInterview(data) {
  const properties = {
    Company: { title: [{ text: { content: data.Company || '' } }] }
  }
  if (data['Job Title']) properties['Job Title'] = { rich_text: [{ text: { content: data['Job Title'] } }] }
  if (data.Date) properties.Date = { date: { start: data.Date } }
  if (data.Round) properties.Round = { select: { name: data.Round } }
  if (data.Format) properties.Format = { select: { name: data.Format } }
  if (data.Outcome) properties.Outcome = { select: { name: data.Outcome } }
  if (data.Interviewer) properties.Interviewer = { rich_text: [{ text: { content: data.Interviewer } }] }
  if (data['Questions Asked']) properties['Questions Asked'] = { rich_text: [{ text: { content: data['Questions Asked'] } }] }
  if (data['Feedback Received']) properties['Feedback Received'] = { rich_text: [{ text: { content: data['Feedback Received'] } }] }
  if (data['Follow-Up Sent'] != null) properties['Follow-Up Sent'] = { checkbox: !!data['Follow-Up Sent'] }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }
  return notion.pages.create({ parent: { database_id: DB.interviews }, properties })
}

export async function updateInterview(pageId, data) {
  const properties = {}
  if (data.Company) properties.Company = { title: [{ text: { content: data.Company } }] }
  if (data['Job Title'] != null) properties['Job Title'] = { rich_text: [{ text: { content: data['Job Title'] || '' } }] }
  if (data.Date != null) properties.Date = data.Date ? { date: { start: data.Date } } : { date: null }
  if (data.Round !== undefined) properties.Round = data.Round ? { select: { name: data.Round } } : { select: null }
  if (data.Format !== undefined) properties.Format = data.Format ? { select: { name: data.Format } } : { select: null }
  if (data.Outcome) properties.Outcome = { select: { name: data.Outcome } }
  if (data.Interviewer != null) properties.Interviewer = { rich_text: [{ text: { content: data.Interviewer || '' } }] }
  if (data['Questions Asked'] != null) properties['Questions Asked'] = { rich_text: [{ text: { content: data['Questions Asked'] || '' } }] }
  if (data['Feedback Received'] != null) properties['Feedback Received'] = { rich_text: [{ text: { content: data['Feedback Received'] || '' } }] }
  if (data['Follow-Up Sent'] != null) properties['Follow-Up Sent'] = { checkbox: !!data['Follow-Up Sent'] }
  if (data.Notes != null) properties.Notes = { rich_text: [{ text: { content: data.Notes || '' } }] }
  return notion.pages.update({ page_id: pageId, properties })
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents() {
  return queryAll(DB.events, undefined, [
    { property: 'Date', direction: 'ascending' }
  ])
}

export async function createEvent(data) {
  const properties = {
    Name: { title: [{ text: { content: data.Name || '' } }] }
  }
  if (data.Date) properties.Date = { date: { start: data.Date } }
  if (data.Price) properties.Price = { rich_text: [{ text: { content: data.Price } }] }
  if (data.Status) properties.Status = { select: { name: data.Status } }
  if (data['Registration Link']) properties['Registration Link'] = { url: data['Registration Link'] }
  if (data.Notes) properties.Notes = { rich_text: [{ text: { content: data.Notes } }] }
  return notion.pages.create({ parent: { database_id: DB.events }, properties })
}

export async function updateEvent(pageId, data) {
  const properties = {}
  if (data.Name) properties.Name = { title: [{ text: { content: data.Name } }] }
  if (data.Date != null) properties.Date = data.Date ? { date: { start: data.Date } } : { date: null }
  if (data.Price != null) properties.Price = { rich_text: [{ text: { content: data.Price || '' } }] }
  if (data.Status) properties.Status = { select: { name: data.Status } }
  if (data['Registration Link'] != null) properties['Registration Link'] = { url: data['Registration Link'] || null }
  if (data.Notes != null) properties.Notes = { rich_text: [{ text: { content: data.Notes || '' } }] }
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

  // Week stats: 8 logs fetched so client can find yesterday, but only sum 7
  const weekStats = recentLogs.slice(0, 7).reduce((acc, log) => {
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
