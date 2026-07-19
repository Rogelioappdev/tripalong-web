'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Keeps the user signed in across app backgrounding/reopening.
//
// The problem this solves: in a web-wrapper/PWA the access token expires after
// ~1h, and Supabase's auto-refresh timer only ticks while the app is in the
// foreground. When the wrapper is backgrounded past expiry and then reopened,
// the token can be read as gone before a refresh fires — the app falls back to
// guest mode and the user looks "logged out".
//
// Fix: whenever the app becomes visible again (reopened / tab focused) we
// re-arm the refresh loop and proactively refresh the session, so a valid token
// is restored before any page reads it. Mounted once, app-wide, in the
// protected layout.
export function SessionKeeper() {
  useEffect(() => {
    let cancelled = false

    // Pull a fresh access token now, using the (long-lived) refresh token in
    // storage. Safe to call repeatedly; it no-ops when there's no session.
    const revive = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled || !data.session) return
        await supabase.auth.refreshSession()
      } catch {
        // Never tear the session down on a transient failure (e.g. no network
        // on cold launch) — leave the stored session in place to retry later.
      }
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        // Backgrounded: pause the timer so it doesn't fire mid-suspend.
        supabase.auth.stopAutoRefresh()
        return
      }
      supabase.auth.startAutoRefresh()
      revive()
    }

    // Kick things off for the current (foreground) load, then track lifecycle.
    supabase.auth.startAutoRefresh()
    revive()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', revive)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', revive)
    }
  }, [])

  return null
}
