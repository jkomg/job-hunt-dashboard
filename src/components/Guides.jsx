export default function Guides() {
  return (
    <div>
      <div className="morning-greeting">Guides</div>
      <div className="today-date">In-app setup docs for common workflows</div>

      <div className="card mb-16">
        <div className="card-title">Bring Your Own AI Agent</div>
        <div style={{ color: 'var(--text-muted)', marginBottom: 10 }}>
          Job Hunt Dashboard does not host your agent runtime. Your external agent sends leads to your account through a secure ingest token.
        </div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Open <strong>Settings → Operations → Bring Your Own AI Agent</strong>.</li>
          <li>Enable ingest, save settings, then generate a token.</li>
          <li>Store that token in your external agent as a secret.</li>
          <li>Send leads to <code>POST /api/agents/ingest</code> with header <code>x-agent-token</code>.</li>
        </ol>
      </div>

      <div className="card mb-16">
        <div className="card-title">Claude / ChatGPT Agent Request Format</div>
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>{`POST /api/agents/ingest
Headers:
  x-agent-token: <YOUR_TOKEN>
  Content-Type: application/json
Body:
{
  "entries": [
    {
      "company": "Acme Health",
      "role": "Senior Customer Success Manager",
      "jobUrl": "https://jobs.example.com/acme-csm",
      "source": "LinkedIn",
      "notes": "Strong fit for enterprise CS + regulated accounts",
      "stage": "🔍 Researching"
    }
  ]
}`}</pre>
        <div style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: 13 }}>
          Rules: <code>company</code> is required, max 25 entries/request, dedupe is automatic by <code>jobUrl</code> then <code>company+role</code>.
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Claude Setup Checklist</div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Keep your existing search + scoring instructions.</li>
          <li>After your own filtering/dedupe, build <code>entries[]</code>.</li>
          <li>POST leads to dashboard ingest as the final step.</li>
          <li>Batch when needed (25 rows max/request).</li>
        </ol>
      </div>

      <div className="card">
        <div className="card-title">Troubleshooting</div>
        <div><code>401 Missing agent token</code>: header not sent.</div>
        <div><code>401 Invalid agent token</code>: token mismatch; rotate token and update the external agent.</div>
        <div><code>400 entries[] is required</code>: payload format is wrong.</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 10 }}>
          Security: treat <code>x-agent-token</code> like a password and rotate it if exposed.
        </div>
      </div>
    </div>
  )
}
