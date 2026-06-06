'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'

interface Props {
  onClose: () => void
}

const LOCKED = [
  { label: 'Compatibility scores', was: 'Visible during trial', now: 'Now hidden' },
  { label: 'See who viewed you',   was: 'Unlocked during trial', now: 'Now locked'  },
  { label: 'Unlimited swipes',     was: 'No cap during trial',   now: '10 / day again' },
]

export function TrialExpiredPaywall({ onClose }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canDismiss, setCanDismiss] = useState(false)

  // Delay the close button — force them to read the headline first
  useEffect(() => {
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
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ backgroundColor: '#0A0906' }}>

      {/* Warm amber glow — signals "something changed" */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 100% 45% at 50% 0%, rgba(255,180,50,0.07) 0%, transparent 60%)',
      }} />

      {/* Close — appears after 2.5s */}
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
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col flex-1 px-6 relative z-10"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 52px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >

        {/* ── Hook ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="flex flex-col items-center text-center"
        >
          {/* Lock icon with amber glow */}
          <div style={{
            width: 52, height: 52, borderRadius: 16, marginBottom: 16,
            background: 'linear-gradient(145deg, rgba(255,180,50,0.14) 0%, rgba(255,180,50,0.04) 100%)',
            border: '1px solid rgba(255,180,50,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,180,50,0.9)" strokeWidth="1.8"/>
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(255,180,50,0.9)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>

          <h2 style={{ color: '#ffffff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.7px', lineHeight: 1.15, marginBottom: 10 }}>
            Your trial ended.<br />Your edge doesn't<br />have to.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: 1.55 }}>
            Keep the features you used for 7 days.
          </p>
        </motion.div>

        {/* ── Locked features ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.38, ease: 'easeOut' }}
          className="rounded-2xl overflow-hidden"
          style={{ border: '0.5px solid rgba(255,180,50,0.15)', backgroundColor: 'rgba(255,180,50,0.03)' }}
        >
          {LOCKED.map((item, i) => (
            <div key={item.label}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: i < LOCKED.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : undefined }}
            >
              <div className="flex items-center gap-3">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,180,50,0.6)" strokeWidth="2"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(255,180,50,0.6)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.label}</p>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,180,50,0.7)', fontWeight: 600 }}>{item.now}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Pricing ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.36, ease: 'easeOut' }}
        >
          {/* Toggle — monthly first (lower commitment) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['monthly', 'annual'] as const).map(interval => (
              <button
                key={interval}
                type="button"
                onClick={() => { haptic(4); setBilling(interval) }}
                className="flex-1 py-2.5 rounded-2xl font-semibold transition-all relative"
                style={{
                  fontSize: 13,
                  backgroundColor: billing === interval ? '#F0EBE3' : 'rgba(255,255,255,0.05)',
                  color: billing === interval ? '#000' : 'rgba(255,255,255,0.38)',
                  border: billing === interval ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
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
          </div>

          {/* Price detail */}
          <div className="rounded-2xl px-4 py-3"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '0.5px solid rgba(255,255,255,0.09)',
            }}
          >
            {billing === 'monthly' ? (
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-0.5">
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 600 }}>$</span>
                  <span style={{ color: '#fff', fontSize: 40, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>7.99</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>/mo</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>Cancel anytime</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-0.5">
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 600 }}>$</span>
                    <span style={{ color: '#fff', fontSize: 40, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>4.99</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>/mo</span>
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textDecoration: 'line-through' }}>$7.99/mo</div>
                  <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>Billed $59.99/year</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.36, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          {error && <p className="text-xs text-center mb-1" style={{ color: '#FF453A' }}>{error}</p>}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
          >
            {loading ? 'Opening checkout…' : 'Continue with Plus →'}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, textAlign: 'center' }}>
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
                className="py-2 active:opacity-60 transition-opacity"
                style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}
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
