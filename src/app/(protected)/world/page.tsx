'use client'

export const dynamic = 'force-dynamic'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import dynamicImport from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import { AuthGate } from '@/components/AuthGate'
import { WorldComingSoon } from '@/components/WorldComingSoon'
import { TripGlobePeek } from '@/components/TripGlobePeek'
import { TripClusterSheet } from '@/components/TripClusterSheet'
import { getTripsForMap, getProfile, getJoinStats } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'
import { hasPlus } from '@/lib/trial'
import { track } from '@/lib/analytics'
import { isNativeApp } from '@/lib/purchase'
// Trip filters are built and kept in the repo (src/lib/tripFilters.ts +
// src/components/filters/*) but intentionally NOT wired here for now — the globe
// shows every trip. Re-import FilterBar + applyTripFilters to switch them back on.
import type { TripWithDetails, UserProfile } from '@/lib/types'
import type { GlobePoint } from '@/components/TripGlobe'

// Feature gate: World shows a "being built" teaser to everyone; the hidden
// access code unlocks the real globe for that device (remembered here).
const WORLD_UNLOCK_KEY = 'ta_world_unlocked'

// TripAlong World join cap (client-side, World-only): the first few joins ever
// are free so new users can activate; after that, free users get 1 join/day and
// the next join opens the Plus paywall. Plus users are never capped.
const JOIN_FREE_GRACE = 3
const JOIN_DAILY_LIMIT = 1

// Both are client-only: the globe needs WebGL/window; the modal is heavy.
const TripGlobe = dynamicImport(() => import('@/components/TripGlobe'), { ssr: false })
const TripDetailModal = dynamicImport(
  () => import('@/components/TripDetailModal').then(m => ({ default: m.TripDetailModal })),
  { ssr: false },
)
// Same trip-creation flow as the feed, opened directly (no trip/hangout picker)
// so people can add a trip straight from the globe.
const CreateTripModal = dynamicImport(
  () => import('@/components/CreateTripModal').then(m => ({ default: m.CreateTripModal })),
  { ssr: false },
)

// Deterministic tiny offset so trips at identical coords don't sit on the exact
// same pixel. Kept small (~±0.06°) so same-city trips stay tightly grouped and
// the globe's clustering merges them into one bubble (→ list on tap).
function jitter(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const at = (shift: number) => (((h >> shift) & 0xff) / 255 - 0.5) * 0.12 // ~±0.06°
  return { dLat: at(0), dLng: at(8) }
}

export default function WorldPage() {
  const queryClient = useQueryClient()
  const [isGuest, setIsGuest] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [joinStats, setJoinStats] = useState<{ today: number; lifetime: number }>({ today: 0, lifetime: 0 })
  const [peekTrip, setPeekTrip] = useState<TripWithDetails | null>(null)
  const [clusterTrips, setClusterTrips] = useState<TripWithDetails[] | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [authGateRequired, setAuthGateRequired] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [gateReady, setGateReady] = useState(false)

  useEffect(() => {
    setUnlocked(localStorage.getItem(WORLD_UNLOCK_KEY) === '1')
    setGateReady(true)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setIsGuest(true); return }
      setUserId(session.user.id)
      const p = await getProfile(session.user.id)
      if (p) setProfile(p)
    })
  }, [])

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['tripsForMap'],
    queryFn: getTripsForMap,
    enabled: unlocked,
  })

  // Load the user's join counts once the globe is unlocked (for the join cap).
  useEffect(() => {
    if (!unlocked || isGuest) return
    getJoinStats().then(setJoinStats).catch(() => {})
  }, [unlocked, isGuest])

  // Gate passed to the trip modal: may this user join another trip from World?
  // Plus → always; else free grace, then 1/day. Records the exposure when it
  // blocks so we can measure the join→paywall→purchase funnel.
  const canJoinFromWorld = () => {
    if (hasPlus(profile)) return true
    if (joinStats.lifetime < JOIN_FREE_GRACE) return true
    if (joinStats.today < JOIN_DAILY_LIMIT) return true
    track('join_limit_reached', {
      limit: JOIN_DAILY_LIMIT,
      lifetime: joinStats.lifetime,
      rail: isNativeApp() ? 'native' : 'web',
    })
    return false
  }

  const points = useMemo<GlobePoint[]>(
    () =>
      trips
        .filter(t => t.latitude != null && t.longitude != null)
        .map(t => {
          const j = jitter(t.id)
          return {
            lat: (t.latitude as number) + j.dLat,
            lng: (t.longitude as number) + j.dLng,
            trip: t,
            color: '#F0EBE3',
          }
        }),
    [trips],
  )

  // Avoid a flash of the teaser before we've read the unlock flag.
  if (!gateReady) return <div className="fixed inset-0 bg-black" />

  if (!unlocked) {
    return (
      <WorldComingSoon
        onUnlock={() => {
          localStorage.setItem(WORLD_UNLOCK_KEY, '1')
          setUnlocked(true)
        }}
      />
    )
  }

  return (
    <>
      {/* Globe lives in its own fixed layer. The overlays below are kept OUTSIDE
          this container on purpose: `position: fixed` creates a stacking context,
          so anything nested here (even at z-[60]) paints *below* the app tab bar
          (z-50, mounted at the root layout). Lifting the trip modal out lets it
          cover the tab bar — otherwise "Open Group Chat"/"Join" hides behind it. */}
      <div className="fixed inset-0 bg-black overflow-hidden">
        <TripGlobe
          points={points}
          onSelect={t => { haptic(10); setPeekTrip(t) }}
          onClusterList={trips => { haptic(10); setClusterTrips(trips) }}
        />

        {/* Header overlay */}
        <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="px-5 pt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[#F0EBE3] text-2xl font-semibold tracking-tight">TripAlong World</h1>
              <p className="text-white/45 text-sm mt-0.5">
                {isLoading
                  ? 'Loading trips…'
                  : `${points.length} ${points.length === 1 ? 'trip' : 'trips'} · tap a point`}
              </p>
            </div>
            {/* Liquid-glass + — opens the same trip-creation flow as the feed. */}
            <button
              type="button"
              onClick={() => {
                haptic(10)
                if (isGuest) { setAuthGateRequired(true); setShowAuthGate(true) }
                else setShowCreate(true)
              }}
              aria-label="Create a trip"
              className="pointer-events-auto shrink-0 flex items-center justify-center rounded-full active:scale-90 transition-transform"
              style={{
                width: 40, height: 40,
                background: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.16)',
                backdropFilter: 'blur(24px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#F0EBE3" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!isLoading && points.length === 0 && (
          <div className="absolute inset-x-0 bottom-28 flex justify-center px-8 pointer-events-none">
            <p className="text-white/50 text-center text-sm">
              No trips on the map yet. Create a trip and it’ll appear here on the globe.
            </p>
          </div>
        )}
      </div>

      {/* Tap a cluster of same-spot trips → list to pick from. */}
      <AnimatePresence>
        {clusterTrips && (
          <TripClusterSheet
            trips={clusterTrips}
            onSelect={t => { setClusterTrips(null); setPeekTrip(t) }}
            onClose={() => setClusterTrips(null)}
          />
        )}
      </AnimatePresence>

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

      {/* Full trip card opens only after "Learn more". Wrapped in AnimatePresence
          so the sheet slides back down on dismiss instead of snapping away. */}
      <AnimatePresence>
        {selectedTrip && (
          <TripDetailModal
            key="world-trip-modal"
            trip={selectedTrip}
            onClose={() => setSelectedTrip(null)}
            isGuest={isGuest}
            initialProfile={profile}
            onAuthRequired={() => setShowAuthGate(true)}
            onProfileClaimed={setProfile}
            joinGate={canJoinFromWorld}
            onJoined={() => setJoinStats(s => ({ today: s.today + 1, lifetime: s.lifetime + 1 }))}
          />
        )}
      </AnimatePresence>

      {/* Create a trip straight from the globe — same modal the feed uses.
          On close we refresh the map query so a newly created (geocoded) trip
          pops onto the globe without a manual reload. */}
      {showCreate && (
        <CreateTripModal
          onClose={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['tripsForMap'] })
          }}
          userId={userId}
        />
      )}

      {showAuthGate && (
        <AuthGate
          onClose={() => { setShowAuthGate(false); setAuthGateRequired(false) }}
          required={authGateRequired}
        />
      )}
    </>
  )
}
