'use client'

export const dynamic = 'force-dynamic'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, useAnimation, AnimatePresence } from 'framer-motion'
import dynamicImport from 'next/dynamic'
import { haptic } from '@/lib/haptics'
import { NavBar } from '@/components/NavBar'
import { SwipeStack } from '@/components/SwipeStack'
import { AuthGate } from '@/components/AuthGate'
import { getTrips, getUserSavedTripIds, saveTrip, getProfile } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { getTrialStatus, getDevTrialOverride, hasPlus } from '@/lib/trial'
import { getTripMatchBreakdown } from '@/lib/matching'
import type { TripWithDetails, UserProfile } from '@/lib/types'
import { MemberJoinToast } from '@/components/MemberJoinToast'

// Heavy modals — only loaded when actually shown (code-split from initial bundle)
const TripDetailModal = dynamicImport(() => import('@/components/TripDetailModal').then(m => ({ default: m.TripDetailModal })), { ssr: false })
const CreateTripModal = dynamicImport(() => import('@/components/CreateTripModal').then(m => ({ default: m.CreateTripModal })), { ssr: false })
const SavedTripsModal = dynamicImport(() => import('@/components/SavedTripsModal').then(m => ({ default: m.SavedTripsModal })), { ssr: false })
const FoundingMemberPaywall = dynamicImport(() => import('@/components/FoundingMemberPaywall').then(m => ({ default: m.FoundingMemberPaywall })), { ssr: false })
const TrialExpiredPaywall = dynamicImport(() => import('@/components/TrialExpiredPaywall').then(m => ({ default: m.TrialExpiredPaywall })), { ssr: false })
const FeedTutorial = dynamicImport(() => import('@/components/FeedTutorial').then(m => ({ default: m.FeedTutorial })), { ssr: false })
const FoundingMemberScreen = dynamicImport(() => import('@/components/FoundingMemberScreen').then(m => ({ default: m.FoundingMemberScreen })), { ssr: false })

// Tab bar: 58px height + 16px bottom = 74px. Add 8px breathing room = 82px
const TAB_BAR_CLEARANCE = 82

function UpgradeToastHandler({ onUpgrade }: { onUpgrade: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('upgrade') !== 'success') return
    onUpgrade()
    router.replace('/feed', { scroll: false })
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function FeedPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [authGateDestination, setAuthGateDestination] = useState<string | undefined>(undefined)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [authGateRequired, setAuthGateRequired] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [savedToast, setSavedToast] = useState<TripWithDetails | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [pendingTripId, setPendingTripId] = useState<string | null>(null)
  const [upgradeToast, setUpgradeToast] = useState(false)
  const [showTrialExpiredPaywall, setShowTrialExpiredPaywall] = useState(false)
  const [trialExpiredNudge, setTrialExpiredNudge] = useState(false)
  const [feedProfile, setFeedProfile] = useState<UserProfile | null>(null)
  const [showFoundingScreen, setShowFoundingScreen] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('trial') === 'none'
  })
  // 'none' = free, 'animate' = first-ever Plus visit (animate in), 'static' = already seen
  const [plusTitleState, setPlusTitleState] = useState<'none' | 'animate' | 'static'>('none')

  const [justUpgraded, setJustUpgraded] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [paywallStats, setPaywallStats] = useState<{ viewerCount: number; topMatch: { pct: number; destination: string } | null } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const upgradeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bookmarkControls = useAnimation()

  // Load initial saved count once userId is known
  useEffect(() => {
    if (!userId) return
    getUserSavedTripIds(userId).then(ids => setSavedCount(ids.length))
  }, [userId])

  const handleUpgradeSuccess = () => {
    setUpgradeToast(true)
    setJustUpgraded(true)
    upgradeTimer.current = setTimeout(() => setUpgradeToast(false), 5000)
  }

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

  const triggerAuthGate = (destination?: string) => {
    setAuthGateDestination(destination)
    setShowAuthGate(true)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setIsGuest(true)
        if (sessionStorage.getItem('ta_require_auth')) {
          sessionStorage.removeItem('ta_require_auth')
          setAuthGateRequired(true)
          setShowAuthGate(true)
        }
        return
      }
      setUserId(session.user.id)

      // First-run tutorial — show once, ever
      const tutorialKey = `ta_feed_tutorial_${session.user.id}`
      if (!localStorage.getItem(tutorialKey)) {
        localStorage.setItem(tutorialKey, '1')
        setShowTutorial(true)
      }

      // After login, honour any pending redirect (e.g. trip invite link)
      const postAuthRedirect = sessionStorage.getItem('postAuthRedirect')
      if (postAuthRedirect && postAuthRedirect !== '/feed' && postAuthRedirect !== '/') {
        sessionStorage.removeItem('postAuthRedirect')
        router.replace(postAuthRedirect)
        return
      }

      const pending = localStorage.getItem('ta_pending_save')
      if (pending) {
        localStorage.removeItem('ta_pending_save')
        setPendingTripId(pending)
      }
      // Fetch profile once — reused for trial check, SwipeStack, and TripDetailModal
      const profile = await getProfile(session.user.id)
      if (profile) {
        const override = getDevTrialOverride()
        const effectiveProfile = override ? { ...profile, trial_start_at: override } : profile
        setFeedProfile(effectiveProfile)
        const isExpired = getTrialStatus(effectiveProfile) === 'expired' && effectiveProfile.subscription_tier === 'free'
        if (isExpired) {
          const alreadySeen = !override && !!localStorage.getItem('ta_trial_paywall_seen')
          if (alreadySeen) {
            const nudgeSessions = parseInt(localStorage.getItem('ta_nudge_sessions') ?? '0', 10)
            if (nudgeSessions < 3) {
              localStorage.setItem('ta_nudge_sessions', String(nudgeSessions + 1))
              setTrialExpiredNudge(true)
            }
            // After 3 sessions, nudge disappears permanently
          } else {
            setShowTrialExpiredPaywall(true)
            // Fetch personalization stats for the paywall in background
            supabase.rpc('get_my_viewer_count').then(({ data }) => {
              const viewerCount = (data as number) ?? 0
              setPaywallStats(prev => ({ viewerCount, topMatch: prev?.topMatch ?? null }))
            })
          }
        }
      }
    })
  }, [])

  // After Stripe checkout: poll until webhook flips subscription_tier to plus
  useEffect(() => {
    if (!justUpgraded || !userId) return
    let attempts = 0
    const poll = async () => {
      const p = await getProfile(userId)
      if (p && (p.subscription_tier === 'plus' || p.subscription_tier === 'pro')) {
        setFeedProfile(p)
        setJustUpgraded(false)
        return
      }
      if (++attempts < 12) setTimeout(poll, 1500)
    }
    poll()
  }, [justUpgraded, userId])

  // Compute top match score for paywall personalization once trips + profile are ready
  useEffect(() => {
    if (!showTrialExpiredPaywall || !feedProfile) return
    const cachedTrips = queryClient.getQueryData(['trips']) as TripWithDetails[] | undefined
    if (!cachedTrips?.length) return
    let best: { pct: number; destination: string } | null = null
    for (const trip of cachedTrips) {
      const { tripPct, groupPct } = getTripMatchBreakdown(feedProfile, trip)
      const pct = groupPct ?? tripPct
      if (!best || pct > best.pct) best = { pct, destination: trip.destination }
    }
    if (best) setPaywallStats(prev => ({ viewerCount: prev?.viewerCount ?? 0, topMatch: best }))
  }, [showTrialExpiredPaywall, feedProfile, queryClient])

  // TripAlong+ paused — title stays as "TripAlong" (plusTitleState stays 'none')

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

  // Feed trip data — background refetch every 5 min instead of a global realtime
  // subscription. Each open realtime channel costs a Supabase connection slot;
  // at 5k-10k MAU that would exhaust the Pro plan limit. A silent refetch is
  // imperceptible to users and frees up realtime slots for chat (which needs it).
  const { data: trips, isLoading, isError, refetch } = useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
    enabled: !!userId || isGuest,
    refetchInterval: 5 * 60 * 1000, // quietly refresh member counts every 5 min
  })

  // Signal native shell when trips are ready so it can fade out the splash overlay
  useEffect(() => {
    if (isLoading || trips === undefined) return
    const w = window as any
    if (w.ReactNativeWebView) {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'app_ready' }))
    }
  }, [isLoading, trips])

  // After login: auto-save the trip the guest tried to save, then show it
  useEffect(() => {
    if (!pendingTripId || !trips || !userId) return
    const trip = trips.find(t => t.id === pendingTripId)
    setPendingTripId(null)
    if (!trip) return
    saveTrip(pendingTripId, userId).catch(() => {})
    queryClient.invalidateQueries({ queryKey: ['saved-trips', userId] })
    setSavedCount(c => c + 1)
    setSavedToast(trip)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setSavedToast(null), 3500)
    bookmarkControls.start({ scale: [1, 1.55, 1], transition: { duration: 0.38, times: [0, 0.45, 1], ease: 'easeOut' } })
    setTimeout(() => setShowSaved(true), 800)
  }, [pendingTripId, trips, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {userId && <MemberJoinToast userId={userId} />}

      <Suspense fallback={null}>
        <UpgradeToastHandler onUpgrade={handleUpgradeSuccess} />
      </Suspense>

      {/* Trial expired — full paywall on first session after expiry */}
      <AnimatePresence>
        {showTrialExpiredPaywall && (
          <TrialExpiredPaywall
            viewerCount={paywallStats?.viewerCount ?? null}
            topMatch={paywallStats?.topMatch ?? null}
            onClose={() => {
              localStorage.setItem('ta_trial_paywall_seen', '1')
              setShowTrialExpiredPaywall(false)
              setTrialExpiredNudge(true)
            }}
          />
        )}
      </AnimatePresence>

      {/* Dev: ?trial=none → preview the founding member unlock screen */}
      <AnimatePresence>
        {showFoundingScreen && userId && (
          <FoundingMemberScreen
            userId={userId}
            profile={{ subscription_tier: 'free', trial_start_at: null } as any}
            onClaimed={() => { /* profile update handled inside */ }}
            onDismiss={() => setShowFoundingScreen(false)}
          />
        )}
      </AnimatePresence>

      {/* First-run swipe tutorial */}
      <AnimatePresence>
        {showTutorial && (
          <FeedTutorial onDone={() => {
            setShowTutorial(false)
          }} />
        )}
      </AnimatePresence>

      <NavBar />

      <main
        className="bg-black flex flex-col md:pt-14"
        style={{ height: '100dvh', overflow: 'hidden' }}
      >
        {/* Trial expired nudge strip */}
        <AnimatePresence>
          {trialExpiredNudge && !showTrialExpiredPaywall && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              type="button"
              onClick={() => { haptic(8); setShowTrialExpiredPaywall(true) }}
              className="mx-4 mt-2 mb-1 flex items-center justify-between px-4 py-2.5 rounded-2xl shrink-0 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(240,235,227,0.07)', border: '0.5px solid rgba(240,235,227,0.18)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <p className="text-white/70 text-sm font-medium">Plus trial ended</p>
              </div>
              <span className="text-white/45 text-xs font-semibold">Keep Plus →</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Guest banner */}
        {isGuest && (
          <button
            onClick={() => triggerAuthGate()}
            className="mx-4 mt-2 mb-1 flex items-center justify-between px-4 py-3 rounded-2xl shrink-0 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'rgba(240,235,227,0.07)', border: '0.5px solid rgba(240,235,227,0.15)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">✈️</span>
              <p className="text-white/70 text-sm font-medium">Join any trip — it's free</p>
            </div>
            <span className="text-white/40 text-xs font-semibold">Sign up →</span>
          </button>
        )}

        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-5 shrink-0"
          style={{ paddingTop: isGuest ? 8 : 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 10 }}>
          <h1 className="text-white font-extrabold text-2xl tracking-tight">
            TripAlong{plusTitleState !== 'none' ? '+' : ''}
          </h1>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              onClick={() => { haptic(8); isGuest ? triggerAuthGate() : setShowSaved(true) }}
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
              onClick={() => { haptic(8); isGuest ? triggerAuthGate() : setShowCreate(true) }}
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
              <SwipeStack
              trips={trips}
              userId={userId}
              isGuest={isGuest}
              initialProfile={feedProfile}
              onAuthRequired={triggerAuthGate}
              onTripTap={setSelectedTrip}
              onSave={handleTripSaved}
              onProfileClaimed={setFeedProfile}
            />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <p className="text-white/30 text-sm">No trips found.</p>
            </div>
          )}
        </div>
      </main>

      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
          isGuest={isGuest}
          initialProfile={feedProfile}
          onAuthRequired={triggerAuthGate}
          onProfileClaimed={setFeedProfile}
          fromFeed
        />
      )}

      <AnimatePresence>
        {showAuthGate && (
          <AuthGate
            destination={authGateDestination}
            onClose={() => { setShowAuthGate(false); setAuthGateRequired(false) }}
            required={authGateRequired}
          />
        )}
      </AnimatePresence>

      {showCreate && (
        <CreateTripModal onClose={() => setShowCreate(false)} userId={userId} />
      )}

      {showSaved && userId && (
        <SavedTripsModal
          userId={userId}
          onClose={() => setShowSaved(false)}
        />
      )}

      {/* Upgrade success toast */}
      <AnimatePresence>
        {upgradeToast && (
          <motion.div
            key="upgrade-toast"
            initial={{ y: 20, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed left-4 right-4 z-50 flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 90px)',
              background: 'linear-gradient(135deg, rgba(48,209,88,0.18) 0%, rgba(18,18,18,0.97) 60%)',
              border: '0.5px solid rgba(48,209,88,0.35)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              maxWidth: 400,
              margin: '0 auto',
            } as React.CSSProperties}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Welcome to TripAlong Plus ✈️</p>
              <p className="text-white/40 text-xs mt-0.5">Unlimited swipes — explore away</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
