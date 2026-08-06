'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { purchasePlus, restorePurchases, isNativeApp, type BillingInterval } from '@/lib/purchase'
import { getTravelImages } from '@/lib/queries'
import { PlusWelcomeFlow } from '../PlusWelcomeFlow'
import type { UserProfile } from '@/lib/types'

interface Props {
  userId: string
  onDone: (profile: UserProfile | null) => void
  // Where this screen was opened from. Onboarding is ceremonial — the offer is
  // aspirational and the hold-to-confirm gesture reads as a commitment ritual.
  // The swipe wall is mid-task: the user was interrupted doing the thing they
  // came here for, so the frame is "you earned this" and the same hold gesture
  // reads as the app making it hard to say yes. Plain tap there.
  source?: 'onboarding' | 'swipe_wall'
}

function SelectDot({ selected }: { selected: boolean }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 11, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: selected ? '#F0EBE3' : 'transparent',
      border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
    }}>
      {selected && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

const TIMELINE = [
  { icon: '🔓', title: 'Today', body: 'Every trip, every filter, unlimited swipes — all of it unlocks right now.' },
  { icon: '🔔', title: 'In 2 days', body: "We'll send a heads up before anything happens, if you've allowed notifications." },
  { icon: '💳', title: 'Day 3', body: "Your trial ends. We'll only charge you if you decide to stay — cancel anytime before, no questions asked." },
] as const

export function TrialOfferPaywall({ userId, onDone, source = 'onboarding' }: Props) {
  const [plan, setPlan] = useState<'annual' | 'secondary'>('annual')
  const [travelImages, setTravelImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holding, setHolding] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fromWall = source === 'swipe_wall'
  const surface = fromWall ? 'swipe_wall_trial' : 'onboarding_trial'

  // The no-trial anchor plan. Weekly is the stronger decoy ($6.99/wk makes
  // $39.99/yr look obvious), but purchase.ts:45 still throws on native for
  // weekly — real installed builds would silently charge Monthly instead — so
  // native gets a real Monthly card rather than a card that errors on tap.
  // Flip this back to weekly everywhere once a weekly-aware build is live.
  const native = isNativeApp()
  const secondaryBilling: BillingInterval = native ? 'monthly' : 'weekly'
  const secondaryLabel = native ? 'Monthly' : 'Weekly'
  const secondaryPrice = native ? '$6.99' : '$6.99'
  const secondaryUnit = native ? '/mo' : '/wk'

  useEffect(() => {
    getTravelImages(12).then(imgs => setTravelImages(imgs))
  }, [])

  useEffect(() => {
    track('paywall_viewed', { surface, trigger: 'onboarding-trial', rail: isNativeApp() ? 'native' : 'web' })
  }, [surface])

  const skip = () => {
    haptic(6)
    track('purchase_cancelled', { rail: isNativeApp() ? 'native' : 'web' })
    onDone(null)
  }

  const handleConfirm = async () => {
    haptic(18)
    setLoading(true)
    setError(null)
    try {
      const billing: BillingInterval = plan === 'annual' ? 'annual' : secondaryBilling
      await purchasePlus(billing, 'onboarding-trial')
      // Annual is the only plan carrying the 3-day offer (StoreKit intro on
      // native, trial_period_days on Stripe) — so this, not purchase_completed,
      // is the event that means "a trial actually started".
      if (billing === 'annual') {
        track('trial_started', { surface, rail: isNativeApp() ? 'native' : 'web', billing })
      }
      haptic(16)
      setTimeout(() => setShowWelcome(true), 400)
    } catch (err: any) {
      setLoading(false)
      if (err?.message === 'cancelled') return
      setError(err?.message ?? 'Something went wrong. Try again.')
    }
  }

  // App Store Review 3.1.2 requires a restore path on any screen selling an
  // auto-renewable subscription. PaywallModal already had one; this screen
  // didn't, which was a real submission risk the moment it started selling on
  // native outside onboarding.
  const handleRestore = async () => {
    haptic(8)
    setRestoring(true)
    setError(null)
    try {
      await restorePurchases()
      setTimeout(() => setShowWelcome(true), 300)
    } catch (err: any) {
      setError(err?.message ?? 'No active purchase found for this account.')
    } finally {
      setRestoring(false)
    }
  }

  const startHold = () => {
    if (loading) return
    setHolding(true)
    haptic(6)
    holdTimer.current = setTimeout(() => {
      setHolding(false)
      handleConfirm()
    }, 1500)
  }

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
    if (holding) { haptic(4); setHolding(false) }
  }

  if (showWelcome) {
    return createPortal(
      <PlusWelcomeFlow userId={userId} onDone={onDone} />,
      document.body
    )
  }

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeInOut' }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, overflow: 'hidden' }}
    >
      {/* Travel photo background, same treatment as the founding-member reward screen */}
      {travelImages[0] && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${travelImages[0]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(22px) saturate(1.2) brightness(0.55)',
          transform: 'scale(1.07)',
        }} />
      )}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.72) 35%, rgba(5,5,5,0.94) 70%, #050505 100%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          paddingLeft: 24, paddingRight: 24,
        }}>

          {/* X — the only way to skip, per plan */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={skip}
              className="active:opacity-60"
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Skip"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Hero — one badge's worth of "this is free" messaging lives on the
              yearly card below; a second pill up here was saying the same
              thing twice before the user even reached the offer itself. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 260, damping: 22 }}
            style={{ textAlign: 'center', lineHeight: 1, marginBottom: 4, marginTop: 12 }}
          >
            <span style={{ fontSize: 84, fontWeight: 900, letterSpacing: '-4px', color: '#ffffff' }}>3 days</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.36, ease: 'easeOut' }}
            style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 17, fontWeight: 500, marginBottom: 6 }}
          >
            of <span style={{ color: '#F0EBE3', fontWeight: 700 }}>TripAlong+</span>
            {fromWall ? ' — you’ve earned it' : ', on us'}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.36, ease: 'easeOut' }}
            style={{ textAlign: 'center', color: 'rgba(255,255,255,0.32)', fontSize: 13, maxWidth: 280, margin: '0 auto 26px' }}
          >
            {fromWall
              ? 'You hit the daily limit because you actually use this. Cancel before day 3 and you won’t be charged a cent.'
              : "No pressure — cancel before day 3 and you won't be charged a cent."}
          </motion.p>

          {/* Timeline */}
          <div style={{ marginBottom: 26 }}>
            {TIMELINE.map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.48 + i * 0.1, duration: 0.36, ease: 'easeOut' }}
                style={{ display: 'flex', gap: 14 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: 'rgba(240,235,227,0.1)',
                    border: '0.5px solid rgba(240,235,227,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {t.icon}
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 22, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 4, marginBottom: 4 }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < TIMELINE.length - 1 ? 18 : 0 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{t.title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12.5, lineHeight: 1.5 }}>{t.body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Flexible gap */}
          <div style={{ flex: 1, minHeight: 8 }} />

          {/* Plan cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.36, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}
          >
            {/* Selection state is deliberately quiet — a border + checkmark,
                never a solid fill. Solid cream is reserved for the CTA
                button alone, so there's exactly one thing on the whole
                screen that reads as "the button to press." Before, the
                selected card and the CTA used the identical fill and were
                easy to confuse for the same control. */}
            <button
              type="button"
              onClick={() => { haptic(6); setPlan('annual') }}
              style={{
                position: 'relative', textAlign: 'left', padding: '16px 16px 14px',
                borderRadius: 18,
                backgroundColor: plan === 'annual' ? 'rgba(240,235,227,0.07)' : 'rgba(255,255,255,0.04)',
                border: plan === 'annual' ? '1.5px solid #F0EBE3' : '1.5px solid rgba(255,255,255,0.1)',
              }}
            >
              <span style={{
                position: 'absolute', top: -9, left: 16,
                padding: '3px 10px', borderRadius: 999,
                backgroundColor: '#000', color: '#F0EBE3',
                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
              }}>
                3 DAYS FREE
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Yearly</span>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>$39.99<span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>/yr</span></span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5 }}>
                    ~$3.33/mo — free for the first 3 days
                  </span>
                </div>
                <SelectDot selected={plan === 'annual'} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => { haptic(6); setPlan('secondary') }}
              style={{
                textAlign: 'left', padding: '14px 16px',
                borderRadius: 18,
                backgroundColor: plan === 'secondary' ? 'rgba(240,235,227,0.07)' : 'rgba(255,255,255,0.04)',
                border: plan === 'secondary' ? '1.5px solid #F0EBE3' : '1.5px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{secondaryLabel}</span>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{secondaryPrice}<span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>{secondaryUnit}</span></span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5 }}>
                    No trial — starts today
                  </span>
                </div>
                <SelectDot selected={plan === 'secondary'} />
              </div>
            </button>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.38, ease: 'easeOut' }}
          >
            {error && (
              <p style={{ textAlign: 'center', color: '#FF453A', fontSize: 12, marginBottom: 8 }}>{error}</p>
            )}
            <button
              type="button"
              {...(fromWall
                ? { onClick: () => { if (!loading) handleConfirm() } }
                : {
                    onPointerDown: startHold,
                    onPointerUp: cancelHold,
                    onPointerLeave: cancelHold,
                    onPointerCancel: cancelHold,
                  })}
              onContextMenu={e => e.preventDefault()}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-base select-none disabled:opacity-70"
              style={{
                position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
                color: '#000', marginBottom: 10,
                transform: holding ? 'scale(0.985)' : 'scale(1)',
                transition: 'transform 0.1s ease',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
              } as React.CSSProperties}
            >
              <motion.div
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 'inherit' }}
                initial={{ width: '0%' }}
                animate={{ width: holding ? '100%' : '0%' }}
                transition={{ duration: holding ? 1.5 : 0.2, ease: 'linear' }}
              />
              <span style={{ position: 'relative', zIndex: 1 }}>
                {loading ? (isNativeApp() ? 'Unlocking…' : 'Opening checkout…')
                  : holding ? 'Hold to confirm…'
                  : plan === 'annual'
                    ? (fromWall ? 'Keep swiping — 3 days free →' : 'Start my free 3 days →')
                    : `Continue — ${secondaryPrice}${secondaryUnit}`}
              </span>
            </button>

            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
              {plan === 'annual'
                // No "we'll remind you" here until /api/cron/trial-ending
                // actually exists (P1) — the timeline block above already
                // makes that promise conditionally and it's currently unbacked;
                // don't amplify it in a second place.
                ? "3 days free, then $39.99/year. Cancel anytime before then and you won't be charged."
                : `${secondaryPrice} billed ${native ? 'monthly' : 'weekly'}. Cancel anytime.`}
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              {native && (
                <>
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={restoring}
                    style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'underline' }}
                  >
                    {restoring ? 'Restoring…' : 'Restore Purchases'}
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
                </>
              )}
              <a href="/terms" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'underline' }}>Terms</a>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
              <a href="/privacy" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'underline' }}>Privacy</a>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  )

  return createPortal(content, document.body)
}
