import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend)

const RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '1y', days: 365 },
]

function aggregateByDay(logs, days) {
  const now = new Date()
  const labels = []
  const counts = []
  const durations = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)

    // For large ranges, show fewer labels
    if (days <= 30) {
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    } else if (days <= 90) {
      labels.push(i % 3 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
    } else if (days <= 180) {
      labels.push(i % 7 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
    } else {
      labels.push(i % 14 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
    }

    const dayLogs = logs.filter((l) => l.startTime && l.startTime.slice(0, 10) === dateStr)
    counts.push(dayLogs.length)

    let dayMs = 0
    dayLogs.forEach((l) => {
      if (l.startTime && l.endTime) dayMs += new Date(l.endTime) - new Date(l.startTime)
    })
    durations.push(Math.round(dayMs / 60000))
  }

  return { labels, counts, durations }
}

function aggregateByWeek(logs, days) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)

  // Group by ISO week
  const weekMap = new Map()
  logs.forEach((log) => {
    if (!log.startTime) return
    const d = new Date(log.startTime)
    // Get Monday of the week
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    const weekKey = monday.toISOString().slice(0, 10)

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { count: 0, ms: 0, date: monday })
    }
    const entry = weekMap.get(weekKey)
    entry.count++
    if (log.startTime && log.endTime) {
      entry.ms += new Date(log.endTime) - new Date(log.startTime)
    }
  })

  const sorted = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  return {
    labels: sorted.map(([, v]) => v.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    counts: sorted.map(([, v]) => v.count),
    durations: sorted.map(([, v]) => Math.round(v.ms / 60000)),
  }
}

export default function ActivityChart({ logs, loading, onRangeChange }) {
  const [range, setRange] = useState(30)
  const chartRef = useRef(null)

  const handleRange = (days) => {
    setRange(days)
    if (onRangeChange) onRangeChange(days)
  }

  const useWeekly = range > 90
  const { labels, counts, durations } = useMemo(() => {
    if (logs.length === 0) return { labels: [], counts: [], durations: [] }
    const filtered = logs.filter((l) => {
      if (!l.startTime) return false
      const d = new Date(l.startTime)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - range)
      return d >= cutoff
    })
    return useWeekly ? aggregateByWeek(filtered, range) : aggregateByDay(filtered, range)
  }, [logs, range, useWeekly])

  const totalMinutes = durations.reduce((a, b) => a + b, 0)
  const totalRecordings = counts.reduce((a, b) => a + b, 0)

  const data = {
    labels,
    datasets: [
      {
        label: 'Recordings',
        data: counts,
        backgroundColor: 'rgba(108, 99, 255, 0.5)',
        borderColor: 'rgba(108, 99, 255, 0.9)',
        borderWidth: 1,
        borderRadius: range <= 30 ? 6 : 3,
        yAxisID: 'y',
        order: 2,
      },
      {
        label: `Duration (min${useWeekly ? '/week' : ''})`,
        data: durations,
        type: 'line',
        borderColor: 'rgba(34, 211, 238, 0.9)',
        backgroundColor: 'rgba(34, 211, 238, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: range <= 30 ? 3 : range <= 90 ? 2 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(34, 211, 238, 1)',
        yAxisID: 'y1',
        order: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#9aa0b4',
          font: { size: 11, family: 'Inter' },
          boxWidth: 12,
          boxHeight: 12,
          borderRadius: 3,
          useBorderRadius: true,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(26, 29, 39, 0.95)',
        borderColor: 'rgba(46, 51, 72, 0.8)',
        borderWidth: 1,
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'Inter', size: 11 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(46, 51, 72, 0.3)' },
        ticks: {
          color: '#6b7185',
          font: { size: 10, family: 'Inter' },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: range <= 30 ? 30 : range <= 90 ? 15 : 12,
        },
      },
      y: {
        position: 'left',
        beginAtZero: true,
        grid: { color: 'rgba(46, 51, 72, 0.3)' },
        ticks: { color: '#6b7185', font: { size: 10, family: 'Inter' }, stepSize: 1 },
        title: { display: true, text: 'Recordings', color: '#6b7185', font: { size: 10, family: 'Inter' } },
      },
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { color: '#6b7185', font: { size: 10, family: 'Inter' } },
        title: { display: true, text: 'Minutes', color: '#6b7185', font: { size: 10, family: 'Inter' } },
      },
    },
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-title">Recording Activity</span>
          <span className="card-subtitle">
            {totalRecordings} recordings &middot; {Math.round(totalMinutes / 60)}h {totalMinutes % 60}m total
            {useWeekly && ' (weekly)'}
          </span>
        </div>
        <div className="range-chips">
          {RANGES.map((r) => (
            <button
              key={r.days}
              className={`filter-chip${range === r.days ? ' active' : ''}`}
              onClick={() => handleRange(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container">
        {loading ? (
          <div className="loading">
            <div className="spinner" /> Loading chart data...
          </div>
        ) : labels.length === 0 ? (
          <div className="loading">No data for this range</div>
        ) : (
          <Bar ref={chartRef} data={data} options={options} />
        )}
      </div>
    </div>
  )
}
