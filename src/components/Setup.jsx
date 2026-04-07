import React, { useState } from 'react'

export default function Setup({ onConnect, connecting }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!key.trim()) {
      setError('Please enter an API key.')
      return
    }
    setError('')
    try {
      const ok = await onConnect(key.trim())
      if (!ok) {
        setError('Invalid API key or connection failed. Check your key and try again.')
      }
    } catch (e) {
      setError(e.message || 'Connection failed.')
    }
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h2>Connect Your Pendant</h2>
        <p>Enter your Limitless API key to start viewing your lifelog data.</p>
        <form onSubmit={handleSubmit} className="setup-form">
          <div className="input-group">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your API key..."
              autoComplete="off"
              disabled={connecting}
            />
            <button className="btn btn-primary" type="submit" disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
          {error && <div className="setup-error">{error}</div>}
        </form>
        <p className="setup-hint">
          Get your API key from{' '}
          <a href="https://www.limitless.ai/developers" target="_blank" rel="noopener noreferrer">
            limitless.ai/developers
          </a>
          . Your key is stored locally in your browser.
        </p>
      </div>
    </div>
  )
}
