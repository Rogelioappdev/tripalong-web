'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getTrip, getTripChat } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { JoinCelebration } from './JoinCelebration'
import type { TripWithDetails } from '@/lib/types'

// Mounted app-wide (protected layout) rather than on a single page — the
// creator accepting a join request happens on their own device, so the
// requester only finds out live via realtime, regardless of which tab
// they're currently on.
export function JoinRequestAcceptedListener({ userId }: { userId: string }) {
  const router = useRouter()
  const [celebrationTrip, setCelebrationTrip] = useState<TripWithDetails | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`join-request-accepted:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trip_join_requests', filter: `requester_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as { status: string; trip_id: string }
          if (row.status !== 'accepted') return
          try {
            const trip = await getTrip(row.trip_id)
            haptic([15, 30, 15, 30, 60])
            setCelebrationTrip(trip)
          } catch {}
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <AnimatePresence>
      {celebrationTrip && (
        <JoinCelebration
          trip={celebrationTrip}
          onOpenChat={async () => {
            try {
              const chat = await getTripChat(celebrationTrip.id)
              setCelebrationTrip(null)
              router.push(`/chat/${chat.id}`)
            } catch {
              setCelebrationTrip(null)
            }
          }}
          onClose={() => setCelebrationTrip(null)}
        />
      )}
    </AnimatePresence>
  )
}
