'use client'

import { useState, useEffect } from 'react'
import { useMotionValue } from 'framer-motion'
import { SwipeCard } from './SwipeCard'
import { joinTrip, saveTrip, getUserJoinedTripIds, getUserSavedTripIds } from '@/lib/queries'
import type { TripWithDetails } from '@/lib/types'

interface SwipeStackProps {
  trips: TripWithDetails[]
  userId: string | null
  onTripTap: (trip: TripWithDetails) => void
}

export function SwipeStack({ trips, userId, onTripTap }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const topCardX = useMotionValue(0)

  useEffect(() => {
    if (!userId) return
    getUserJoinedTripIds(userId).then(ids => setJoinedIds(new Set(ids)))
    getUserSavedTripIds(userId).then(ids => setSavedIds(new Set(ids)))
  }, [userId])

  const visibleTrips = trips.slice(currentIndex, currentIndex + 2)
  const hasMore = currentIndex < trips.length
  const currentTrip = visibleTrips[0]

  const advance = () => {
    setCurrentIndex(i => i + 1)
    topCardX.set(0)
  }

  const handleSwipeRight = async (trip: TripWithDetails) => {
    advance()
    if (userId && !joinedIds.has(trip.id)) {
      setJoinedIds(s => new Set([...s, trip.id]))
      try { await joinTrip(trip.id, userId) } catch {}
    }
  }

  const handleSwipeLeft = () => advance()

  const handlePass = async () => {
    if (!currentTrip) return
    await topCardX.set(-700)
    handleSwipeLeft()
  }

  const handleJoin = async () => {
    if (!currentTrip) return
    await handleSwipeRight(currentTrip)
  }

  const handleSave = async () => {
    if (!currentTrip || !userId) return
    if (!savedIds.has(currentTrip.id)) {
      setSavedIds(s => new Set([...s, currentTrip.id]))
      try { await saveTrip(currentTrip.id, userId) } catch {}
    }
    advance()
  }

  if (!hasMore) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <span className="text-5xl">✈️</span>
        <h3 className="text-white text-xl font-bold">You've seen them all!</h3>
        <p className="text-white/40 text-sm">Check back later for new trips</p>
        <button onClick={() => setCurrentIndex(0)}
          className="mt-2 bg-white/10 border border-white/20 text-white font-semibold py-3 px-8 rounded-2xl text-sm">
          Start over
        </button>
      </div>
    )
  }

  const isCurrentJoined = currentTrip ? joinedIds.has(currentTrip.id) : false

  return (
    <div className="flex flex-col items-center w-full h-full gap-0">
      {/* Card */}
      <div className="relative w-full flex-1 min-h-0">
        {visibleTrips[1] && (
          <SwipeCard
            key={visibleTrips[1].id + '-behind'}
            trip={visibleTrips[1]}
            isTop={false}
            sharedX={topCardX}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={() => handleSwipeRight(visibleTrips[1])}
            onTap={() => {}}
          />
        )}
        {currentTrip && (
          <SwipeCard
            key={currentTrip.id}
            trip={currentTrip}
            isTop={true}
            sharedX={topCardX}
            isJoined={isCurrentJoined}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={() => handleSwipeRight(currentTrip)}
            onTap={() => onTripTap(currentTrip)}
          />
        )}
      </div>

      {/* Pass / Save / Join buttons */}
      <div className="flex items-center justify-center gap-8 py-5 shrink-0">
        {/* Pass */}
        <button
          onClick={handlePass}
          className="flex flex-col items-center gap-1.5 group"
        >
          <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-white/40 text-xs font-semibold">Pass</span>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className="flex flex-col items-center gap-1.5 group"
        >
          <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                stroke={savedIds.has(currentTrip?.id ?? '') ? '#F0EBE3' : 'rgba(255,255,255,0.6)'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                fill={savedIds.has(currentTrip?.id ?? '') ? 'rgba(240,235,227,0.2)' : 'none'}
              />
            </svg>
          </div>
          <span className="text-white/40 text-xs font-semibold">Save</span>
        </button>

        {/* Join */}
        <button
          onClick={handleJoin}
          className="flex flex-col items-center gap-1.5 group"
        >
          <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white/40 text-xs font-semibold">Join</span>
        </button>
      </div>
    </div>
  )
}
