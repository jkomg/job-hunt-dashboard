import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui-icons.jsx'
import { DEMO_NEXT_ACTION, DEMO_PERSON } from '../demoData.js'

export default function Login({ onLogin, onDemo }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSignin, setShowSignin] = useState(false)
  const modalRef = useRef(null)
  const usernameRef = useRef(null)

  useEffect(() => {
    if (!showSignin) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    usernameRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowSignin(false)
        return
      }
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [showSignin])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ username, password }) })
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Login failed'); return }
      onLogin()
    } catch { setError('Could not connect to server') }
    finally { setLoading(false) }
  }

  return (
    <div className="public-home">
      <header className="public-nav">
        <a className="public-brand" href="/" aria-label="Job Hunt home"><span><Icon name="briefcase" /></span><strong>Job Hunt<i>.</i></strong></a>
        <div className="public-nav-proof"><span><i /> Built for accountable momentum</span></div>
        <button className="public-signin" type="button" aria-expanded={showSignin} aria-controls="client-signin-dialog" onClick={() => setShowSignin(true)}>Client sign in <Icon name="arrow-right" /></button>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <span className="public-kicker"><Icon name="sparkles" /> A better operating system for the job search</span>
            <h1>Turn job-search effort into <em>visible momentum.</em></h1>
            <p>Job Hunt gives individuals clarity and gives support teams the signals to help at exactly the right moment.</p>
            <div className="public-cta-row"><button className="public-primary" type="button" onClick={() => onDemo('solo')}>Explore the solo demo <Icon name="arrow-right" /></button><button className="public-secondary" type="button" onClick={() => onDemo('partner')}>See the partner view</button></div>
            <div className="public-trust-row"><span><Icon name="circle-check" /> Clear next actions</span><span><Icon name="circle-check" /> Human support signals</span><span><Icon name="circle-check" /> No busywork</span></div>
          </div>
          <div className="public-product" aria-label="Job Hunt product preview">
            <div className="public-product-top"><span><i /><i /><i /></span><strong>Saturday briefing</strong><small>Sample workspace</small></div>
            <div className="public-product-body">
              <aside><span className="active"><Icon name="sunrise" /> Briefing</span><span><Icon name="columns" /> Pipeline</span><span><Icon name="users" /> Outreach</span><span><Icon name="phone" /> Interviews</span></aside>
              <div className="public-product-main">
                <div className="public-preview-head"><div><small>GOOD MORNING, {DEMO_PERSON.firstName.toUpperCase()}</small><strong>Your search is moving.</strong><p>One focused hour keeps three conversations warm.</p></div><div><b>{DEMO_PERSON.momentum}</b><span>momentum</span></div></div>
                <div className="public-preview-stats"><span><small>ACTIVE ROLES</small><b>12</b><em>3 need attention</em></span><span><small>CONVERSATIONS</small><b>8</b><em>+2 this week</em></span><span><small>INTERVIEWS</small><b>3</b><em>Next Tuesday</em></span></div>
                <div className="public-preview-action"><span><Icon name="target" /></span><div><small>NEXT BEST ACTION</small><strong>{DEMO_NEXT_ACTION.title}</strong><p>{DEMO_NEXT_ACTION.detail}</p></div><button type="button" onClick={() => onDemo('solo')} aria-label="Open solo demo"><Icon name="arrow-right" /></button></div>
              </div>
            </div>
          </div>
        </section>

        <section className="public-audiences">
          <div className="public-section-head"><span>ONE PRODUCT · TWO POWERFUL VIEWS</span><h2>Personal enough for one person.<br />Operational enough for a whole program.</h2></div>
          <div className="public-audience-grid">
            <article className="public-audience-card solo"><div className="public-card-icon"><Icon name="user" /></div><span>FOR JOB HUNTERS</span><h3>A calmer search, every day.</h3><p>Know what matters now, keep relationships warm, and build a repeatable rhythm without juggling five tools.</p><ul><li><Icon name="check" /> Daily focus and momentum score</li><li><Icon name="check" /> Pipeline, outreach, and interview prep</li><li><Icon name="check" /> Progress you can actually feel</li></ul><button type="button" onClick={() => onDemo('solo')}>Open solo workspace <Icon name="arrow-right" /></button></article>
            <article className="public-audience-card partner"><div className="public-card-icon"><Icon name="building" /></div><span>FOR AGENCIES & PROGRAMS</span><h3>Scale support, not spreadsheets.</h3><p>Give every coach a live view of client momentum, blockers, and the interventions most likely to help.</p><ul><li><Icon name="check" /> Portfolio health at a glance</li><li><Icon name="check" /> Proactive intervention queues</li><li><Icon name="check" /> Consistent service across the team</li></ul><button type="button" onClick={() => onDemo('partner')}>Open partner workspace <Icon name="arrow-right" /></button></article>
          </div>
        </section>
        <section className="public-proof">
          <div className="public-proof-copy"><span>THE PRODUCT, NOT A PROMISE</span><h2>See the work that needs attention—before someone has to ask.</h2><p>A real, sanitized partner workspace shows candidate signals, active support work, and portfolio health in one operating view.</p><button type="button" onClick={() => onDemo('partner')}>Explore this workspace <Icon name="arrow-right" /></button></div>
          <figure><img src="/product-portfolio.png" alt="Sanitized Job Hunt portfolio operations workspace showing candidate signals and support queues" loading="lazy" /><figcaption>Sanitized sample workspace · no customer data</figcaption></figure>
        </section>
        <section className="public-bottom-cta"><div><span>READY TO SEE THE WHOLE STORY?</span><h2>Explore both sides of the job search.</h2><p>Switch between the job hunter and partner workspaces inside the demo.</p></div><button type="button" onClick={() => onDemo('partner')}>Launch interactive demo <Icon name="arrow-right" /></button></section>
      </main>

      <footer className="public-footer"><div className="public-brand"><span><Icon name="briefcase" /></span><strong>Job Hunt<i>.</i></strong></div><p>Designed for the human side of career momentum.</p><button type="button" onClick={() => setShowSignin(true)}>Existing clients →</button></footer>

      {showSignin && <div id="client-signin-dialog" className="public-modal" role="dialog" aria-modal="true" aria-labelledby="signin-title" aria-describedby="signin-description" onMouseDown={e => { if (e.target === e.currentTarget) setShowSignin(false) }}>
        <div ref={modalRef} className="login-card public-login-card"><button type="button" className="public-modal-close" onClick={() => setShowSignin(false)} aria-label="Close sign in"><Icon name="x" /></button><div className="public-login-mark"><Icon name="briefcase" /></div><h1 id="signin-title">Welcome back<span>.</span></h1><p id="signin-description" className="sub">Sign in to your Job Hunt workspace.</p><div className="login-note">New accounts are invite-only. Ask your program lead or administrator for an invite.</div>{error && <div className="error-msg" role="alert">{error}</div>}<form onSubmit={submit}><div className="field"><label htmlFor="login-username">Username</label><input ref={usernameRef} id="login-username" type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></div><div className="field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></div><button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form><button type="button" className="public-demo-link" onClick={() => onDemo('solo')}>Not a client yet? Explore the demo <Icon name="arrow-right" /></button></div>
      </div>}
    </div>
  )
}
