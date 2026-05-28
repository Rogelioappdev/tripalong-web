'use client'

import { useEffect, useState } from 'react'

export type NetworkStatus = 'online' | 'offline' | 'reconnected'

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>('online')

  useEffect(() => {
    // Read real state after mount (navigator.onLine is unreliable before hydration)
    if (!navigator.onLine) setStatus('offline')

    let timer: ReturnType<typeof setTimeout>

    const handleOffline = () => {
      clearTimeout(timer)
      setStatus('offline')
    }

    const handleOnline = () => {
      clearTimeout(timer)
      setStatus('reconnected')
      timer = setTimeout(() => setStatus('online'), 2500)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return status
}
