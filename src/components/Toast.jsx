import React, { useEffect } from 'react'

export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(onDone, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast, onDone])

  if (!toast) return null

  return (
    <div className={`toast show ${toast.type || ''}`}>
      {toast.msg}
    </div>
  )
}
