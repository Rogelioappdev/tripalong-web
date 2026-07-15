'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProfileViewToast } from '@/components/ProfileViewToast'

// Wraps every protected page so app-wide overlays (currently: the new-profile-
// view toast) show up regardless of which tab the user is on, instead of
// only where a page happened to mount them one-off (see MemberJoinToast,
// which is feed-only for that reason).
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <>
      {children}
      {userId && <ProfileViewToast userId={userId} />}
    </>
  )
}
