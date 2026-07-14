'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/lib/queries'
import { isProfileComplete } from '@/lib/profileCompleteness'

// Pages where an incomplete profile must still be reachable — the completion
// surfaces themselves, plus settings (needs to stay reachable to sign out).
const GATE_EXEMPT = ['/onboarding', '/travel-dna', '/profile', '/settings']

function isExempt(pathname: string) {
  return GATE_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// App-wide profile-completeness gate. Recomputes completeness from a fresh
// DB read (not from any client-cached/stale state) so it can't be bypassed
// by client-side state manipulation — an incomplete profile is redirected to
// finish it before reaching feed/messages/trips. Guests (no session) pass
// through untouched; individual pages still handle their own
// unauthenticated-redirect logic.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  // Once we've confirmed completeness this session, skip the round-trip on
  // every subsequent nav (it doesn't change on its own) — except right after
  // leaving one of the completion surfaces, where it may have just changed.
  const knownCompleteRef = useRef(false)
  const prevPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const prevPathname = prevPathnameRef.current
    prevPathnameRef.current = pathname

    const exempt = isExempt(pathname)
    const justLeftCompletionSurface = !!prevPathname && isExempt(prevPathname)

    if (exempt || (knownCompleteRef.current && !justLeftCompletionSurface)) {
      setReady(true)
      return
    }

    setReady(false)
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      const user = data.user
      if (!user) { setReady(true); return } // guest browsing — pages handle their own auth gate

      const profile = await getProfile(user.id)
      if (cancelled) return

      if (!isProfileComplete(profile)) {
        router.replace('/profile')
        return
      }
      knownCompleteRef.current = true
      setReady(true)
    })

    return () => { cancelled = true }
  }, [pathname, router])

  if (!ready) {
    return <div className="min-h-screen bg-black" />
  }

  return <>{children}</>
}
