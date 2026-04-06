import React, { useState, useCallback, useEffect } from 'react'
import { fetchLifelogPage, escHtml } from '../api'

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatDuration(startStr, endStr) {
  if (!startStr || !endStr) return ''
  const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000)
  if (mins < 60) return `${mins}m`
  return `${(mins / 60).toFixed(1)}h`
}

function formatLongDuration(startStr, endStr) {
  if (!startStr || !endStr) return ''
  const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000)
  if (mins < 60) return `${mins} minutes`
  return `${(mins / 60).toFixed(1)} hours`
}

function renderContents(contents) {
  if (!contents || contents.length === 0) return null
  return contents.map((node, i) => {
    if (node.type === 'heading1' || node.type === 'heading2' || node.type === 'heading3') {
      return <div key={i} className="heading-node">{node.content || ''}</div>
    }

    if (node.type === 'blockquote') {
      const speaker = node.speakerName || 'Unknown'
      const isUser = node.speakerIdentifier === 'user'
      return (
        <div key={i} className="transcript-block">
          <div className={`speaker-label ${isUser ? 'user' : 'other'}`}>{speaker}</div>
          <div className="transcript-text">{node.content || ''}</div>
        </div>
      )
    }

    if (node.children && node.children.length > 0) {
      return (
        <React.Fragment key={i}>
          {(node.type === 'heading1' || node.type === 'heading2') && (
            <div className="heading-node">{node.content || ''}</div>
          )}
          {renderContents(node.children)}
        </React.Fragment>
      )
    }

    if (node.content) {
      return <div key={i} className="transcript-text">{node.content}</div>
    }

    return null
  })
}

export default function LifelogBrowser({ apiKey }) {
  const [lifelogs, setLifelogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [cursors, setCursors] = useState([null])
  const [nextCursor, setNextCursor] = useState(null)

  const loadPage = useCallback(async (cursor) => {
    setLoading(true)
    try {
      const result = await fetchLifelogPage(apiKey, {
        cursor,
        date: dateFilter || undefined,
        starred: starredOnly,
      })
      setLifelogs(result.lifelogs)
      setNextCursor(result.nextCursor)
    } catch (e) {
      console.error('Failed to load lifelogs:', e)
      setLifelogs([])
    } finally {
      setLoading(false)
    }
  }, [apiKey, dateFilter, starredOnly])

  useEffect(() => {
    loadPage(null)
    setCurrentPage(0)
    setCursors([null])
  }, [loadPage])

  const applyFilters = () => {
    setCurrentPage(0)
    setCursors([null])
    setSelectedId(null)
    loadPage(null)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setDateFilter('')
    setStarredOnly(false)
    setSelectedId(null)
    setCurrentPage(0)
    setCursors([null])
  }

  const goNext = () => {
    if (!nextCursor) return
    const newPage = currentPage + 1
    setCurrentPage(newPage)
    setCursors((prev) => {
      const updated = [...prev]
      if (!updated[newPage]) updated[newPage] = nextCursor
      return updated
    })
    loadPage(nextCursor)
  }

  const goPrev = () => {
    if (currentPage === 0) return
    const newPage = currentPage - 1
    setCurrentPage(newPage)
    loadPage(cursors[newPage])
  }

  // Client-side search filter
  let displayLogs = lifelogs
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase()
    displayLogs = lifelogs.filter((l) => {
      const title = (l.title || '').toLowerCase()
      const md = (l.markdown || '').toLowerCase()
      return title.includes(term) || md.includes(term)
    })
  }

  const selectedLog = lifelogs.find((l) => l.id === selectedId)

  return (
    <>
      <div className="filters-bar">
        <div className="search-wrap">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search lifelogs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <input
          className="date-input"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <button
          className={`filter-chip${starredOnly ? ' active' : ''}`}
          onClick={() => setStarredOnly(!starredOnly)}
        >
          Starred only
        </button>
        <button className="btn btn-sm btn-primary" onClick={applyFilters}>Search</button>
        <button className="btn btn-sm" onClick={clearFilters}>Clear</button>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Lifelogs</span>
            <span className="result-count">{displayLogs.length} results</span>
          </div>
          <div className="lifelog-list">
            {loading ? (
              <div className="loading"><div className="spinner" /> Loading lifelogs...</div>
            ) : displayLogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h3>No lifelogs found</h3>
                <p>Try adjusting your filters</p>
              </div>
            ) : (
              displayLogs.map((log) => (
                <div
                  key={log.id}
                  className={`lifelog-item${log.id === selectedId ? ' active' : ''}`}
                  onClick={() => setSelectedId(log.id)}
                >
                  <div className="lifelog-title-row">
                    <span className="lifelog-title">{log.title || 'Untitled'}</span>
                    {log.isStarred && <span className="lifelog-star">&#11088;</span>}
                  </div>
                  <div className="lifelog-meta">
                    <span>{formatDate(log.startTime)}</span>
                    <span>{formatTime(log.startTime)}</span>
                    <span>{formatDuration(log.startTime, log.endTime)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="pagination">
            <button className="btn btn-sm" onClick={goPrev} disabled={currentPage === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Prev
            </button>
            <span className="page-info">Page {currentPage + 1}</span>
            <button className="btn btn-sm" onClick={goNext} disabled={!nextCursor}>
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Detail</span>
          </div>
          <div className="detail-panel">
            {!selectedLog ? (
              <div className="detail-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.15">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p>Select a lifelog to view details</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <h3>
                    {selectedLog.title || 'Untitled'}
                    {selectedLog.isStarred && ' \u2B50'}
                  </h3>
                  <div className="meta-row">
                    <span>{formatFullDate(selectedLog.startTime)}</span>
                    <span>
                      {formatTime(selectedLog.startTime)}
                      {selectedLog.endTime && ` - ${formatTime(selectedLog.endTime)}`}
                    </span>
                    <span>{formatLongDuration(selectedLog.startTime, selectedLog.endTime)}</span>
                  </div>
                </div>
                <div className="detail-content">
                  {selectedLog.contents && selectedLog.contents.length > 0 ? (
                    renderContents(selectedLog.contents)
                  ) : selectedLog.markdown ? (
                    <div className="transcript-text">
                      {selectedLog.markdown.split('\n').map((line, i) => (
                        <React.Fragment key={i}>{line}<br /></React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state"><p>No content available</p></div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
