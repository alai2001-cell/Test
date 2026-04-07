const API_BASE = 'https://api.limitless.ai/v1'

export async function apiFetch(path, apiKey) {
  let resp
  try {
    resp = await fetch(`${API_BASE}${path}`, {
      headers: { 'X-API-Key': apiKey },
    })
  } catch (e) {
    throw new Error('Network error - the API may not allow requests from this domain (CORS). Try running locally instead. Details: ' + e.message)
  }
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API error ${resp.status}: ${text}`)
  }
  return resp.json()
}

export function formatDateParam(d) {
  return d.toISOString().slice(0, 10)
}

export async function fetchAllLifelogs(apiKey, days = 30, onProgress) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - days)

  let all = []
  let cursor = null
  let pages = 0
  const maxPages = Math.max(10, Math.ceil(days / 3))

  do {
    const params = new URLSearchParams({
      timezone: tz,
      start: formatDateParam(startDate),
      end: formatDateParam(now),
      limit: '100',
      includeMarkdown: 'false',
      includeHeadings: 'true',
    })
    if (cursor) params.set('cursor', cursor)

    const resp = await apiFetch(`/lifelogs?${params}`, apiKey)
    const logs = resp.data?.lifelogs || []
    all = all.concat(logs)
    cursor = resp.meta?.lifelogs?.nextCursor || null
    pages++
    if (onProgress) onProgress(all.length)
  } while (cursor && pages < maxPages)

  return all
}

export async function fetchLifelogPage(apiKey, { cursor, date, starred, limit = 20 }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const params = new URLSearchParams({
    timezone: tz,
    limit: String(limit),
    direction: 'desc',
    includeMarkdown: 'true',
    includeHeadings: 'true',
  })
  if (date) params.set('date', date)
  if (starred) params.set('isStarred', 'true')
  if (cursor) params.set('cursor', cursor)

  const resp = await apiFetch(`/lifelogs?${params}`, apiKey)
  return {
    lifelogs: resp.data?.lifelogs || [],
    nextCursor: resp.meta?.lifelogs?.nextCursor || null,
  }
}

export function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
