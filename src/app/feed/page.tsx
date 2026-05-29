'use client'

export const dynamic = 'force-dynamic'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useAnimation, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { NavBar } from '@/components/NavBar'
import { SwipeStack } from '@/components/SwipeStack'
import { TripDetailModal } from '@/components/TripDetailModal'
import { CreateTripModal } from '@/components/CreateTripModal'
import { getTrips, getUserSavedTripIds } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { SavedTripsModal } from '@/components/SavedTripsModal'
import type { TripWithDetails } from '@/lib/types'

// Tab bar: 58px height + 16px bottom = 74px. Add 8px breathing room = 82px
const TAB_BAR_CLEARANCE = 82

export default function FeedPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [savedToast, setSavedToast] = useState<TripWithDetails | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bookmarkControls = useAnimation()

  // Load initial saved count once userId is known
  useEffect(() => {
    if (!userId) return
    getUserSavedTripIds(userId).then(ids => setSavedCount(ids.length))
  }, [userId])

  const handleTripSaved = (trip: TripWithDetails) => {
    setSavedToast(trip)
    setSavedCount(c => c + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setSavedToast(null), 3000)
    bookmarkControls.start({
      scale: [1, 1.55, 1],
      transition: { duration: 0.38, times: [0, 0.45, 1], ease: 'easeOut' },
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUserId(session.user.id)
    })
  }, [router])

  // Lock page scroll — feed is a fixed app screen, not a scrollable document
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
    }
  }, [])

  const { data: trips, isLoading, isError, refetch } = useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
  })

  return (
    <>
      <NavBar />

      <main
        className="bg-black flex flex-col md:pt-14"
        style={{ height: '100dvh', overflow: 'hidden' }}
      >
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-5 shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 10 }}>
          <h1 className="text-white font-extrabold text-2xl tracking-tight">TripAlong</h1>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              onClick={() => { haptic(8); setShowSaved(true) }}
              className="relative w-8 h-8 rounded-full bg-white/8 border border-white/10 flex items-center justify-center">
              <motion.div animate={bookmarkControls}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>
              <AnimatePresence>
                {savedCount > 0 && (
                  <motion.div
                    key={savedCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 font-bold text-black"
                    style={{ backgroundColor: '#F0EBE3', fontSize: 9 }}
                  >
                    {savedCount > 99 ? '99+' : savedCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              onClick={() => { haptic(8); setShowCreate(true) }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span className="text-white text-xs font-semibold">Create Trip</span>
            </motion.button>
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

        {/* Card + buttons — fills remaining space above tab bar */}
        <div
          className="flex-1 min-h-0 flex items-stretch justify-center px-3 md:pb-8"
          style={{ paddingBottom: TAB_BAR_CLEARANCE }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 w-full">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-white/30 text-sm">Loading trips...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 w-full">
              <p className="text-white/30 text-sm text-center">Couldn't load trips</p>
              <button
                onClick={() => refetch()}
                className="px-5 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
              >
                Try again
              </button>
            </div>
          ) : trips && trips.length > 0 ? (
            <div className="w-full max-w-sm flex flex-col">
              <SwipeStack trips={trips} userId={userId} onTripTap={setSelectedTrip} onSave={handleTripSaved} />
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

      {showSaved && userId && (
        <SavedTripsModal
          userId={userId}
          onClose={() => setShowSaved(false)}
        />
      )}

      {/* Save confirmation toast */}
      <AnimatePresence>
        {savedToast && (
          <motion.button
            key={savedToast.id}
            initial={{ y: 20, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => { haptic(8); setSavedToast(null); setShowSaved(true) }}
            className="fixed left-4 right-4 z-50 flex items-center gap-3 px-3 py-2.5 rounded-2xl"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 90px)',
              backgroundColor: 'rgba(18,18,18,0.97)',
              border: '0.5px solid rgba(255,255,255,0.13)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              maxWidth: 400,
              margin: '0 auto',
            } as React.CSSProperties}
          >
            {savedToast.cover_image ? (
              <img src={savedToast.cover_image} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-xl">🌍</div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white font-semibold text-sm truncate">{savedToast.destination} saved ✓</p>
              <p className="text-white/38 text-xs mt-0.5">Saved to 🔖 — tap to view</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
