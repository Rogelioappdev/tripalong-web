'use client'

export const dynamic = 'force-dynamic'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/NavBar'
import { SwipeStack } from '@/components/SwipeStack'
import { TripDetailModal } from '@/components/TripDetailModal'
import { CreateTripModal } from '@/components/CreateTripModal'
import { getTrips } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { TripWithDetails } from '@/lib/types'

export default function FeedPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUserId(session.user.id)
    })
  }, [router])

  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
  })

  return (
    <>
      <NavBar />

      <main className="bg-black flex flex-col md:pt-14" style={{ height: '100dvh' }}>
        {/* Mobile header — matches app exactly */}
        <div className="md:hidden flex items-center justify-between px-5 pt-14 pb-3 shrink-0">
          <h1 className="text-white font-extrabold text-2xl tracking-tight">TripAlong</h1>
          <div className="flex items-center gap-2">
            {/* Bookmark icon */}
            <button className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                  stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Create Trip pill */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3.5 py-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span className="text-white text-sm font-semibold">Create Trip</span>
            </button>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 shrink-0">
          <div>
            <h1 className="text-white font-bold text-xl">Explore Trips</h1>
            <p className="text-white/40 text-sm">Find your next adventure</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-accent text-black font-semibold px-4 py-2.5 rounded-2xl text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="black" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Create Trip
          </button>
        </div>

        {/* Card + action buttons — fills all remaining height, no bottom padding */}
        <div className="flex-1 min-h-0 flex items-stretch justify-center px-4 md:pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 w-full">
              <div className="w-12 h-12 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-white/30 text-sm">Loading trips...</p>
            </div>
          ) : trips && trips.length > 0 ? (
            <div className="w-full max-w-sm flex flex-col">
              <SwipeStack trips={trips} userId={userId} onTripTap={setSelectedTrip} />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <p className="text-white/30 text-sm">No trips found.</p>
            </div>
          )}
        </div>
      </main>

      {selectedTrip && (
        <TripDetailModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
      )}

      {showCreate && (
        <CreateTripModal onClose={() => setShowCreate(false)} userId={userId} />
      )}
    </>
  )
}
