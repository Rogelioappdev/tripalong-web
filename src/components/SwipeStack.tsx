'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/haptics'
import { useQueryClient } from '@tanstack/react-query'
import { SwipeCard, type SwipeCardHandle } from './SwipeCard'
import { HangCard, type HangCardHandle } from './HangCard'
import { AdCard } from './AdCard'
import { PublicProfileModal } from './PublicProfileModal'
import { PaywallModal } from './PaywallModal'
import { FoundingMemberScreen } from './FoundingMemberScreen'
import { FoundingMemberPaywall } from './FoundingMemberPaywall'
import { joinTrip, saveTrip, getTripChat, getUserJoinedTripIds, getUserSavedTripIds, getProfile, updateProfile, joinHangalong, markTripSeen, markHangalongSeen, getSwipesToday, incrementSwipesToday } from '@/lib/queries'
import { JoinCelebration } from './JoinCelebration'
import { calculateTripMatch, getMatchingVibes } from '@/lib/matching'
import { track } from '@/lib/analytics'
import { hasPlus, getTrialStatus } from '@/lib/trial'
import { computeSwipeVariant, getDailySwipeLimit } from '@/lib/swipeVariant'
import type { TripWithDetails, UserProfile, HangalongWithDetails } from '@/lib/types'

// Daily swipe counts now live server-side (see getSwipesToday /
// incrementSwipesToday), keyed to the UTC date and enforced in Postgres — so
// the count can't be reset by changing the device timezone or clearing
// localStorage. The countdown below is aligned to the same UTC rollover.
const isNativeApp = () =>
  typeof window !== 'undefined' && navigator.userAgent.includes('TripAlong/1.0')

function useMidnightCountdown() {
  const getSecsUntilMidnight = () => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setUTCHours(24, 0, 0, 0) // reset at UTC midnight — matches the server-side counter
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

interface SwipeStackProps {
  trips: TripWithDetails[]
  hangalongs?: HangalongWithDetails[]
  myHangalongIds?: string[]
  joinedHangIds?: string[]
  onHangTap?: (hang: HangalongWithDetails) => void
  onHangJoined?: (hangId: string) => void
  userId: string | null
  isGuest?: boolean
  initialProfile?: UserProfile | null
  onAuthRequired?: (destination?: string) => void
  onTripTap: (trip: TripWithDetails) => void
  onSave?: (trip: TripWithDetails) => void
  onProfileClaimed?: (profile: UserProfile) => void
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

// ── Profile complete nudge — bottom sheet after 3rd swipe ────────────────────

function ProfileCompleteNudge({
  hasPhoto,
  dnaPct,
  onPhotoTap,
  onDnaTap,
  onDismiss,
}: {
  hasPhoto: boolean
  dnaPct: number
  onPhotoTap: () => void
  onDnaTap: () => void
  onDismiss: () => void
}) {
  const allDone = hasPhoto && dnaPct === 100
  if (allDone) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      } as React.CSSProperties}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          backgroundColor: '#0D0D0D',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '28px 28px 0 0',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)',
          paddingTop: 12,
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div>
            <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.4px', marginBottom: 6 }}>
              Make your profile work for you
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: 1.5 }}>
              Travelers with complete profiles get seen more. Takes 2 minutes.
            </p>
          </div>

          {/* Profile photo row */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => { haptic(8); onPhotoTap() }}
            disabled={hasPhoto}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 18,
              backgroundColor: hasPhoto ? 'rgba(48,209,88,0.07)' : 'rgba(255,255,255,0.05)',
              border: hasPhoto ? '0.5px solid rgba(48,209,88,0.25)' : '0.5px solid rgba(255,255,255,0.1)',
              textAlign: 'left', cursor: hasPhoto ? 'default' : 'pointer',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              backgroundColor: hasPhoto ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {hasPhoto ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: hasPhoto ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 700, fontSize: 15 }}>
                Profile photo
              </p>
              <p style={{ color: hasPhoto ? 'rgba(48,209,88,0.7)' : 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                {hasPhoto ? 'Done ✓' : "Travelers want to see who's going"}
              </p>
            </div>
            {!hasPhoto && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </motion.button>

          {/* Travel DNA row */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => { haptic(8); onDnaTap() }}
            disabled={dnaPct === 100}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 18,
              backgroundColor: dnaPct === 100 ? 'rgba(48,209,88,0.07)' : 'rgba(255,255,255,0.05)',
              border: dnaPct === 100 ? '0.5px solid rgba(48,209,88,0.25)' : '0.5px solid rgba(255,255,255,0.1)',
              textAlign: 'left', cursor: dnaPct === 100 ? 'default' : 'pointer',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              backgroundColor: dnaPct === 100 ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {dnaPct === 100 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"/>
                  <path d="M8 12h4m0 0V8m0 4l3 3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: dnaPct === 100 ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 700, fontSize: 15 }}>
                Travel DNA
              </p>
              <p style={{ color: dnaPct === 100 ? 'rgba(48,209,88,0.7)' : 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                {dnaPct === 100 ? 'Done ✓' : `${dnaPct}% complete · tells us your travel style`}
              </p>
            </div>
            {dnaPct !== 100 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* Mini progress bar */}
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${dnaPct}%`, height: '100%', backgroundColor: '#F0EBE3', borderRadius: 2 }} />
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </motion.button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => { haptic(4); onDismiss() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.22)', fontSize: 13, fontWeight: 500,
              padding: '4px 0', textAlign: 'center',
            }}
          >
            Maybe later
          </button>
        </div>
      </motion.div>
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

export function SwipeStack({ trips, hangalongs = [], myHangalongIds = [], joinedHangIds = [], onHangTap, onHangJoined, userId, isGuest, initialProfile, onAuthRequired, onTripTap, onSave, onProfileClaimed }: SwipeStackProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(sessionStorage.getItem('ta_feed_index') ?? '0', 10)
  })
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null)
  const [hintVisible, setHintVisible] = useState(false)
  const [dnaNudgeActive, setDnaNudgeActive] = useState(false)
  const { h, m, s } = useMidnightCountdown()
  const [swipeLimitReached, setSwipeLimitReached] = useState(false)
  const [limitChecked, setLimitChecked] = useState(false)
  // Authoritative daily swipe count from the server; optimistically bumped on
  // each swipe for instant UX, then reconciled with the server's return value.
  const swipesTodayRef = useRef(0)
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallContext, setPaywallContext] = useState<{ matchPct: number; destination?: string } | undefined>()
  const [showFoundingScreen, setShowFoundingScreen] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null)
  const [celebrationTrip, setCelebrationTrip] = useState<TripWithDetails | null>(null)
  const [showProfileNudge, setShowProfileNudge] = useState(false)
  const profileNudgeTriggered = useRef(false)
  const topCardX = useMotionValue(0)
  const topCardRef = useRef<SwipeCardHandle | HangCardHandle>(null)
  const cardAreaRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  // The Save button reuses the card's swipe-right animation for its exit —
  // this flag tells handleSwipeRight the resulting call is a bookmark, not a
  // real user swipe, so it saves instead of joining. Cleared as soon as it's read.
  const saveIntentRef = useRef(false)
  const hintWasSeenBeforeMount = useRef(false)
  const dnaNudgeTriggered = useRef(false)

  useEffect(() => {
    hintWasSeenBeforeMount.current = !!localStorage.getItem('ta_swipe_hint')
    // Hint removed — observing natural user behaviour
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Fire after browser paints so trips are actually visible before splash fades
    requestAnimationFrame(() => {
      ;(window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'app_ready' }))
    })
  }, [])



  useEffect(() => {
    if (!userId) return
    getUserJoinedTripIds(userId).then(ids => setJoinedIds(new Set(ids)))
    getUserSavedTripIds(userId).then(ids => setSavedIds(new Set(ids)))
    getProfile(userId).then(p => setUserProfile(p))
  }, [userId])

  // Sync when parent updates feedProfile (e.g. Plus claimed from TripDetailModal)
  useEffect(() => {
    if (initialProfile) setUserProfile(initialProfile)
  }, [initialProfile])

  // Launch A/B test: 50/50 split on capped-15/day vs unlimited swipes.
  // Prefer the persisted variant so it never flips once assigned; fall back
  // to a deterministic hash of the user ID before the profile round-trip
  // resolves, so the very first swipe of the session already has an answer.
  const swipeVariant = userProfile?.swipe_variant === 'capped' || userProfile?.swipe_variant === 'unlimited'
    ? userProfile.swipe_variant
    : userId ? computeSwipeVariant(userId) : 'capped'
  const dailyLimit = getDailySwipeLimit(swipeVariant)

  // Persist the assignment the first time we see this user, so conversion
  // and retention can be segmented by variant directly in Supabase.
  useEffect(() => {
    if (!userId || !userProfile || userProfile.swipe_variant) return
    updateProfile(userId, { swipe_variant: swipeVariant }).catch(() => {})
  }, [userId, userProfile, swipeVariant])

  // Check limit once userId + profile are known. The count is fetched from the
  // server (UTC-keyed, tamper-proof) rather than localStorage.
  useEffect(() => {
    if (isGuest) { setLimitChecked(true); return }
    if (!userId || !userProfile) return
    if (hasPlus(userProfile) || dailyLimit === Infinity) {
      setSwipeLimitReached(false)
      setLimitChecked(true)
      return
    }
    let cancelled = false
    getSwipesToday()
      .then(count => {
        if (cancelled) return
        swipesTodayRef.current = count
        setSwipeLimitReached(count >= dailyLimit)
      })
      .catch(() => {}) // network failure shouldn't wall the user; server still enforces on increment
      .finally(() => { if (!cancelled) setLimitChecked(true) })
    return () => { cancelled = true }
  }, [userId, userProfile, isGuest, dailyLimit])

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

  // Show profile nudge after 3rd swipe — fires on first session, once ever
  useEffect(() => {
    if (profileNudgeTriggered.current) return
    if (currentIndex < 2) return
    if (isGuest) return
    if (!userProfile) return
    if (localStorage.getItem('ta_profile_nudge')) return
    const hasPhoto = !!userProfile.profile_photo
    if (hasPhoto && dnaProgress(userProfile) === 100) return
    profileNudgeTriggered.current = true
    setShowProfileNudge(true)
  }, [currentIndex, userProfile, isGuest])

  const dismissProfileNudge = () => {
    setShowProfileNudge(false)
    localStorage.setItem('ta_profile_nudge', '1')
  }

  const dismissHint = () => {
    setHintVisible(false)
    localStorage.setItem('ta_swipe_hint', '1')
  }

  const dismissDnaNudge = () => {
    setDnaNudgeActive(false)
    localStorage.setItem('ta_dna_nudge', '1')
  }

  const advance = (skipDailyCount = false) => {
    // Persist seen state so this card never reappears for this user
    if (!isGuest && userId) {
      const item = currentItemRef.current
      if (item?.type === 'trip') markTripSeen(item.trip.id).catch(() => {})
      else if (item?.type === 'hangout') markHangalongSeen(item.hang.id).catch(() => {})
    }

    if (!skipDailyCount && !isGuest && userId && !hasPlus(localProfile ?? userProfile) && dailyLimit !== Infinity) {
      // Optimistic local bump for instant UX...
      const optimistic = swipesTodayRef.current + 1
      swipesTodayRef.current = optimistic
      // ...but the server is the source of truth and can't be bypassed. Reconcile
      // with its authoritative count (e.g. if the user already swiped elsewhere).
      incrementSwipesToday()
        .then(serverCount => {
          swipesTodayRef.current = serverCount
          if (serverCount >= dailyLimit) setSwipeLimitReached(true)
        })
        .catch(() => {})
      if (optimistic >= dailyLimit) {
        setSwipeLimitReached(true)
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

  // Stable ref so native can call advance() without capturing a stale closure
  const advanceRef = useRef<(skip?: boolean) => void>(() => {})
  advanceRef.current = advance
  useEffect(() => {
    ;(window as any).__tripalongAdvanceFeed = () => advanceRef.current(true)
    return () => { delete (window as any).__tripalongAdvanceFeed }
  }, [])

  // Ads disabled — feed is content-only, no ad slots interleaved.
  type FeedItem = { type: 'trip'; trip: TripWithDetails } | { type: 'hangout'; hang: HangalongWithDetails } | { type: 'ad'; id: string }
  const feedItems = useMemo<FeedItem[]>(() => {
    type ContentItem = { type: 'trip'; trip: TripWithDetails; ts: string } | { type: 'hangout'; hang: HangalongWithDetails; ts: string }
    const combined: ContentItem[] = [
      ...trips.map(t => ({ type: 'trip' as const, trip: t, ts: t.created_at })),
      ...hangalongs.map(h => ({ type: 'hangout' as const, hang: h, ts: h.created_at })),
    ].sort((a, b) => b.ts.localeCompare(a.ts))

    return combined.map(item =>
      item.type === 'trip' ? { type: 'trip' as const, trip: item.trip } : { type: 'hangout' as const, hang: item.hang }
    )
  }, [trips, hangalongs])

  const visibleItems = feedItems.slice(currentIndex, currentIndex + 2)
  const currentItem = visibleItems[0]

  // Ref always points to the current top item — used in advance() to mark seen
  const currentItemRef = useRef<typeof currentItem>(currentItem)
  currentItemRef.current = currentItem
  const nextItem = visibleItems[1]
  const isCurrentAd = currentItem?.type === 'ad'
  const currentTrip = currentItem?.type === 'trip' ? currentItem.trip : null
  const currentHang = currentItem?.type === 'hangout' ? currentItem.hang : null
  const nextTrip = nextItem?.type === 'trip' ? nextItem.trip : null
  const nextHang = nextItem?.type === 'hangout' ? nextItem.hang : null
  const hasMore = currentIndex < feedItems.length

  // When an ad slot becomes the top card, tell native to show AdMob content inside the frame.
  // Using isCurrentAd as the dep so the effect always sees the freshly computed value —
  // avoids the stale-feedItems closure that [currentIndex] alone would cause.
  useEffect(() => {
    if (!isCurrentAd || !isNativeApp()) return
    // Defer one paint so cardAreaRef is laid out before we measure it.
    // Covers the mount-with-currentIndex===adSlot case (restored from sessionStorage),
    // where the ref isn't measured yet on the first synchronous effect run.
    const t = setTimeout(() => {
      const r = cardAreaRef.current?.getBoundingClientRect()
      console.log('show_ad_content fired, isCurrentAd=', isCurrentAd, 'rect=', JSON.stringify(r))
      ;(window as any).ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'show_ad_content',
        cardRect: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
      }))
    }, 50)
    return () => clearTimeout(t)
  }, [isCurrentAd])

  // Swipe-right on a trip is the single commit action: it joins the trip AND
  // its group chat, which then appears in Messages immediately (joinTrip adds
  // both the trip_members row and the trip_chat_members row in one call).
  // There is no separate post-swipe "join" step anymore. The Save button
  // below reuses this same card-exit animation for its own bookmark action —
  // saveIntentRef tells the two apart.
  const handleSwipeRight = async (trip: TripWithDetails) => {
    const isSaveIntent = saveIntentRef.current
    saveIntentRef.current = false
    if (isGuest) {
      localStorage.setItem('ta_pending_save', trip.id)
      onAuthRequired?.(trip.destination)
      return
    }
    advance()
    if (!userId) return

    if (isSaveIntent) {
      if (!savedIds.has(trip.id)) {
        setSavedIds(s => new Set([...s, trip.id]))
        onSave?.(trip)
        track('trip_saved', { trip_id: trip.id })
        try {
          await saveTrip(trip.id, userId)
          qc.invalidateQueries({ queryKey: ['saved-trips', userId] })
        } catch {}
      }
      return
    }

    if (joinedIds.has(trip.id)) return
    setJoinedIds(s => new Set([...s, trip.id]))
    track('trip_joined', { trip_id: trip.id, source: 'swipe' })
    try {
      await joinTrip(trip.id, userId)
      haptic([15, 30, 15, 30, 60])
      qc.invalidateQueries({ queryKey: ['tripChats'] })
      qc.invalidateQueries({ queryKey: ['unreadCount'] })
      qc.invalidateQueries({ queryKey: ['trips'] })
      setCelebrationTrip(trip)
    } catch {
      setJoinedIds(s => { const n = new Set(s); n.delete(trip.id); return n })
    }
  }

  const handleHangSwipeRight = async (hang: HangalongWithDetails) => {
    if (isGuest) { onAuthRequired?.(); return }
    advance()
    if (userId) {
      try {
        await joinHangalong(hang.id, userId)
        onHangJoined?.(hang.id)
        qc.invalidateQueries({ queryKey: ['hangalongs'] })
        qc.invalidateQueries({ queryKey: ['my-hangalongs'] })
      } catch {}
    }
  }

  const handleSwipeLeft = (isAd = false) => { advance(isAd) }

  const handlePass = async () => {
    if (!currentTrip && !currentHang && !isCurrentAd) return
    haptic([6, 20, 6])
    await topCardRef.current?.swipeLeft()
  }

  const handleJoin = async () => {
    if (isCurrentAd) { await topCardRef.current?.swipeRight(); return }
    if (currentHang) {
      if (isGuest) { onAuthRequired?.(); return }
      haptic(8)
      onHangTap?.(currentHang)
      return
    }
    if (!currentTrip) return
    if (isGuest) {
      localStorage.setItem('ta_pending_save', currentTrip.id)
      onAuthRequired?.(currentTrip.destination)
      return
    }
    haptic(8)
    onTripTap(currentTrip)
  }

  const handleSave = async () => {
    if (isCurrentAd) { await topCardRef.current?.swipeRight(); return }
    if (currentHang) { haptic(8); onHangTap?.(currentHang); return }
    if (!currentTrip) return
    if (isGuest) {
      localStorage.setItem('ta_pending_save', currentTrip.id)
      onAuthRequired?.(currentTrip.destination)
      return
    }
    haptic(8)
    // Actually save the trip — route through the same right-swipe path so it
    // runs saveTrip + shows the "Trip saved" toast + advances, instead of just
    // opening the detail modal (which is what the Join button is for).
    // saveIntentRef marks this as a bookmark, not a real swipe, so
    // handleSwipeRight saves instead of joining.
    saveIntentRef.current = true
    await topCardRef.current?.swipeRight()
  }


  if (!limitChecked && !isGuest) return null

  if (swipeLimitReached && hasMore) {
    const effectiveProfile = localProfile ?? userProfile
    const trialStatus = getTrialStatus(effectiveProfile)
    const isFirstTime = trialStatus === 'none'
    const isExpired = trialStatus === 'expired'

    return (
      <div className="flex flex-col items-center w-full h-full gap-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="relative w-full flex-1 min-h-0 overflow-hidden rounded-3xl"
          style={{ backgroundColor: '#111' }}
        >
          {/* Blurred next trip — shows what's locked */}
          {currentTrip?.cover_image && (
            <img
              src={currentTrip.cover_image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }}
            />
          )}
          {/* Gradient — heavier at bottom so CTA is always legible */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.44) 0%, rgba(0,0,0,0.70) 38%, rgba(0,0,0,0.93) 100%)'
          }} />

          <div className="absolute inset-0 flex flex-col px-7 text-center" style={{ paddingTop: 32, paddingBottom: 24 }}>

            {/* Top: lock + destination hook */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.36, ease: 'easeOut' }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{
                background: 'rgba(240,235,227,0.08)',
                border: '1px solid rgba(240,235,227,0.14)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(240,235,227,0.7)" strokeWidth="1.8"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(240,235,227,0.7)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-extrabold" style={{ fontSize: 22, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                  {isExpired ? 'Your Plus trial ended' : (currentTrip ? `${currentTrip.destination} is waiting` : 'More trips are waiting')}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 5 }}>
                  {isExpired ? `You're back to ${dailyLimit} daily swipes` : `You've reached your ${dailyLimit} daily swipes`}
                </p>
              </div>
            </motion.div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Countdown — the dominant anchor */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.42, ease: 'easeOut' }}
              className="flex flex-col items-center gap-2"
            >
              <p style={{ color: 'rgba(255,255,255,0.26)', fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
                Resets in
              </p>
              <div className="flex items-start justify-center">
                {[{ val: h, label: 'HRS' }, { val: m, label: 'MIN' }, { val: s, label: 'SEC' }].map(({ val, label }, i) => (
                  <div key={label} className="flex items-start">
                    <div className="flex flex-col items-center" style={{ minWidth: 58 }}>
                      <span style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 58, fontWeight: 800,
                        color: '#ffffff', lineHeight: 1, letterSpacing: '-3px',
                      }}>
                        {val}
                      </span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.24)', letterSpacing: '0.1em', fontWeight: 700, marginTop: 5 }}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && (
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 46, fontWeight: 700, lineHeight: 1, paddingTop: 3, paddingInline: 1 }}>
                        :
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* "or unlock now" divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32, duration: 0.36 }}
              className="flex items-center gap-3"
              style={{ marginBottom: 14 }}
            >
              <div style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }}>
                {isExpired ? 'or continue now' : 'or unlock now'}
              </span>
              <div style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.36, ease: 'easeOut' }}
              className="flex flex-col gap-1.5"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => {
                  haptic(14)
                  if (isFirstTime) setShowFoundingScreen(true)
                  else setShowPaywall(true)
                }}
                className="w-full font-bold py-4 rounded-2xl text-base"
                style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
              >
                {isFirstTime ? 'Get 7 days free →' : isExpired ? 'Continue with Plus →' : 'Unlock unlimited →'}
              </motion.button>
              {isFirstTime && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center' }}>
                  No card required
                </p>
              )}
            </motion.div>

          </div>
        </motion.div>
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
              setLocalProfile(updated)
              setUserProfile(updated)
              onProfileClaimed?.(updated)
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
                  context={paywallContext}
                  onClose={() => { setShowPaywall(false); setPaywallContext(undefined) }}
                />
              )
            }
            return (
              <PaywallModal
                key="paywall"
                trigger={paywallContext ? 'compatibility' : 'swipes'}
                context={currentTrip?.destination}
                matchPct={paywallContext?.matchPct}
                trips={trips.slice(currentIndex + 1, currentIndex + 4)}
                userId={userId ?? undefined}
                onClose={() => { setShowPaywall(false); setPaywallContext(undefined) }}
                onSuccess={() => {
                  if (!profile) return
                  const updated: UserProfile = { ...profile, subscription_tier: 'plus' }
                  setLocalProfile(updated)
                  setUserProfile(updated)
                  onProfileClaimed?.(updated)
                }}
                onWelcomeDone={(confirmed) => {
                  if (!confirmed) return
                  setLocalProfile(confirmed)
                  setUserProfile(confirmed)
                  onProfileClaimed?.(confirmed)
                }}
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

  const isCurrentJoined = currentTrip
    ? joinedIds.has(currentTrip.id)
    : currentHang
      ? joinedHangIds.includes(currentHang.id)
      : false
  const effectiveProfileForMatch = localProfile ?? userProfile
  const isPlus = hasPlus(effectiveProfileForMatch)
  const matchPct = currentTrip ? calculateTripMatch(effectiveProfileForMatch, currentTrip) : undefined
  const matchingVibes = currentTrip ? getMatchingVibes(effectiveProfileForMatch, currentTrip) : []
  const nextMatchPct = nextTrip ? calculateTripMatch(effectiveProfileForMatch, nextTrip) : undefined
  const nextMatchingVibes = nextTrip ? getMatchingVibes(effectiveProfileForMatch, nextTrip) : []
  const pct = dnaProgress(userProfile)

  return (
    <div className="flex flex-col items-center w-full h-full gap-0">
      {/* Profile complete nudge — bottom sheet after 3rd swipe */}
      <AnimatePresence>
        {showProfileNudge && userProfile && (
          <ProfileCompleteNudge
            hasPhoto={!!userProfile.profile_photo}
            dnaPct={dnaProgress(userProfile)}
            onPhotoTap={() => { dismissProfileNudge(); router.push('/profile?edit=1') }}
            onDnaTap={() => { dismissProfileNudge(); router.push('/travel-dna?from=nudge') }}
            onDismiss={dismissProfileNudge}
          />
        )}
      </AnimatePresence>

      {/* Join celebration — full screen, shown after swiping right joins the trip */}
      <AnimatePresence>
        {celebrationTrip && (
          <JoinCelebration
            trip={celebrationTrip}
            onOpenChat={async () => {
              // joinTrip (fired on swipe) already added chat membership —
              // opening the chat here is a pure read, never a mutation.
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

      {/* Card area */}
      <div
        ref={cardAreaRef}
        className="relative w-full flex-1 min-h-0 overflow-hidden"
        style={{ backgroundColor: '#111' }}
        onPointerDown={() => { if (hintVisible) dismissHint() }}
      >
        {nextItem && (
          nextItem.type === 'ad' ? (
            <AdCard
              key={nextItem.id}
              isTop={false}
              sharedX={topCardX}
              onSwipeLeft={() => handleSwipeLeft(true)}
              onSwipeRight={() => advance(true)}
            />
          ) : nextItem.type === 'hangout' ? (
            <HangCard
              key={nextItem.hang.id}
              hang={nextItem.hang}
              isTop={false}
              sharedX={topCardX}
              isJoined={joinedHangIds.includes(nextItem.hang.id)}
              onSwipeLeft={() => handleSwipeLeft()}
              onSwipeRight={() => handleHangSwipeRight(nextItem.hang)}
              onTap={() => {}}
              onCreatorTap={setProfileUserId}
            />
          ) : (
            <SwipeCard
              key={nextItem.trip.id}
              trip={nextItem.trip}
              isTop={false}
              sharedX={topCardX}
              matchPct={nextMatchPct}
              matchingVibes={nextMatchingVibes}
              isPlus={isPlus}
              onSwipeLeft={() => handleSwipeLeft()}
              onSwipeRight={() => handleSwipeRight(nextItem.trip)}
              onTap={() => {}}
              onCreatorTap={setProfileUserId}
            />
          )
        )}
        {currentItem && (
          currentItem.type === 'ad' ? (
            <AdCard
              key={currentItem.id}
              ref={topCardRef as any}
              isTop={true}
              sharedX={topCardX}
              onSwipeLeft={() => handleSwipeLeft(true)}
              onSwipeRight={() => advance(true)}
            />
          ) : currentItem.type === 'hangout' ? (
            <HangCard
              key={currentItem.hang.id}
              ref={topCardRef as any}
              hang={currentItem.hang}
              isTop={true}
              sharedX={topCardX}
              isMine={myHangalongIds.includes(currentItem.hang.id)}
              isJoined={isCurrentJoined}
              onSwipeLeft={() => handleSwipeLeft()}
              onSwipeRight={() => handleHangSwipeRight(currentItem.hang)}
              onTap={() => onHangTap?.(currentItem.hang)}
              onCreatorTap={setProfileUserId}
            />
          ) : (
            <SwipeCard
              key={currentItem.trip.id}
              ref={topCardRef as any}
              trip={currentItem.trip}
              isTop={true}
              sharedX={topCardX}
              isJoined={isCurrentJoined}
              matchPct={matchPct}
              matchingVibes={matchingVibes}
              isPlus={isPlus}
              onCompatibilityTap={() => {
                const profile = localProfile ?? userProfile
                const trialStatus = getTrialStatus(profile)
                if (trialStatus === 'none') {
                  setShowFoundingScreen(true)
                } else {
                  setPaywallContext(matchPct !== undefined ? { matchPct, destination: currentTrip?.destination } : undefined)
                  setShowPaywall(true)
                }
              }}
              onSwipeLeft={() => handleSwipeLeft()}
              onSwipeRight={() => handleSwipeRight(currentItem.trip)}
              onTap={() => onTripTap(currentItem.trip)}
              onCreatorTap={setProfileUserId}
            />
          )
        )}

        {/* DEBUG (temporary): confirms the web side inserted an ad slot and is asking
            native to show the AdMob overlay. Native-app only. Remove after verifying. */}
        {isCurrentAd && isNativeApp() && (
          <div
            style={{
              position: 'absolute', top: 10, left: 10, zIndex: 50,
              pointerEvents: 'none',
              backgroundColor: 'rgba(0,0,0,0.6)',
              border: '0.5px solid rgba(240,235,227,0.3)',
              borderRadius: 8, padding: '4px 8px',
              color: '#F0EBE3', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            AD SLOT · waiting for native overlay
          </div>
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

      {/* Founding screen triggered from compatibility tap during normal swiping */}
      {showFoundingScreen && userId && userProfile && (
        <FoundingMemberScreen
          userId={userId}
          profile={localProfile ?? userProfile}
          onClaimed={(updated) => {
            setLocalProfile(updated)
            setUserProfile(updated)
            onProfileClaimed?.(updated)
          }}
          onDismiss={() => setShowFoundingScreen(false)}
        />
      )}

      {/* Public profile modal — opened by tapping creator avatar on any card */}
      {profileUserId && (
        <PublicProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  )
}
