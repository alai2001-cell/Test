import React from 'react'

export default function Header({ connected, connecting, error, onSettings, onRefresh }) {
  const statusClass = connected ? 'connected' : error ? 'error' : ''
  const statusText = connected ? 'Connected' : connecting ? 'Connecting...' : error ? 'Connection failed' : 'Not connected'

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h1>Limitless <span>Dashboard</span></h1>
      </div>
      <div className="header-actions">
        <div className="connection-status">
          <div className={`status-dot ${statusClass}`} />
          <span>{statusText}</span>
        </div>
        {connected && (
          <>
            <button className="btn btn-sm btn-ghost" onClick={onSettings}>Disconnect</button>
            <button className="btn btn-sm" onClick={onRefresh}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
          </>
        )}
      </div>
    </header>
  )
}
