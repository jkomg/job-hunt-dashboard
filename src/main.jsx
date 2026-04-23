import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'

const originalFetch = window.fetch.bind(window)
let csrfTokenCache = null

function isMutatingMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase())
}

function isApiUrl(input) {
  const url = typeof input === 'string' ? input : input?.url || ''
  return url.startsWith('/api/')
}

function isCsrfExempt(input) {
  const url = typeof input === 'string' ? input : input?.url || ''
  return (
    url.startsWith('/api/login') ||
    url.startsWith('/api/health') ||
    url.startsWith('/api/internal/') ||
    url.startsWith('/api/csrf')
  )
}

async function ensureCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache
  const r = await originalFetch('/api/csrf', { credentials: 'include' })
  const d = await r.json().catch(() => ({}))
  if (r.ok && d?.token) {
    csrfTokenCache = d.token
    return csrfTokenCache
  }
  return null
}

window.fetch = async (input, init = {}) => {
  const method = String(init?.method || 'GET').toUpperCase()
  if (isApiUrl(input) && isMutatingMethod(method) && !isCsrfExempt(input)) {
    const token = await ensureCsrfToken()
    const headers = new Headers(init.headers || {})
    if (token) headers.set('x-csrf-token', token)
    return originalFetch(input, { ...init, headers })
  }
  return originalFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
