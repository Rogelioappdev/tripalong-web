'use client'

export const dynamic = 'force-dynamic'

// Hidden prototype route: TripAlong World on the MapLibre real-map globe, for
// side-by-side comparison with the current /world (react-globe.gl texture
// sphere). Not in the tab bar and not gated — just navigate here to eyeball it.
// If it wins, we swap it into /world.

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import dynamicImport from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import { AuthGate } from '@/components/AuthGate'
import { TripGlobePeek } from '@/components/TripGlobePeek'
import { getTripsForMap, getProfile } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails, UserProfile } from '@/lib/types'
import type { GlobeMapPoint } from '@/components/TripGlobeMap'

const TripGlobeMap = dynamicImport(() => import('@/components/TripGlobeMap'), { ssr: false })
const TripDetailModal = dynamicImport(
  () => import('@/components/TripDetailModal').then(m => ({ default: m.TripDetailModal })),
  { ssr: false },
)

// Tiny deterministic offset so multiple trips in the same city stay individually
// tappable instead of stacking on one point.
function jitter(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const at = (shift: number) => (((h >> shift) & 0xff) / 255 - 0.5) * 0.14 // ~±0.07°
  return { dLat: at(0), dLng: at(8) }
}

export default function WorldNextPage() {
  const [isGuest, setIsGuest] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [peekTrip, setPeekTrip] = useState<TripWithDetails | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)
  const [showAuthGate, setShowAuthGate] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setIsGuest(true); return }
      const p = await getProfile(session.user.id)
      if (p) setProfile(p)
    })
  }, [])

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['tripsForMap'],
    queryFn: getTripsForMap,
  })

  const points = useMemo<GlobeMapPoint[]>(
    () =>
      trips
        .filter(t => t.latitude != null && t.longitude != null)
        .map(t => {
          const j = jitter(t.id)
          return {
            lat: (t.latitude as number) + j.dLat,
            lng: (t.longitude as number) + j.dLng,
            trip: t,
          }
        }),
    [trips],
  )

  return (
    <>
      <div className="fixed inset-0 bg-black overflow-hidden">
        <TripGlobeMap points={points} onSelect={t => { haptic(10); setPeekTrip(t) }} />

        {/* Header overlay */}
        <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="px-5 pt-4">
            <h1 className="text-[#F0EBE3] text-2xl font-semibold tracking-tight">TripAlong World</h1>
            <p className="text-white/45 text-sm mt-0.5">
              {isLoading
                ? 'Loading trips…'
                : `${points.length} ${points.length === 1 ? 'trip' : 'trips'} · zoom in to explore`}
            </p>
          </div>
        </div>
      </div>

      {/* Tap a pin → small overview card first (browse feel). */}
      <AnimatePresence>
        {peekTrip && (
          <TripGlobePeek
            trip={peekTrip}
            onClose={() => setPeekTrip(null)}
            onLearnMore={() => { setSelectedTrip(peekTrip); setPeekTrip(null) }}
          />
        )}
      </AnimatePresence>

      {/* Full trip card opens only after "Learn more". */}
      <AnimatePresence>
        {selectedTrip && (
          <TripDetailModal
            key="world-next-trip-modal"
            trip={selectedTrip}
            onClose={() => setSelectedTrip(null)}
            isGuest={isGuest}
            initialProfile={profile}
            onAuthRequired={() => setShowAuthGate(true)}
            onProfileClaimed={setProfile}
          />
        )}
      </AnimatePresence>

      {showAuthGate && (
        <AuthGate onClose={() => setShowAuthGate(false)} required={false} />
      )}
    </>
  )
}
