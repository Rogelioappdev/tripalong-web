'use client'

import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

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
        staleTime: 2 * 60 * 1000,
        retry: 2,
        retryDelay: attempt => Math.min(800 * (attempt + 1), 4000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        networkMode: 'always', // always attempt; don't freeze on offline detection
      },
    },
  }))

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
