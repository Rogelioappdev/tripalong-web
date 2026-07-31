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
// Touching last_active_at on every focus/foreground would be a lot of writes
// for a column that only needs day-or-so granularity (it backs a 30-day
// active-user count, see supabase/migrations/20260731_active_users_30d.sql) —
// throttle to roughly once per hour per device via localStorage.
const LAST_ACTIVE_TOUCH_KEY = 'ta_last_active_touch'
const LAST_ACTIVE_TOUCH_INTERVAL_MS = 60 * 60 * 1000

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

    const touchLastActive = async () => {
      try {
        const lastTouch = Number(localStorage.getItem(LAST_ACTIVE_TOUCH_KEY) ?? 0)
        if (Date.now() - lastTouch < LAST_ACTIVE_TOUCH_INTERVAL_MS) return
        const { data } = await supabase.auth.getUser()
        if (cancelled || !data.user) return
        await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', data.user.id)
        localStorage.setItem(LAST_ACTIVE_TOUCH_KEY, String(Date.now()))
      } catch {
        // Best-effort only — this is a stat, not something correctness
        // depends on. A dropped write here retries on the next focus event.
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
      touchLastActive()
    }

    // Kick things off for the current (foreground) load, then track lifecycle.
    supabase.auth.startAutoRefresh()
    revive()
    touchLastActive()
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
