'use client'

export const dynamic = 'force-dynamic'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/NavBar'
import { TripCard } from '@/components/TripCard'
import { TripDetailModal } from '@/components/TripDetailModal'
import { getTrips } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { TripWithDetails } from '@/lib/types'

export default function FeedPage() {
  const router = useRouter()
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/')
    })
  }, [router])

  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
  })

  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-black">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Explore Trips</h1>
            <p className="text-white/40 text-sm">Find your next adventure</p>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white/4 aspect-[3/4] animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm">Failed to load trips. Please refresh.</div>
          )}

          {trips && trips.length === 0 && (
            <div className="text-white/30 text-sm">No trips found.</div>
          )}

          {trips && trips.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {trips.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onClick={() => setSelectedTrip(trip)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </>
  )
}
