'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProfileViewToast } from '@/components/ProfileViewToast'
import { ProfileViewsSheet } from '@/components/ProfileViewsSheet'
import { SessionKeeper } from '@/components/SessionKeeper'
import { NotifReminderHost } from '@/components/NotifReminderHost'
import { JoinRequestAcceptedListener } from '@/components/JoinRequestAcceptedListener'
import { getProfile } from '@/lib/queries'
import { hasPlus } from '@/lib/trial'
import { track } from '@/lib/analytics'

// Wraps every protected page so app-wide overlays (currently: the new-profile-
// view toast) show up regardless of which tab the user is on, instead of
// only where a page happened to mount them one-off (see MemberJoinToast,
// which is feed-only for that reason).
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  // The toast is app-wide, so the sheet it opens has to be too — otherwise
  // tapping "someone viewed you" from Messages or Profile would have nowhere
  // to go.
  const [showViews, setShowViews] = useState(false)
  const [isPlus, setIsPlus] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    getProfile(userId).then(p => setIsPlus(hasPlus(p))).catch(() => {})
  }, [userId])

  return (
    <>
      <SessionKeeper />
      {children}
      {userId && (
        <ProfileViewToast
          userId={userId}
          onOpen={() => {
            track('profile_views_opened', { viewer_count: 0, source: 'toast', is_plus: isPlus })
            setShowViews(true)
          }}
        />
      )}
      {showViews && userId && (
        <ProfileViewsSheet
          isPlus={isPlus}
          userId={userId}
          onClose={() => setShowViews(false)}
          onUnlocked={() => setIsPlus(true)}
          onWelcomeDone={(nowPlus) => setIsPlus(nowPlus)}
        />
      )}
      {userId && <JoinRequestAcceptedListener userId={userId} />}
      <NotifReminderHost />
    </>
  )
}
