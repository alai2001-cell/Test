import React, { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/Header'
import Setup from './components/Setup'
import StatsGrid from './components/StatsGrid'
import ActivityChart from './components/ActivityChart'
import SpeakerAnalytics from './components/SpeakerAnalytics'
import LifelogBrowser from './components/LifelogBrowser'
import Toast from './components/Toast'
import { apiFetch, fetchAllLifelogs } from './api'

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('limitless_api_key') || '')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(false)
  const [allLifelogs, setAllLifelogs] = useState([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [fetchedDays, setFetchedDays] = useState(0)
  const [toast, setToast] = useState(null)
  const [fetchProgress, setFetchProgress] = useState(0)
  const dataCache = useRef({})

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
  }, [])

  const verify = useCallback(async (key) => {
    setConnecting(true)
    setError(false)
    try {
      const resp = await apiFetch('/lifelogs?limit=1', key)
      if (resp.data) {
        setConnected(true)
        setConnecting(false)
        return true
      }
    } catch {
      setConnecting(false)
      setError(true)
      return false
    }
    return false
  }, [])

  const loadStats = useCallback(async (key, days = 90) => {
    if (dataCache.current[days]) {
      setAllLifelogs(dataCache.current[days])
      setFetchedDays(days)
      return
    }
    setLoadingStats(true)
    setFetchProgress(0)
    try {
      const logs = await fetchAllLifelogs(key, days, (count) => setFetchProgress(count))
      dataCache.current[days] = logs
      setAllLifelogs(logs)
      setFetchedDays(days)
    } catch (e) {
      showToast('Error loading data: ' + e.message, 'error')
    } finally {
      setLoadingStats(false)
      setFetchProgress(0)
    }
  }, [showToast])

  const handleConnect = useCallback(async (key) => {
    const ok = await verify(key)
    if (ok) {
      localStorage.setItem('limitless_api_key', key)
      setApiKey(key)
      loadStats(key, 90)
    }
    return ok
  }, [verify, loadStats])

  const handleRefresh = useCallback(() => {
    dataCache.current = {}
    showToast('Refreshing...')
    loadStats(apiKey, fetchedDays || 90)
  }, [apiKey, fetchedDays, loadStats, showToast])

  const handleRangeChange = useCallback((days) => {
    const neededDays = Math.max(days, fetchedDays)
    if (neededDays > fetchedDays) {
      loadStats(apiKey, neededDays)
    }
  }, [apiKey, fetchedDays, loadStats])

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem('limitless_api_key')
    setApiKey('')
    setConnected(false)
    setAllLifelogs([])
    dataCache.current = {}
    setFetchedDays(0)
  }, [])

  useEffect(() => {
    if (apiKey) {
      verify(apiKey).then((ok) => {
        if (ok) loadStats(apiKey, 90)
        else {
          localStorage.removeItem('limitless_api_key')
          setApiKey('')
          showToast('Stored API key is invalid.', 'error')
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!connected) {
    return (
      <>
        <Header connected={false} connecting={connecting} error={error} />
        <Setup onConnect={handleConnect} connecting={connecting} />
        <Toast toast={toast} onDone={() => setToast(null)} />
      </>
    )
  }

  return (
    <>
      <Header
        connected={true}
        connecting={connecting}
        error={error}
        onSettings={handleDisconnect}
        onRefresh={handleRefresh}
      />
      <main className="main">
        <StatsGrid logs={allLifelogs} loading={loadingStats} progress={fetchProgress} />
        <div className="grid-2 wide-left">
          <ActivityChart
            logs={allLifelogs}
            loading={loadingStats}
            onRangeChange={handleRangeChange}
          />
          <SpeakerAnalytics logs={allLifelogs} loading={loadingStats} />
        </div>
        <LifelogBrowser apiKey={apiKey} />
      </main>
      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}
