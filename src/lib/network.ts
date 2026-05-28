'use client'

import { useEffect, useState } from 'react'

type NetworkStatus = 'online' | 'offline' | 'reconnected'

let _status: NetworkStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
const _listeners = new Set<(s: NetworkStatus) => void>()

function _set(s: NetworkStatus) {
  _status = s
  _listeners.forEach(fn => fn(s))
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => _set('offline'))
  window.addEventListener('online', () => {
    _set('reconnected')
    // Auto-clear "reconnected" toast after 2.5s
    setTimeout(() => { if (_status === 'reconnected') _set('online') }, 2500)
  })
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(_status)

  useEffect(() => {
    _listeners.add(setStatus)
    setStatus(_status)
    return () => { _listeners.delete(setStatus) }
  }, [])

  return status
}
