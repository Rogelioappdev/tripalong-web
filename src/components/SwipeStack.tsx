'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { useQueryClient } from '@tanstack/react-query'
import { SwipeCard, type SwipeCardHandle } from './SwipeCard'
import { joinTrip, saveTrip, getUserJoinedTripIds, getUserSavedTripIds, getProfile } from '@/lib/queries'
import { calculateTripMatch } from '@/lib/matching'
import type { TripWithDetails, UserProfile } from '@/lib/types'

interface SwipeStackProps {
  trips: TripWithDetails[]
  userId: string | null
  onTripTap: (trip: TripWithDetails) => void
}

export function SwipeStack({ trips, userId, onTripTap }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const topCardX = useMotionValue(0)
  const topCardRef = useRef<SwipeCardHandle>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId) return
    getUserJoinedTripIds(userId).then(ids => setJoinedIds(new Set(ids)))
    getUserSavedTripIds(userId).then(ids => setSavedIds(new Set(ids)))
    getProfile(userId).then(p => setUserProfile(p))
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
    if (userId && !savedIds.has(trip.id)) {
      setSavedIds(s => new Set([...s, trip.id]))
      try {
        await saveTrip(trip.id, userId)
        qc.invalidateQueries({ queryKey: ['saved-trips', userId] })
      } catch {}
    }
  }

  const handleSwipeLeft = () => advance()

  const handlePass = async () => {
    if (!currentTrip) return
    haptic([6, 20, 6])
    await topCardRef.current?.swipeLeft()
  }

  const handleJoin = async () => {
    if (!currentTrip) return
    haptic(18)
    await topCardRef.current?.swipeRight()
  }

  const handleSave = async () => {
    if (!currentTrip) return
    haptic(8)
    await topCardRef.current?.swipeRight()
  }

  if (!hasMore) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="text-5xl">✈️</span>
        </motion.div>
        <h3 className="text-white text-xl font-bold">You've seen them all!</h3>
        <p className="text-white/40 text-sm">Check back later for new trips</p>
        <motion.button
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={() => { haptic(8); setCurrentIndex(0) }}
          className="mt-2 bg-white/10 border border-white/20 text-white font-semibold py-3 px-8 rounded-2xl text-sm"
        >
          Start over
        </motion.button>
      </div>
    )
  }

  const isCurrentJoined = currentTrip ? joinedIds.has(currentTrip.id) : false
  const matchPct = currentTrip ? calculateTripMatch(userProfile, currentTrip) : undefined

  return (
    <div className="flex flex-col items-center w-full h-full gap-0">
      {/* Card */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden">
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
            ref={topCardRef}
            trip={currentTrip}
            isTop={true}
            sharedX={topCardX}
            isJoined={isCurrentJoined}
            matchPct={matchPct}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={() => handleSwipeRight(currentTrip)}
            onTap={() => onTripTap(currentTrip)}
          />
        )}
      </div>

      {/* Pass / Join / Save buttons */}
      <div className="flex items-center justify-center gap-7 py-3 shrink-0">
        {/* Pass */}
        <motion.button
          whileTap={{ scale: 0.80 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={handlePass}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-white/35 text-[10px] font-semibold">Pass</span>
        </motion.button>

        {/* Join */}
        <motion.button
          whileTap={{ scale: 0.80 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={handleJoin}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white/35 text-[10px] font-semibold">Join</span>
        </motion.button>

        {/* Save */}
        <motion.button
          whileTap={{ scale: 0.80 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={handleSave}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                stroke={currentTrip && savedIds.has(currentTrip.id) ? '#F0EBE3' : 'rgba(255,255,255,0.55)'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                fill={currentTrip && savedIds.has(currentTrip.id) ? 'rgba(240,235,227,0.15)' : 'none'}
              />
            </svg>
          </div>
          <span className="text-white/35 text-[10px] font-semibold">Save</span>
        </motion.button>
      </div>
    </div>
  )
}
