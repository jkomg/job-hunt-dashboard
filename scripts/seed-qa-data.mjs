#!/usr/bin/env node
import {
  initDb,
  createUserAccount,
  createStaffAssignment,
  createPipelineEntry,
  createDailyLog,
  createContact,
  createInterview,
  createEvent,
  createJobRecommendation,
  createStaffTask,
  createCandidateThread,
  createCandidateMessage
} from '../server/db.js'

function isoPlusDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days || 0))
  return d.toISOString().slice(0, 10)
}

function tsPlusHours(hours) {
  return Date.now() + Number(hours || 0) * 60 * 60 * 1000
}

async function main() {
  await initDb()

  const orgId = process.env.QA_ORG_ID || 'remote-rebellion'
  const suffix = process.env.QA_SUFFIX || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 12)
  const basePassword = process.env.QA_PASSWORD || 'qa-password-2026!'
  const mustChangePassword = process.env.QA_FORCE_PASSWORD_CHANGE === '1'

  const users = {
    admin: `qa-admin-${suffix}`,
    staff: `qa-staff-${suffix}`,
    seekerA: `qa-seeker-a-${suffix}`,
    seekerB: `qa-seeker-b-${suffix}`
  }

  const admin = await createUserAccount({
    username: users.admin,
    password: basePassword,
    role: 'admin',
    organizationId: orgId,
    mustChangePassword
  })
  const staff = await createUserAccount({
    username: users.staff,
    password: basePassword,
    role: 'staff',
    organizationId: orgId,
    mustChangePassword
  })
  const seekerA = await createUserAccount({
    username: users.seekerA,
    password: basePassword,
    role: 'job_seeker',
    organizationId: orgId,
    mustChangePassword
  })
  const seekerB = await createUserAccount({
    username: users.seekerB,
    password: basePassword,
    role: 'job_seeker',
    organizationId: orgId,
    mustChangePassword
  })

  await createStaffAssignment({ organizationId: orgId, staffUserId: staff.id, jobSeekerUserId: seekerA.id })
  await createStaffAssignment({ organizationId: orgId, staffUserId: staff.id, jobSeekerUserId: seekerB.id })

  const scopeA = { organizationId: orgId, userId: seekerA.id }
  const scopeB = { organizationId: orgId, userId: seekerB.id }

  const pipelineA1 = await createPipelineEntry({
    Company: 'Acme Analytics',
    Role: 'Customer Success Manager',
    Stage: '📨 Applied',
    Priority: '🔥 Top Target',
    'Job Source': 'Remote Rebellion',
    'Date Applied': isoPlusDays(-4),
    'Follow-Up Date': isoPlusDays(-1),
    'Next Action': 'Follow up with recruiter',
    'Next Action Date': isoPlusDays(1),
    'Job URL': 'https://example.com/jobs/acme-csm'
  }, scopeA)
  await createPipelineEntry({
    Company: 'Nimbus Health',
    Role: 'Account Manager',
    Stage: '🎯 Interviewing',
    Priority: '⭐ Strong Fit',
    'Job Source': 'Welcome to the Jungle',
    'Date Applied': isoPlusDays(-10),
    'Follow-Up Date': isoPlusDays(2),
    'Next Action': 'Prepare STAR stories',
    'Next Action Date': isoPlusDays(0),
    'Job URL': 'https://example.com/jobs/nimbus-am'
  }, scopeA)
  await createPipelineEntry({
    Company: 'Orbit AI',
    Role: 'CSM',
    Stage: '💬 In Conversation',
    Priority: '📌 Worth a Shot',
    'Job Source': '',
    'Date Applied': isoPlusDays(-7),
    'Follow-Up Date': isoPlusDays(-2),
    'Next Action': '',
    'Next Action Date': '',
    'Job URL': 'https://example.com/jobs/orbit-csm'
  }, scopeA)

  await createPipelineEntry({
    Company: 'Sundial Cloud',
    Role: 'Implementation Specialist',
    Stage: '🔍 Researching',
    Priority: '⭐ Strong Fit',
    'Job Source': 'LinkedIn',
    'Next Action': 'Tailor resume',
    'Next Action Date': isoPlusDays(1)
  }, scopeB)
  await createPipelineEntry({
    Company: 'Pioneer Labs',
    Role: 'Customer Onboarding Lead',
    Stage: '❌ Closed',
    Priority: '📌 Worth a Shot',
    'Job Source': 'Other',
    Outcome: 'Rejected — No Interview',
    'Date Applied': isoPlusDays(-20)
  }, scopeB)

  await createDailyLog({
    Date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    'Mindset (1-10)': 7,
    'Energy (1-10)': 6,
    'Outreach Sent': 5,
    'Responses Received': 2,
    'Applications Submitted': 3,
    "Tomorrow's Top 3": '1) Follow up Acme\n2) Prep Nimbus interview\n3) Reach out to 3 contacts'
  }, scopeA)

  await createContact({
    Name: 'Lucia RR',
    Company: 'Remote Rebellion',
    Title: 'Coach',
    Status: 'Warm',
    'Next Follow-Up': isoPlusDays(1),
    'Next Action': 'Share updated pipeline notes',
    'Next Action Date': isoPlusDays(1),
    'LinkedIn URL': 'https://www.linkedin.com/in/lucia-rr'
  }, scopeA)

  await createInterview({
    Company: 'Nimbus Health',
    Role: 'Account Manager',
    Date: isoPlusDays(2),
    Round: 'Hiring Manager',
    Outcome: 'Pending',
    'Next Action': 'Research team and metrics',
    'Next Action Date': isoPlusDays(1),
    Notes: 'Ask about onboarding KPIs.',
    'Pipeline Entry ID': pipelineA1.id
  }, scopeA)

  await createEvent({
    Name: 'Remote Rebellion Q&A',
    Date: isoPlusDays(3),
    Status: 'Registered',
    'Registration Link': 'https://events.example.com/rr-qa',
    Notes: 'Bring questions about interview prep.'
  }, scopeA)

  const recA = await createJobRecommendation({
    organizationId: orgId,
    staffUserId: staff.id,
    jobSeekerUserId: seekerA.id,
    company: 'Helios Tech',
    role: 'Customer Success Manager',
    jobUrl: 'https://example.com/jobs/helios-csm',
    source: 'Remote Rebellion',
    fitNote: 'Strong fit based on B2B onboarding background.',
    status: 'draft'
  })
  await createJobRecommendation({
    organizationId: orgId,
    staffUserId: staff.id,
    jobSeekerUserId: seekerB.id,
    company: 'Atlas Systems',
    role: 'Implementation Manager',
    jobUrl: 'https://example.com/jobs/atlas-impl',
    source: 'LinkedIn',
    fitNote: 'Good fit, high process ownership.',
    status: 'posted'
  })

  await createStaffTask({
    organizationId: orgId,
    assigneeUserId: staff.id,
    relatedUserId: seekerA.id,
    type: 'follow_up',
    priority: 'high',
    status: 'todo',
    dueAt: tsPlusHours(20),
    notes: 'Confirm Acme follow-up was sent.',
    createdByUserId: admin.id
  })
  await createStaffTask({
    organizationId: orgId,
    assigneeUserId: staff.id,
    relatedUserId: seekerB.id,
    type: 'research',
    priority: 'normal',
    status: 'in_progress',
    dueAt: tsPlusHours(36),
    notes: 'Add 3 new relevant roles this week.',
    createdByUserId: admin.id
  })

  const thread = await createCandidateThread({
    organizationId: orgId,
    jobSeekerUserId: seekerA.id,
    createdByUserId: staff.id,
    topic: 'Interview prep plan (Nimbus Health)'
  })
  await createCandidateMessage({
    threadId: thread.id,
    organizationId: orgId,
    authorUserId: staff.id,
    visibility: 'shared_with_candidate',
    body: 'Let’s prep your stories for the hiring manager round.'
  })
  await createCandidateMessage({
    threadId: thread.id,
    organizationId: orgId,
    authorUserId: staff.id,
    visibility: 'internal_staff',
    body: 'Candidate needs confidence coaching before mock interview.'
  })
  await createCandidateMessage({
    threadId: thread.id,
    organizationId: orgId,
    authorUserId: seekerA.id,
    visibility: 'shared_with_candidate',
    body: 'Thanks — I can do a prep session tomorrow evening.'
  })

  process.stdout.write('\nQA seed complete.\n')
  process.stdout.write(`org_id: ${orgId}\n`)
  process.stdout.write(`password: ${basePassword}\n`)
  process.stdout.write(`admin_username: ${users.admin}\n`)
  process.stdout.write(`staff_username: ${users.staff}\n`)
  process.stdout.write(`job_seeker_usernames: ${users.seekerA}, ${users.seekerB}\n`)
  process.stdout.write(`draft_recommendation_id: ${recA.id}\n`)
}

main().catch((err) => {
  console.error('QA seed failed:', err?.message || err)
  process.exit(1)
})
