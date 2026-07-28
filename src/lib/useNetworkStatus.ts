'use client'

import { useEffect, useState } from 'react'

// navigator.onLine starts true on the server/first paint so there's no
// hydration mismatch, then syncs to the real value + live online/offline
// events once mounted. Deliberately doesn't use the Network Information API
// (navigator.connection.effectiveType) for "slow" detection — it's Chrome/
// Android-only and unsupported in Safari/iOS, which this app ships to as a
// native wrapper, so it would silently never fire there. A load-duration
// timeout in the caller is a more reliable, cross-platform way to detect
// "this is taking too long" than trusting a browser API that may not exist.
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return { isOnline }
}
