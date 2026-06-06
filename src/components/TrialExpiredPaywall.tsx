'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'
import { getTravelImages } from '@/lib/queries'

interface Props {
  onClose: () => void
}

export function TrialExpiredPaywall({ onClose }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canDismiss, setCanDismiss] = useState(false)
  const [bgImage, setBgImage] = useState<string | null>(null)

  useEffect(() => {
    getTravelImages(4).then(imgs => { if (imgs[0]) setBgImage(imgs[0]) })
    const t = setTimeout(() => setCanDismiss(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const handleUpgrade = async () => {
    haptic(12)
    setLoading(true)
    setError(null)
    try {
      await startCheckout(billing === 'annual' ? 'plus_annual' : 'plus_monthly')
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

        {/* ── Identity badge ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.38, ease: 'easeOut' }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
        >
          <div style={{
            padding: '6px 18px', borderRadius: 999,
            backgroundColor: 'rgba(240,235,227,0.1)',
            border: '0.5px solid rgba(240,235,227,0.28)',
          }}>
            <span style={{ color: '#F0EBE3', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em' }}>
              ✦ TRIPALONG+ ✦
            </span>
          </div>
        </motion.div>

        {/* ── Hero headline ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.44, ease: 'easeOut' }}
          style={{ textAlign: 'center', marginBottom: 6 }}
        >
          <h2 style={{
            color: '#ffffff', fontSize: 38, fontWeight: 900,
            letterSpacing: '-1.5px', lineHeight: 1.1,
          }}>
            Your trial<br />ended.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.38, ease: 'easeOut' }}
          style={{ textAlign: 'center', marginBottom: 0 }}
        >
          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, fontWeight: 500, letterSpacing: '-0.2px' }}>
            Your next trip doesn't have to wait.
          </p>
        </motion.div>

        <div style={{ flex: 1 }} />

        {/* ── Divider ── */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.38, duration: 0.38, ease: 'easeOut' }}
          style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 22 }}
        />

        {/* ── Features ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
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

        {/* ── Pricing toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.34, ease: 'easeOut' }}
          style={{ display: 'flex', gap: 8, marginBottom: 10 }}
        >
          {(['monthly', 'annual'] as const).map(interval => (
            <button
              key={interval}
              type="button"
              onClick={() => { haptic(4); setBilling(interval) }}
              className="flex-1 py-2.5 rounded-2xl font-semibold transition-all relative"
              style={{
                fontSize: 13,
                backgroundColor: billing === interval ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
                color: billing === interval ? '#000' : 'rgba(255,255,255,0.4)',
                border: billing === interval ? 'none' : '0.5px solid rgba(255,255,255,0.1)',
              }}
            >
              {interval === 'monthly' ? '$7.99 / mo' : '$4.99 / mo'}
              {interval === 'annual' && (
                <span
                  className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: billing === 'annual' ? '#30D158' : 'rgba(48,209,88,0.2)',
                    color: billing === 'annual' ? '#fff' : '#30D158',
                    fontSize: 9,
                  }}
                >
                  SAVE 37%
                </span>
              )}
            </button>
          ))}
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
