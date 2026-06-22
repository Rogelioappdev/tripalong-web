'use client'

import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { useState, useEffect } from 'react'

// Our WebView sets userAgent "TripAlong/1.0 (Mobile)".
// The app has 20+ framer-motion elements that start at opacity:0 —
// fine in a browser, but each one briefly exposes the black native
// WKWebView background causing whole-screen black flashes.
// reducedMotion="always" snaps all animations to their final state
// instantly so the browser never paints an intermediate opacity:0 frame.
const isNativeApp =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('TripAlong')

// Tell React Query to use browser online/offline events
if (typeof window !== 'undefined') {
  onlineManager.setEventListener(setOnline => {
    const handler = () => setOnline(navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('offline', handler)
    }
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,       // 5 min — Supabase realtime handles live updates
        gcTime: 10 * 60 * 1000,          // keep unused cache 10 min before GC
        retry: 2,
        retryDelay: attempt => Math.min(800 * (attempt + 1), 4000),
        refetchOnWindowFocus: false,     // realtime invalidates; tab-switch refetch is wasteful
        refetchOnReconnect: 'always',
        networkMode: 'always',
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={isNativeApp ? 'always' : 'never'}>
        {children}
      </MotionConfig>
    </QueryClientProvider>
  )
}
