'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { purchasePlus, restorePurchases, getNativePlusPricing, isNativeApp, type PlusPricing } from '@/lib/purchase'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import { PlusWelcomeFlow } from './PlusWelcomeFlow'
import type { TripWithDetails, UserProfile } from '@/lib/types'

interface Props {
  trigger: 'swipes' | 'rewind' | 'who-viewed' | 'compatibility' | 'upgrade'
  context?: string
  matchPct?: number
  trips?: TripWithDetails[]
  onClose: () => void
  // Called right after a successful purchase (native or web-return), before the
  // modal closes — lets the caller flip its own profile state to Plus immediately
  // instead of waiting on a server round-trip, so gated features unlock without
  // needing an app restart.
  onSuccess?: () => void
  // Needed to show the post-purchase welcome flow (which polls the server in
  // the background) — pass this to get it; without it the modal falls back to
  // the old instant-close behavior.
  userId?: string
  // Called once the welcome flow confirms the real server-side profile —
  // callers should commit this as their new source of truth, replacing
  // whatever optimistic guess onSuccess produced.
  onWelcomeDone?: (profile: UserProfile | null) => void
}

const FEATURES = [
  {
    icon: '∞',
    label: 'Unlimited swipes',
    sub: 'Swipe through every trip in the feed — no daily walls, no waiting until tomorrow.',
  },
  {
    icon: '✦',
    label: 'See your compatibility %',
    sub: 'Know exactly how well you match a trip and its travelers before you commit.',
  },
  {
    icon: '🚫',
    label: 'No ads',
    sub: 'Browse the feed without interruptions.',
  },
]

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tripDates(start: string | null, end: string | null) {
  const s = fmtDate(start)
  const e = fmtDate(end)
  if (s && e) return `${s} – ${e}`
  if (s) return `From ${s}`
  return 'Flexible dates'
}

export function PaywallModal({ trigger, context, matchPct, trips, onClose, onSuccess, userId, onWelcomeDone }: Props) {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nativePricing, setNativePricing] = useState<PlusPricing | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Top of the conversion funnel: which wall the user hit, and via which trigger.
  useEffect(() => {
    track('paywall_viewed', { surface: 'swipe_paywall', trigger, rail: isNativeApp() ? 'native' : 'web' })
  }, [trigger])

  // Native app: pull the live store price straight from RevenueCat/StoreKit
  // instead of the hardcoded fallback below, so it always matches what a
  // purchase will actually charge (including scheduled App Store price
  // changes). Resolves null on plain web or an app build too old to answer.
  useEffect(() => {
    getNativePlusPricing().then(setNativePricing)
  }, [])

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const headline =
    trigger === 'compatibility' ? "See exactly how well you match" :
    trigger === 'swipes' && context ? `${context} is waiting` :
    trigger === 'swipes' ? 'More trips are waiting' :
    trigger === 'rewind' ? 'Want that trip back?' :
    trigger === 'upgrade' ? 'Go further with TripAlong+' :
    'See who checked you out'

  const subcopy =
    trigger === 'compatibility'
      ? matchPct !== undefined && matchPct >= 60
        ? `You're a ${matchPct >= 80 ? 'strong' : 'good'} match — unlock to see the exact number.`
        : 'Unlock to see exactly how much you match.' :
    trigger === 'rewind' ? 'Unlock rewind and never lose a great trip again.' :
    trigger === 'upgrade' ? 'Unlimited swipes, no ads, and your compatibility % on every trip.' :
    "You've hit today's limit. Upgrade for unlimited."

  const handleUpgrade = async () => {
    haptic(12)
    setLoading(true)
    setError(null)
    try {
      await purchasePlus(billing)
      // Native: the RevenueCat SDK already confirmed the entitlement against
      // Apple's receipt at this point — no need to wait on the webhook that
      // syncs it to Supabase. Flip the caller's local profile state right away
      // so gated features unlock without needing an app restart.
      haptic(16)
      setUnlocked(true)
      onSuccess?.()
      if (userId) {
        // Show the full welcome flow instead of just closing — while the user
        // clicks through it, PlusWelcomeFlow polls the server in the
        // background so subscription_tier is guaranteed correct everywhere by
        // the time they land back in the app (not just wherever the
        // optimistic onSuccess() flip above happened to reach).
        setTimeout(() => setShowWelcome(true), 500)
      } else {
        setTimeout(() => { setLoading(false); onClose() }, 700)
      }
    } catch (err: any) {
      setLoading(false)
      if (err?.message === 'cancelled') return
      setError(err?.message ?? 'Something went wrong. Try again.')
    }
  }

  const handleRestore = async () => {
    haptic(8)
    setRestoring(true)
    setError(null)
    setRestoreMessage(null)
    try {
      await restorePurchases()
      setRestoreMessage('Purchase restored ✓')
      setTimeout(onClose, 1200)
    } catch (err: any) {
      setError(err?.message ?? 'No active purchase found for this account.')
    } finally {
      setRestoring(false)
    }
  }

  if (showWelcome && userId) {
    return createPortal(
      <PlusWelcomeFlow
        userId={userId}
        onDone={(confirmed) => {
          onWelcomeDone?.(confirmed)
          onClose()
        }}
      />,
      document.body
    )
  }

  const content = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onPointerDown={stop}
        onTouchStart={stop}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full sm:max-w-sm flex flex-col"
        style={{
          backgroundColor: '#0A0A0A',
          borderTop: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '92dvh',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        onPointerDown={stop}
        onTouchStart={stop}
      >
        {/* Handle — fixed */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="px-5 pt-4 pb-4">

            {/* Hero */}
            <div className="text-center mb-6">
              {trigger === 'rewind' ? (
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, rgba(240,235,227,0.15) 0%, rgba(240,235,227,0.05) 100%)', border: '1px solid rgba(240,235,227,0.15)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z" fill="rgba(240,235,227,0.8)"/>
                  </svg>
                </div>
              ) : (
                <img src="/tripalong-logo.png" alt="TripAlong"
                  style={{ width: 100, height: 100, objectFit: 'contain', mixBlendMode: 'screen', margin: '0 auto 8px' }} />
              )}
              <h2 className="text-white font-bold mb-1" style={{ fontSize: 22, letterSpacing: '-0.3px' }}>{headline}</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {subcopy}
              </p>
            </div>

            {/* Billing toggle */}
            <div className="flex gap-2 mb-4">
              {(['annual', 'monthly'] as const).map(interval => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => { haptic(4); setBilling(interval) }}
                  className="flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all relative"
                  style={{
                    backgroundColor: billing === interval ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
                    color: billing === interval ? '#000' : 'rgba(255,255,255,0.4)',
                    border: billing === interval ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {interval === 'annual' ? 'Annual' : 'Monthly'}
                  {interval === 'annual' && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-white font-bold"
                      style={{ backgroundColor: '#30D158', fontSize: 9, whiteSpace: 'nowrap' }}>
                      {nativePricing ? 'BEST VALUE' : 'SAVE 52%'}
                    </span>
                  )}
                  {interval === 'monthly' && nativePricing?.monthlyIntroPrice && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-white font-bold"
                      style={{ backgroundColor: '#FF9F0A', fontSize: 9, whiteSpace: 'nowrap' }}>
                      50% OFF FIRST MONTH
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Price */}
            {billing === 'monthly' && nativePricing?.monthlyIntroPrice ? (
              <>
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-white font-extrabold" style={{ fontSize: 48, letterSpacing: '-2px', lineHeight: 1 }}>
                    {nativePricing.monthlyIntroPrice}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>first month</span>
                </div>
                <p className="text-center mb-6" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                  Then {nativePricing.monthly}/mo — cancel anytime
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-white font-extrabold" style={{ fontSize: 48, letterSpacing: '-2px', lineHeight: 1 }}>
                    {nativePricing
                      ? (billing === 'annual' ? nativePricing.annual : nativePricing.monthly)
                      : (billing === 'annual' ? '$3.33' : '$6.99')}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
                    {nativePricing ? (billing === 'annual' ? '/yr' : '/mo') : '/mo'}
                  </span>
                </div>
                <p className="text-center mb-6" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                  {nativePricing
                    ? (billing === 'annual' ? 'Billed annually — cancel anytime' : 'Billed monthly — cancel anytime')
                    : (billing === 'annual' ? 'Billed $39.99/year — cancel anytime' : 'Billed monthly — cancel anytime')}
                </p>
              </>
            )}

            {/* Features — expanded */}
            <div className="flex flex-col gap-4 mb-8">
              {FEATURES.map(f => (
                <div key={f.label} className="flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
                    style={{ backgroundColor: 'rgba(240,235,227,0.08)', color: '#F0EBE3' }}>
                    {f.icon}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-white font-semibold mb-0.5" style={{ fontSize: 14 }}>{f.label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.5 }}>{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Divider + trip preview section */}
            <div className="mb-6">
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
              <p className="font-bold mb-1" style={{ fontSize: 16, color: '#fff', letterSpacing: '-0.2px' }}>
                Find your next adventure
              </p>
              <p className="mb-4" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                Every trip is posted by a real traveler with real dates. Swipe to find someone whose trip matches yours.
              </p>

              {/* Horizontal scrollable trip cards */}
              <div
                className="flex gap-3 overflow-x-auto pb-2"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {(trips ?? []).map(trip => (
                  <div
                    key={trip.id}
                    className="rounded-2xl overflow-hidden shrink-0 relative"
                    style={{ width: 180, height: 240, backgroundColor: '#1a1a1a' }}
                  >
                    {trip.cover_image && (
                      <img
                        src={trip.cover_image}
                        alt={trip.destination}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%)' }} />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-bold truncate" style={{ fontSize: 13 }}>{trip.destination}</p>
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>
                        {tripDates(trip.start_date, trip.end_date)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {trip.vibes[0] && (
                          <span className="px-2 py-0.5 rounded-full text-white font-medium truncate"
                            style={{ backgroundColor: 'rgba(255,255,255,0.12)', fontSize: 10, maxWidth: 100 }}>
                            {trip.vibes[0]}
                          </span>
                        )}
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>· {trip.member_count} going</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Sticky CTA */}
        <div className="shrink-0 px-5 pt-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', backgroundColor: '#0A0A0A' }}>
          {error && (
            <p className="text-center mb-2" style={{ color: '#FF453A', fontSize: 12 }}>{error}</p>
          )}
          {restoreMessage && (
            <p className="text-center mb-2" style={{ color: '#30D158', fontSize: 12 }}>{restoreMessage}</p>
          )}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{
              background: unlocked ? '#30D158' : 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
              color: unlocked ? '#fff' : '#000',
              fontSize: 15,
              transition: 'background 0.25s ease',
            }}
          >
            {unlocked ? 'Unlocked ✓' : loading ? (isNativeApp() ? 'Unlocking…' : 'Opening checkout…') : `Unlock Plus · ${
              billing === 'monthly' && nativePricing?.monthlyIntroPrice
                ? `${nativePricing.monthlyIntroPrice} first month`
                : nativePricing
                  ? (billing === 'annual' ? `${nativePricing.annual}/yr` : `${nativePricing.monthly}/mo`)
                  : (billing === 'annual' ? '$39.99/yr' : '$6.99/mo')
            }`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center py-2.5 active:opacity-60"
            style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
          >
            Maybe later
          </button>
          <div className="flex items-center justify-center gap-3 pb-1 flex-wrap">
            {isNativeApp() && (
              <>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={restoring}
                  className="text-center py-1 active:opacity-60 disabled:opacity-50"
                  style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'underline' }}
                >
                  {restoring ? 'Restoring…' : 'Restore Purchases'}
                </button>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
              </>
            )}
            <a href="/terms" className="py-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'underline' }}>
              Terms
            </a>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
            <a href="/privacy" className="py-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'underline' }}>
              Privacy
            </a>
          </div>
        </div>

      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
