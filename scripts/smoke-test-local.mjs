#!/usr/bin/env node
import { spawn } from 'child_process'
import { mkdtemp, rm } from 'fs/promises'
import net from 'net'
import os from 'os'
import path from 'path'

const TEST_USERNAME = 'smoke'
const DEFAULT_PASSWORD = 'jobhunt2026'
const NEXT_PASSWORD = 'smoke-password-2026!'

async function reserveAvailablePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = (addr && typeof addr === 'object') ? addr.port : null
      srv.close(err => {
        if (err) return reject(err)
        if (!port) return reject(new Error('Could not reserve local port'))
        resolve(port)
      })
    })
  })
}

const PORT = await reserveAvailablePort()

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'job-hunt-smoke-'))
const dbPath = path.join(tempDir, 'app.db')
const baseUrl = `http://127.0.0.1:${PORT}`

let server = null
let stdoutBuf = ''
let stderrBuf = ''
let serverClosed = null

function note(msg) {
  process.stdout.write(`[smoke] ${msg}\n`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function appendLog(target, chunk) {
  const text = String(chunk || '')
  const merged = (target + text)
  return merged.length > 8000 ? merged.slice(-8000) : merged
}

function parseSetCookie(setCookieValue) {
  if (!setCookieValue) return null
  const first = String(setCookieValue).split(';')[0]
  const idx = first.indexOf('=')
  if (idx <= 0) return null
  return {
    name: first.slice(0, idx),
    value: first.slice(idx + 1)
  }
}

const cookieJar = new Map()

function storeCookies(res) {
  const list = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean)
  for (const raw of list) {
    const parsed = parseSetCookie(raw)
    if (!parsed) continue
    cookieJar.set(parsed.name, parsed.value)
  }
}

function cookieHeader() {
  if (!cookieJar.size) return ''
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function api(pathname, { method = 'GET', body, allowStatuses = [200] } = {}) {
  const headers = {}
  const cookie = cookieHeader()
  if (cookie) headers.cookie = cookie

  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
  if (isMutating && pathname !== '/api/login') {
    const csrf = cookieJar.get('csrf_token')
    if (csrf) headers['x-csrf-token'] = csrf
  }

  let requestBody
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }

  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: requestBody
  })

  storeCookies(res)

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!allowStatuses.includes(res.status)) {
    throw new Error(`${method} ${pathname} expected ${allowStatuses.join('/')} got ${res.status}: ${JSON.stringify(payload)}`)
  }

  return { status: res.status, body: payload }
}

async function waitForServerReady(timeoutMs = 25000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (serverClosed) {
      throw new Error(`Server exited before becoming healthy (code=${serverClosed.code ?? 'null'}, signal=${serverClosed.signal ?? 'null'})`)
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`)
      if (res.ok) return
    } catch {
      // retry
    }
    await sleep(250)
  }
  throw new Error('Server did not become healthy in time')
}

async function run() {
  note(`Using temp db: ${dbPath}`)
  server = spawn('node', ['server/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: `file:${dbPath}`,
      AUTH_MODE: 'session',
      DEFAULT_USERNAME: TEST_USERNAME,
      SESSION_SECRET: 'smoke-test-session-secret-please-change',
      GOOGLE_SHEETS_ID: '',
      GOOGLE_SHEETS_CREDENTIALS_JSON: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  server.stdout.on('data', d => { stdoutBuf = appendLog(stdoutBuf, d) })
  server.stderr.on('data', d => { stderrBuf = appendLog(stderrBuf, d) })
  server.on('close', (code, signal) => { serverClosed = { code, signal } })

  await waitForServerReady()
  note('Server is healthy')

  const login = await api('/api/login', {
    method: 'POST',
    body: { username: TEST_USERNAME, password: DEFAULT_PASSWORD },
    allowStatuses: [200]
  })
  if (!login.body?.ok) throw new Error('Login did not return ok=true')
  if (!login.body?.mustChangePassword) {
    throw new Error('Expected mustChangePassword=true for seeded local user')
  }
  note('Login passed (forced password change detected)')

  const pw = await api('/api/change-password', {
    method: 'POST',
    body: { currentPassword: DEFAULT_PASSWORD, newPassword: NEXT_PASSWORD },
    allowStatuses: [200]
  })
  if (!pw.body?.ok) throw new Error('Password change failed')
  note('Password change passed')

  const setup = await api('/api/setup/complete', {
    method: 'POST',
    body: { displayName: 'Smoke Tester', username: TEST_USERNAME },
    allowStatuses: [200]
  })
  if (!setup.body?.ok) throw new Error('Setup completion failed')

  const createDaily = await api('/api/daily', {
    method: 'POST',
    body: {
      Date: 'Smoke Test Day',
      'Mindset (1-10)': 8,
      'Energy (1-10)': 7,
      'Outreach Sent': 2,
      "Tomorrow's Top 3": '1) Test app\n2) Apply\n3) Follow up'
    },
    allowStatuses: [200]
  })
  if (!createDaily.body?.ok || !createDaily.body?.id) throw new Error('Daily check-in save failed')
  note('Daily check-in create passed')

  const today = await api('/api/daily/today?date_label=Smoke%20Test%20Day', { allowStatuses: [200] })
  if (!today.body?.id) throw new Error('Could not read back saved daily check-in')

  const sync = await api('/api/sheets/sync', {
    method: 'POST',
    body: {},
    allowStatuses: [200, 400, 401, 403, 500]
  })
  if (sync.status !== 200) {
    if (!sync.body?.error || !sync.body?.code) {
      throw new Error(`Sync error response missing details: ${JSON.stringify(sync.body)}`)
    }
    note(`Sync path exercised with expected config error (${sync.body.code})`)
  } else {
    note('Sync path exercised successfully')
  }

  await api('/api/logout', { method: 'POST', allowStatuses: [200] })
  note('Logout passed')
  note('Smoke test passed')
}

try {
  await run()
} catch (err) {
  console.error('[smoke] FAILED:', err?.message || err)
  if (stdoutBuf) console.error('\n[smoke] server stdout (tail):\n' + stdoutBuf)
  if (stderrBuf) console.error('\n[smoke] server stderr (tail):\n' + stderrBuf)
  process.exitCode = 1
} finally {
  if (server && !server.killed) {
    server.kill('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 200))
    if (!server.killed) server.kill('SIGKILL')
  }
  await rm(tempDir, { recursive: true, force: true }).catch(() => {})
}
