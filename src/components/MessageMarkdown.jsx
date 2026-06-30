function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderMarkdown(md) {
  let html = escapeHtml(md)

  html = html.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre><code>${code}</code></pre>`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  const lines = html.split('\n')
  const chunks = []
  let inList = false

  for (const line of lines) {
    const hr = line.match(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/)
    if (hr) {
      if (inList) {
        chunks.push('</ul>')
        inList = false
      }
      chunks.push('<hr/>')
      continue
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (heading) {
      if (inList) {
        chunks.push('</ul>')
        inList = false
      }
      const level = Math.min(6, heading[1].length)
      const body = heading[2]
      chunks.push(`<h${level}>${body}</h${level}>`)
      continue
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        chunks.push('<ul>')
        inList = true
      }
      chunks.push(`<li>${bullet[1]}</li>`)
      continue
    }
    if (inList) {
      chunks.push('</ul>')
      inList = false
    }
    if (!line.trim()) {
      chunks.push('<br/>')
    } else {
      chunks.push(`<p>${line}</p>`)
    }
  }
  if (inList) chunks.push('</ul>')
  return chunks.join('')
}

export default function MessageMarkdown({ text }) {
  return (
    <div
      className="message-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  )
}
