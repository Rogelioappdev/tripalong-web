'use client'

import { useState } from 'react'
import { useMotionValue } from 'framer-motion'
import { SwipeCard } from './SwipeCard'
import { joinTrip } from '@/lib/queries'
import type { TripWithDetails } from '@/lib/types'

interface SwipeStackProps {
  trips: TripWithDetails[]
  userId: string | null
  onTripTap: (trip: TripWithDetails) => void
}

export function SwipeStack({ trips, userId, onTripTap }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const topCardX = useMotionValue(0)

  const visibleTrips = trips.slice(currentIndex, currentIndex + 2)
  const hasMore = currentIndex < trips.length

  const advance = () => {
    setCurrentIndex(i => i + 1)
    topCardX.set(0)
  }

  const handleSwipeRight = async (trip: TripWithDetails) => {
    advance()
    if (userId && !joinedIds.has(trip.id)) {
      setJoinedIds(s => new Set([...s, trip.id]))
      try {
        await joinTrip(trip.id, userId)
      } catch (e) {
        // silent fail — user can join from trip detail
      }
    }
  }

  const handleSwipeLeft = () => {
    advance()
  }

  if (!hasMore) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <span className="text-5xl">✈️</span>
        <h3 className="text-white text-xl font-bold">You've seen them all!</h3>
        <p className="text-white/40 text-sm">Check back later for new trips</p>
        <button
          onClick={() => setCurrentIndex(0)}
          className="mt-2 bg-white/10 border border-white/20 text-white font-semibold py-3 px-8 rounded-2xl text-sm"
        >
          Start over
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Render behind card first (lower z-index) */}
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
      {/* Top card */}
      {visibleTrips[0] && (
        <SwipeCard
          key={visibleTrips[0].id}
          trip={visibleTrips[0]}
          isTop={true}
          sharedX={topCardX}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={() => handleSwipeRight(visibleTrips[0])}
          onTap={() => onTripTap(visibleTrips[0])}
        />
      )}
    </div>
  )
}
