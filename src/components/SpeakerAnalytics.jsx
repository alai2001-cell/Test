import React, { useMemo, useRef, useEffect } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, ChartTooltip, Legend)

const COLORS = [
  '#6c63ff', '#22d3ee', '#34d399', '#fbbf24', '#f472b6',
  '#a78bfa', '#fb923c', '#94a3b8', '#e879f9', '#4ade80',
]

function extractSpeakers(logs) {
  const speakerData = {}

  logs.forEach((log) => {
    ;(log.contents || []).forEach((node) => {
      processSpeakerNode(node, log, speakerData)
      ;(node.children || []).forEach((child) => {
        processSpeakerNode(child, log, speakerData)
      })
    })
  })

  return Object.entries(speakerData)
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalChars: data.totalChars,
      isUser: data.isUser,
    }))
    .sort((a, b) => b.count - a.count)
}

function processSpeakerNode(node, log, speakerData) {
  if (node.speakerName && node.type === 'blockquote') {
    const name = node.speakerName
    if (!speakerData[name]) {
      speakerData[name] = { count: 0, totalChars: 0, isUser: node.speakerIdentifier === 'user' }
    }
    speakerData[name].count++
    speakerData[name].totalChars += (node.content || '').length
  }
}

export default function SpeakerAnalytics({ logs, loading }) {
  const speakers = useMemo(() => extractSpeakers(logs), [logs])
  const topSpeakers = speakers.slice(0, 10)
  const totalCount = speakers.reduce((a, s) => a + s.count, 0)

  const chartData = useMemo(() => {
    if (topSpeakers.length === 0) return null
    return {
      labels: topSpeakers.map((s) => s.name),
      datasets: [
        {
          data: topSpeakers.map((s) => s.count),
          backgroundColor: topSpeakers.map((_, i) => COLORS[i % COLORS.length]),
          borderColor: 'rgba(15, 17, 23, 0.8)',
          borderWidth: 2,
          hoverBorderWidth: 0,
          hoverOffset: 6,
        },
      ],
    }
  }, [topSpeakers])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(26, 29, 39, 0.95)',
        borderColor: 'rgba(46, 51, 72, 0.8)',
        borderWidth: 1,
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'Inter', size: 11 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const pct = totalCount ? ((ctx.raw / totalCount) * 100).toFixed(1) : 0
            return ` ${ctx.raw} mentions (${pct}%)`
          },
        },
      },
    },
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Speaker Analytics</span>
        </div>
        <div className="card-body">
          <div className="loading"><div className="spinner" /> Loading...</div>
        </div>
      </div>
    )
  }

  if (speakers.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Speaker Analytics</span>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p>No speaker data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-title">Speaker Analytics</span>
          <span className="card-subtitle">{speakers.length} speakers detected</span>
        </div>
      </div>
      <div className="card-body speaker-analytics-body">
        <div className="speaker-chart-wrap">
          {chartData && <Doughnut data={chartData} options={chartOptions} />}
          <div className="speaker-chart-center">
            <div className="speaker-chart-total">{totalCount}</div>
            <div className="speaker-chart-label">mentions</div>
          </div>
        </div>
        <div className="speaker-list">
          {topSpeakers.map((speaker, i) => {
            const pct = totalCount ? ((speaker.count / totalCount) * 100).toFixed(1) : 0
            const color = COLORS[i % COLORS.length]
            return (
              <div className="speaker-row" key={speaker.name}>
                <div className="speaker-dot" style={{ background: color }} />
                <div className="speaker-info">
                  <span className="speaker-name" title={speaker.name}>
                    {speaker.name}
                    {speaker.isUser && <span className="speaker-badge">you</span>}
                  </span>
                  <span className="speaker-meta">{speaker.count} mentions &middot; {pct}%</span>
                </div>
                <div className="speaker-bar-mini-wrap">
                  <div
                    className="speaker-bar-mini"
                    style={{
                      width: `${(speaker.count / topSpeakers[0].count) * 100}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
