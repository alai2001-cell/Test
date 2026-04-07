import React, { useMemo } from 'react'

function computeStats(logs) {
  const now = new Date()
  let totalMs = 0
  let longestMs = 0
  let starred = 0
  const speakers = new Set()
  const dailyMs = {}
  const weeklyMs = {}
  const monthlyMs = {}

  logs.forEach((log) => {
    if (log.isStarred) starred++

    // Speakers
    ;(log.contents || []).forEach((node) => {
      if (node.speakerName) speakers.add(node.speakerName)
      ;(node.children || []).forEach((child) => {
        if (child.speakerName) speakers.add(child.speakerName)
      })
    })

    if (log.startTime && log.endTime) {
      const start = new Date(log.startTime)
      const end = new Date(log.endTime)
      const ms = end - start
      if (ms > 0) {
        totalMs += ms
        if (ms > longestMs) longestMs = ms

        const dateKey = log.startTime.slice(0, 10)
        dailyMs[dateKey] = (dailyMs[dateKey] || 0) + ms

        // ISO week
        const d = new Date(start)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
        const week = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7) + 1
        const weekKey = `${d.getFullYear()}-W${week}`
        weeklyMs[weekKey] = (weeklyMs[weekKey] || 0) + ms

        const monthKey = log.startTime.slice(0, 7)
        monthlyMs[monthKey] = (monthlyMs[monthKey] || 0) + ms
      }
    }
  })

  // Averages
  const dayCount = Object.keys(dailyMs).length || 1
  const avgDailyMs = totalMs / dayCount

  // This week
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  let thisWeekMs = 0
  Object.entries(dailyMs).forEach(([dateStr, ms]) => {
    if (new Date(dateStr) >= startOfWeek) thisWeekMs += ms
  })

  // This month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  let thisMonthMs = 0
  Object.entries(dailyMs).forEach(([dateStr, ms]) => {
    if (new Date(dateStr) >= startOfMonth) thisMonthMs += ms
  })

  // Yearly projection (based on daily average)
  const yearlyProjectionHrs = (avgDailyMs / 3600000) * 365

  return {
    total: logs.length,
    totalMs,
    starred,
    speakers: speakers.size,
    longestMs,
    avgDailyMs,
    thisWeekMs,
    thisMonthMs,
    yearlyProjectionHrs,
    dailyMs,
    weeklyMs,
    monthlyMs,
  }
}

function formatDuration(ms) {
  if (ms < 60000) return '<1m'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = mins / 60
  if (hrs < 24) return `${hrs.toFixed(1)}h`
  const days = hrs / 24
  return `${days.toFixed(1)}d`
}

function formatHours(ms) {
  const hrs = ms / 3600000
  if (hrs < 1) return `${Math.round(ms / 60000)}m`
  return `${hrs.toFixed(1)}h`
}

const STAT_CONFIGS = [
  {
    key: 'total',
    label: 'Total Lifelogs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    color: 'purple',
    getValue: (s) => s.total,
    getSub: () => 'Recordings captured',
  },
  {
    key: 'duration',
    label: 'Total Duration',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    color: 'green',
    getValue: (s) => formatHours(s.totalMs),
    getSub: () => 'Total recording time',
  },
  {
    key: 'avgDaily',
    label: 'Avg Daily',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: 'cyan',
    getValue: (s) => `${Math.round(s.avgDailyMs / 60000)}m`,
    getSub: () => 'Minutes per day avg',
  },
  {
    key: 'longest',
    label: 'Longest Session',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    color: 'amber',
    getValue: (s) => formatDuration(s.longestMs),
    getSub: () => 'Peak recording',
  },
  {
    key: 'starred',
    label: 'Starred',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    color: 'amber',
    getValue: (s) => s.starred,
    getSub: () => 'Bookmarked lifelogs',
  },
  {
    key: 'speakers',
    label: 'Speakers',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: 'rose',
    getValue: (s) => s.speakers,
    getSub: () => 'Unique speakers',
  },
]

export default function StatsGrid({ logs, loading, progress }) {
  const stats = useMemo(() => computeStats(logs), [logs])

  return (
    <>
      <div className="stats-grid">
        {STAT_CONFIGS.map((cfg) => (
          <div className="stat-card" key={cfg.key}>
            <div className="stat-header">
              <span className="stat-label">{cfg.label}</span>
              <div className={`stat-icon ${cfg.color}`}>{cfg.icon}</div>
            </div>
            <div className="stat-value">
              {loading ? <span className="stat-loading" /> : cfg.getValue(stats)}
            </div>
            <div className="stat-sub">
              {loading && progress > 0 ? `Loading... ${progress} records` : cfg.getSub(stats)}
            </div>
          </div>
        ))}
      </div>

      {/* Time summary row */}
      <div className="time-summary">
        <div className="time-card">
          <div className="time-label">This Week</div>
          <div className="time-value">{loading ? '-' : formatHours(stats.thisWeekMs)}</div>
          <div className="time-sub">recording time</div>
        </div>
        <div className="time-card">
          <div className="time-label">This Month</div>
          <div className="time-value">{loading ? '-' : formatHours(stats.thisMonthMs)}</div>
          <div className="time-sub">recording time</div>
        </div>
        <div className="time-card">
          <div className="time-label">Yearly Projection</div>
          <div className="time-value">
            {loading ? '-' : `${Math.round(stats.yearlyProjectionHrs)}h`}
          </div>
          <div className="time-sub">estimated annual total</div>
        </div>
        <div className="time-card">
          <div className="time-label">Avg per Recording</div>
          <div className="time-value">
            {loading || stats.total === 0
              ? '-'
              : formatDuration(stats.totalMs / stats.total)}
          </div>
          <div className="time-sub">session length</div>
        </div>
      </div>
    </>
  )
}
