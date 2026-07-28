'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'
import { track } from '@/lib/analytics'
import { isNativeApp } from '@/lib/purchase'
import { getTravelImages } from '@/lib/queries'
import { useSwipeDownDismiss } from '@/lib/useSwipeDownDismiss'

interface Props {
  onClose: () => void
  viewerCount?: number | null
  topMatch?: { pct: number; destination: string } | null
}

export function TrialExpiredPaywall({ onClose, viewerCount, topMatch }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canDismiss, setCanDismiss] = useState(false)
  const [bgImage, setBgImage] = useState<string | null>(null)
  const topBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    track('paywall_viewed', { surface: 'trial_expired', rail: isNativeApp() ? 'native' : 'web' })
    getTravelImages(4).then(imgs => { if (imgs[0]) setBgImage(imgs[0]) })
    const t = setTimeout(() => setCanDismiss(true), 2500)
    return () => clearTimeout(t)
  }, [])

  // Swipe down on the top bar to dismiss — only once the dismiss button itself unlocks.
  useSwipeDownDismiss(topBarRef, onClose, canDismiss)

  const handleUpgrade = async () => {
    haptic(12)
    setLoading(true)
    setError(null)
    try {
      await startCheckout(billing === 'annual' ? 'plus_annual' : 'plus_monthly', 'trial-expired')
    } catch (err: any) {
      setLoading(false)
      setError(err?.message ?? 'Something went wrong. Try again.')
    }
  }

  const content = (
    <div className="fixed inset-0 z-[110]" style={{ backgroundColor: '#050505' }}>

      {/* Travel photo background */}
      {bgImage && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(22px) saturate(1.1) brightness(0.6)',
          transform: 'scale(1.07)',
        }} />
      )}

      {/* Dark gradient overlay — heavy at bottom so content is legible */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 35%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.98) 100%)',
      }} />

      {/* Clearing veil — world opening up */}
      <motion.div
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 4, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, backgroundColor: '#000', pointerEvents: 'none' }}
      />

      {/* Top bar — swipe-down-to-dismiss zone (only active once canDismiss) */}
      <div
        ref={topBarRef}
        className="absolute top-0 left-0 right-0"
        style={{ height: 'calc(env(safe-area-inset-top) + 56px)', zIndex: 9 }}
      />

      {/* Dismiss button — appears after 2.5s */}
      <div className="absolute flex justify-end px-5 z-10"
        style={{ top: 'calc(env(safe-area-inset-top) + 14px)', left: 0, right: 0 }}>
        <AnimatePresence>
          {canDismiss && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={() => { haptic(6); onClose() }}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        paddingTop: 'calc(env(safe-area-inset-top) + 52px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
        paddingLeft: 28, paddingRight: 28,
      }}>

        {/* ── TripAlong+ wordmark ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.38, ease: 'easeOut' }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
        >
          <h1 style={{
            color: '#ffffff', fontSize: 28, fontWeight: 800,
            letterSpacing: '-0.8px', lineHeight: 1,
          }}>
            TripAlong<span style={{ color: '#ffffff' }}>+</span>
          </h1>
        </motion.div>

        {/* ── Hero: personalized if data available, generic fallback ── */}
        {viewerCount != null && viewerCount > 0 ? (
          // Personalized hero — real data from their trial
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.44, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {/* Viewer count stat */}
            <div style={{
              borderRadius: 20, padding: '18px 20px',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
              border: '0.5px solid rgba(255,255,255,0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#fff', fontSize: 52, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1 }}>
                  {viewerCount}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 500, paddingBottom: 8 }}>
                  {viewerCount === 1 ? 'traveler' : 'travelers'}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.4 }}>
                checked out your profile during your trial
              </p>
            </div>

            {/* Top match stat */}
            {topMatch && topMatch.pct >= 60 && (
              <div style={{
                borderRadius: 20, padding: '14px 20px',
                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                  Top match waiting for you
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    color: topMatch.pct >= 80 ? '#30D158' : '#FFD60A',
                    fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px',
                  }}>
                    {topMatch.pct}%
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                    {topMatch.destination}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          // Generic fallback
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.44, ease: 'easeOut' }}
            style={{ textAlign: 'center' }}
          >
            <h2 style={{ color: '#ffffff', fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 8 }}>
              Your trial<br />ended.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, fontWeight: 500 }}>
              Your next trip doesn't have to wait.
            </p>
          </motion.div>
        )}

        <div style={{ flex: 1 }} />

        {/* ── Divider ── */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.38, duration: 0.38, ease: 'easeOut' }}
          style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 18 }}
        />

        {/* ── Features — shown only when no personalized stats ── */}
        {(!viewerCount || viewerCount === 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {[
              { icon: '∞',  label: 'Unlimited swipes, every day' },
              { icon: '👁', label: 'See who viewed your profile' },
              { icon: '✦',  label: 'Match scores for every trip and traveler' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.44 + i * 0.09, duration: 0.34, ease: 'easeOut' }}
                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>{f.icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 500 }}>{f.label}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Pricing — annual dominant, monthly secondary ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.34, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}
        >
          {/* Annual — primary option */}
          <button
            type="button"
            onClick={() => { haptic(4); setBilling('annual') }}
            className="w-full rounded-2xl transition-all active:scale-[0.99] relative"
            style={{
              backgroundColor: billing === 'annual' ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
              border: billing === 'annual' ? 'none' : '0.5px solid rgba(255,255,255,0.12)',
              padding: '14px 18px',
            }}
          >
            {/* Best value badge */}
            <span
              className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full font-bold"
              style={{
                backgroundColor: billing === 'annual' ? '#30D158' : 'rgba(48,209,88,0.25)',
                color: billing === 'annual' ? '#fff' : '#30D158',
                fontSize: 9, letterSpacing: '0.05em',
              }}
            >
              BEST VALUE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: billing === 'annual' ? '#000' : '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>
                  $4.99 <span style={{ fontSize: 13, fontWeight: 500 }}>/ mo</span>
                </p>
                <p style={{ color: billing === 'annual' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>
                  Billed $59.99 / year
                </p>
              </div>
              <p style={{ color: billing === 'annual' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600 }}>
                $0.16 / day
              </p>
            </div>
          </button>

          {/* Monthly — secondary option */}
          <button
            type="button"
            onClick={() => { haptic(4); setBilling('monthly') }}
            className="w-full rounded-2xl transition-all active:scale-[0.99]"
            style={{
              backgroundColor: billing === 'monthly' ? '#F0EBE3' : 'rgba(255,255,255,0.04)',
              border: billing === 'monthly' ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
              padding: '10px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: billing === 'monthly' ? '#000' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600 }}>
                $7.99 / mo
              </p>
              <p style={{ color: billing === 'monthly' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.25)', fontSize: 11 }}>
                $0.26 / day
              </p>
            </div>
          </button>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.68, duration: 0.36, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          {error && <p style={{ color: '#FF453A', fontSize: 12, textAlign: 'center' }}>{error}</p>}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
              color: '#000', fontSize: 15,
            }}
          >
            {loading ? 'Opening checkout…' : 'Continue with Plus →'}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
            Cancel anytime · Secure payment
          </p>
          <AnimatePresence>
            {canDismiss && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                type="button"
                onClick={() => { haptic(4); onClose() }}
                className="py-1.5 active:opacity-60 transition-opacity"
                style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
              >
                Not now
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  )

  return createPortal(content, document.body)
}
