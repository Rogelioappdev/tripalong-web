'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/haptics'
import { useQueryClient } from '@tanstack/react-query'
import { SwipeCard, type SwipeCardHandle } from './SwipeCard'
import { PaywallModal } from './PaywallModal'
import { FoundingMemberScreen } from './FoundingMemberScreen'
import { FoundingMemberPaywall } from './FoundingMemberPaywall'
import { joinTrip, saveTrip, getUserJoinedTripIds, getUserSavedTripIds, getProfile } from '@/lib/queries'
import { calculateTripMatch } from '@/lib/matching'
import { hasPlus, getTrialStatus } from '@/lib/trial'
import type { TripWithDetails, UserProfile } from '@/lib/types'

const DAILY_LIMIT = 15
const todayKey = (uid: string) => `ta_swipes_${uid}_${new Date().toISOString().slice(0, 10)}`

function useMidnightCountdown() {
  const getSecsUntilMidnight = () => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    return Math.floor((midnight.getTime() - now.getTime()) / 1000)
  }
  const [secs, setSecs] = useState(() => getSecsUntilMidnight())
  useEffect(() => {
    const id = setInterval(() => setSecs(getSecsUntilMidnight()), 1000)
    return () => clearInterval(id)
  }, [])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { h: pad(h), m: pad(m), s: pad(s) }
}
const getDailySwipes = (uid: string) => parseInt(localStorage.getItem(todayKey(uid)) ?? '0', 10)
const incrementDailySwipes = (uid: string) => {
  const key = todayKey(uid)
  const next = getDailySwipes(uid) + 1
  localStorage.setItem(key, String(next))
  return next
}

interface SwipeStackProps {
  trips: TripWithDetails[]
  userId: string | null
  isGuest?: boolean
  onAuthRequired?: (destination?: string) => void
  onTripTap: (trip: TripWithDetails) => void
  onSave?: (trip: TripWithDetails) => void
}

// ── DNA helpers ──────────────────────────────────────────────────────────────

function dnaProgress(profile: UserProfile | null): number {
  if (!profile) return 0
  const fields = [
    profile.gender,
    (profile.travel_styles?.length ?? 0) > 0,
    profile.travel_pace,
    profile.social_energy,
    profile.planning_style,
    profile.experience_level,
    profile.travel_with,
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ display: 'block' }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
      <circle
        cx="34" cy="34" r={r} fill="none"
        stroke="#F0EBE3" strokeWidth="3.5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="34" y="39" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{pct}%</text>
    </svg>
  )
}

// ── DNA nudge card ────────────────────────────────────────────────────────────

function DnaNudgeCard({ pct, onDismiss, onOpen }: { pct: number; onDismiss: () => void; onOpen: () => void }) {
  const x = useMotionValue(0)

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      style={{ x, position: 'absolute', inset: 0, zIndex: 30, cursor: 'grab', touchAction: 'pan-y' }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 72) { haptic(6); onDismiss() }
      }}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
    >
      {/* Card background */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 24, overflow: 'hidden',
        background: 'linear-gradient(160deg, #0D0D0D 0%, #141414 60%, #1a1006 100%)',
        border: '0.5px solid rgba(240,235,227,0.10)',
      }}>
        {/* Subtle texture */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 60% 30%, rgba(240,235,227,0.04) 0%, transparent 65%)',
        }} />

        {/* Content */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '28px 24px', gap: 20, textAlign: 'center',
        }}>
          <ProgressRing pct={pct} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ color: '#F0EBE3', fontWeight: 800, fontSize: 22, lineHeight: '26px', letterSpacing: '-0.4px' }}>
              Unlock better<br />trip matches
            </p>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, lineHeight: '18px' }}>
              Your Travel DNA helps us find trips<br />and crews that actually fit you.
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic(10); onOpen() }}
            style={{
              backgroundColor: '#F0EBE3', color: '#000',
              fontWeight: 700, fontSize: 14,
              padding: '13px 28px', borderRadius: 18,
              border: 'none', cursor: 'pointer',
            }}
          >
            Complete Travel DNA →
          </button>

          <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>
            Takes about 2 minutes · Swipe to skip
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Swipe hint overlay ────────────────────────────────────────────────────────

function SwipeHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 32,
        background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.72) 100%)',
        borderRadius: 24,
        pointerEvents: 'none',
      }}
    >
      {/* Left arrow */}
      <motion.div
        animate={{ x: [-6, 0, -6] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', left: 20, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: 'rgba(255,69,58,0.22)',
          border: '1px solid rgba(255,69,58,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>Pass</span>
      </motion.div>

      {/* Right arrow */}
      <motion.div
        animate={{ x: [6, 0, 6] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', right: 20, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: 'rgba(240,235,227,0.12)',
          border: '1px solid rgba(240,235,227,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#F0EBE3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>Save</span>
      </motion.div>

      {/* Bottom center */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          borderRadius: 20, padding: '6px 14px',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600 }}>
            Tap card to explore
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SwipeStack({ trips, userId, isGuest, onAuthRequired, onTripTap, onSave }: SwipeStackProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(sessionStorage.getItem('ta_feed_index') ?? '0', 10)
  })
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [dnaNudgeActive, setDnaNudgeActive] = useState(false)
  const { h, m, s } = useMidnightCountdown()
  const [swipeLimitReached, setSwipeLimitReached] = useState(false)
  const [limitChecked, setLimitChecked] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showFoundingScreen, setShowFoundingScreen] = useState(false)
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null)
  const topCardX = useMotionValue(0)
  const topCardRef = useRef<SwipeCardHandle>(null)
  const qc = useQueryClient()
  const hintWasSeenBeforeMount = useRef(false)
  const dnaNudgeTriggered = useRef(false)

  useEffect(() => {
    hintWasSeenBeforeMount.current = !!localStorage.getItem('ta_swipe_hint')
    // Hint removed — observing natural user behaviour
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!userId) return
    getUserJoinedTripIds(userId).then(ids => setJoinedIds(new Set(ids)))
    getUserSavedTripIds(userId).then(ids => setSavedIds(new Set(ids)))
    getProfile(userId).then(p => setUserProfile(p))
  }, [userId])

  // Check limit once userId + profile are known — user-specific key prevents cross-account bleed
  useEffect(() => {
    if (isGuest) { setLimitChecked(true); return }
    if (!userId || !userProfile) return
    if (hasPlus(userProfile)) {
      setSwipeLimitReached(false)
    } else {
      setSwipeLimitReached(getDailySwipes(userId) >= DAILY_LIMIT)
    }
    setLimitChecked(true)
  }, [userId, userProfile, isGuest])

  // Show DNA nudge at card 3 — only on return visits (hint already dismissed before)
  useEffect(() => {
    if (dnaNudgeTriggered.current) return
    if (currentIndex < 2) return
    if (!hintWasSeenBeforeMount.current) return // first-ever session — don't stack nudges
    if (isGuest) return
    if (localStorage.getItem('ta_dna_nudge')) return
    if (!userProfile) return
    if (dnaProgress(userProfile) === 100) return
    dnaNudgeTriggered.current = true
    setDnaNudgeActive(true)
  }, [currentIndex, userProfile, isGuest])

  const dismissHint = () => {
    setHintVisible(false)
    localStorage.setItem('ta_swipe_hint', '1')
  }

  const dismissDnaNudge = () => {
    setDnaNudgeActive(false)
    localStorage.setItem('ta_dna_nudge', '1')
  }

  const advance = () => {
    if (!isGuest && userId && !hasPlus(localProfile ?? userProfile)) {
      const count = incrementDailySwipes(userId)
      if (count >= DAILY_LIMIT) {
        setSwipeLimitReached(true)
        const profile = localProfile ?? userProfile
        const status = getTrialStatus(profile)
        if (status === 'none') {
          setShowFoundingScreen(true)
        } else {
          setShowPaywall(true)
        }
        return
      }
    }
    setCurrentIndex(i => {
      const next = i + 1
      sessionStorage.setItem('ta_feed_index', String(next))
      return next
    })
    topCardX.set(0)
    if (hintVisible) dismissHint()
  }

  const handleSwipeRight = async (trip: TripWithDetails) => {
    if (isGuest) {
      localStorage.setItem('ta_pending_save', trip.id)
      onAuthRequired?.(trip.destination)
      return
    }
    advance()
    if (userId && !savedIds.has(trip.id)) {
      setSavedIds(s => new Set([...s, trip.id]))
      onSave?.(trip)
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
    if (isGuest) {
      localStorage.setItem('ta_pending_save', currentTrip.id)
      onAuthRequired?.(currentTrip.destination)
      return
    }
    haptic(18)
    await topCardRef.current?.swipeRight()
  }

  const handleSave = async () => {
    if (!currentTrip) return
    if (isGuest) {
      localStorage.setItem('ta_pending_save', currentTrip.id)
      onAuthRequired?.(currentTrip.destination)
      return
    }
    haptic(8)
    await topCardRef.current?.swipeRight()
  }

  const visibleTrips = trips.slice(currentIndex, currentIndex + 2)
  const hasMore = currentIndex < trips.length
  const currentTrip = visibleTrips[0]

  if (!limitChecked && !isGuest) return null

  if (swipeLimitReached && hasMore) {
    return (
      <div className="flex flex-col items-center w-full h-full gap-0">
        <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-3xl" style={{ backgroundColor: '#111' }}>
          {currentTrip?.cover_image && (
            <img
              src={currentTrip.cover_image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(18px)', transform: 'scale(1.1)' }}
            />
          )}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.68)' }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(240,235,227,0.1)', border: '1px solid rgba(240,235,227,0.2)' }}>
              <span style={{ fontSize: 28 }}>✈️</span>
            </div>
            <div>
              <p className="text-white font-bold text-xl mb-1">
                {currentTrip ? `${currentTrip.destination} is waiting` : 'More trips are waiting'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                You've used your {DAILY_LIMIT} daily swipes
              </p>
            </div>
            <button
              type="button"
              onClick={() => { haptic(12); setShowPaywall(true) }}
              className="font-bold py-3.5 px-8 rounded-2xl text-sm"
              style={{ backgroundColor: '#F0EBE3', color: '#000' }}
            >
              Unlock unlimited →
            </button>
            <div className="flex flex-col items-center gap-1.5">
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Resets in</p>
              <div className="flex items-center gap-1">
                {[h, m, s].map((val, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="flex flex-col items-center px-2.5 py-1.5 rounded-xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', minWidth: 38 }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{val}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3, letterSpacing: '0.05em' }}>
                        {i === 0 ? 'HRS' : i === 1 ? 'MIN' : 'SEC'}
                      </span>
                    </div>
                    {i < 2 && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>:</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-7 py-3 shrink-0 opacity-25 pointer-events-none">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-white/35 text-[10px] font-semibold">Pass</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-white/35 text-[10px] font-semibold">Join</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                  stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-white/35 text-[10px] font-semibold">Save</span>
          </div>
        </div>
        {showFoundingScreen && userId && userProfile && (
          <FoundingMemberScreen
            userId={userId}
            profile={localProfile ?? userProfile}
            onClaimed={(updated) => {
              // Don't reset swipeLimitReached here — that would exit this
              // early-return block and unmount FoundingMemberScreen mid-flow.
              // Reset it in onDismiss after the onboarding completes instead.
              setLocalProfile(updated)
            }}
            onDismiss={() => {
              setShowFoundingScreen(false)
              setSwipeLimitReached(false)
            }}
          />
        )}

        <AnimatePresence>
          {showPaywall && (() => {
            const profile = localProfile ?? userProfile
            const trialStatus = getTrialStatus(profile)
            if (trialStatus === 'expired') {
              return (
                <FoundingMemberPaywall
                  key="expired-paywall"
                  allowDismiss
                  onClose={() => setShowPaywall(false)}
                />
              )
            }
            return (
              <PaywallModal
                key="paywall"
                trigger="swipes"
                context={currentTrip?.destination}
                trips={trips.slice(currentIndex + 1, currentIndex + 4)}
                onClose={() => setShowPaywall(false)}
              />
            )
          })()}
        </AnimatePresence>
      </div>
    )
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
          onClick={() => { haptic(8); sessionStorage.removeItem('ta_feed_index'); setCurrentIndex(0) }}
          className="mt-2 bg-white/10 border border-white/20 text-white font-semibold py-3 px-8 rounded-2xl text-sm"
        >
          Start over
        </motion.button>
      </div>
    )
  }

  const isCurrentJoined = currentTrip ? joinedIds.has(currentTrip.id) : false
  const matchPct = currentTrip ? calculateTripMatch(userProfile, currentTrip) : undefined
  const pct = dnaProgress(userProfile)

  return (
    <div className="flex flex-col items-center w-full h-full gap-0">
      {/* Card area */}
      <div
        className="relative w-full flex-1 min-h-0 overflow-hidden"
        style={{ backgroundColor: '#111' }}
        onPointerDown={() => { if (hintVisible) dismissHint() }}
      >
        {visibleTrips[1] && (
          <SwipeCard
            key={visibleTrips[1].id}
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

        {/* DNA nudge card — overlays the current trip card */}
        <AnimatePresence>
          {dnaNudgeActive && (
            <DnaNudgeCard
              pct={pct}
              onDismiss={dismissDnaNudge}
              onOpen={() => { dismissDnaNudge(); router.push('/travel-dna?from=nudge') }}
            />
          )}
        </AnimatePresence>

        {/* Swipe hint overlay */}
        <AnimatePresence>
          {hintVisible && !dnaNudgeActive && (
            <SwipeHint onDismiss={dismissHint} />
          )}
        </AnimatePresence>
      </div>

      {/* Pass / Join / Save buttons */}
      <div className="flex items-center justify-center gap-7 py-3 shrink-0">
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
