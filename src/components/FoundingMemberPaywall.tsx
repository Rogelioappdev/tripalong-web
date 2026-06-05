'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'

interface Props {
  onClose?: () => void
  allowDismiss?: boolean
  context?: { matchPct: number; destination?: string }
}

const FEATURES = [
  {
    label: 'Unlimited swipes',
    sub: 'No daily cap',
  },
  {
    label: 'See who viewed you',
    sub: 'Know who\'s interested',
  },
]

export function FoundingMemberPaywall({ onClose, allowDismiss = false, context }: Props) {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div
      className="fixed inset-0 z-[110] flex flex-col"
      style={{ backgroundColor: '#0A0906' }}
    >
      {/* Warm vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 110% 55% at 50% -5%, rgba(240,220,160,0.05) 0%, transparent 65%)',
      }} />

      {/* Close */}
      {allowDismiss && onClose && (
        <div
          className="absolute flex justify-end px-5"
          style={{ top: 'calc(env(safe-area-inset-top) + 14px)', left: 0, right: 0, zIndex: 2 }}
        >
          <button
            onClick={() => { haptic(6); onClose() }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div
        className="flex flex-col flex-1"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + ${allowDismiss ? 48 : 36}px)`,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          paddingLeft: 24, paddingRight: 24,
          justifyContent: 'space-between',
        }}
      >

        {/* ── Hook ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center text-center"
        >
          {context ? (
            /* Contextual — triggered from compatibility tap. No number revealed. */
            <>
              {/* Quality icon — color signals tier without the number */}
              <div style={{
                width: 52, height: 52, borderRadius: 16, marginBottom: 14,
                backgroundColor: context.matchPct >= 80
                  ? 'rgba(48,209,88,0.12)'
                  : context.matchPct >= 60
                  ? 'rgba(255,214,10,0.12)'
                  : 'rgba(255,255,255,0.06)',
                border: `1px solid ${context.matchPct >= 80 ? 'rgba(48,209,88,0.35)' : context.matchPct >= 60 ? 'rgba(255,214,10,0.35)' : 'rgba(255,255,255,0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d={context.matchPct >= 60
                      ? "M20 6L9 17l-5-5"
                      : "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"}
                    stroke={context.matchPct >= 80 ? '#30D158' : context.matchPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.5)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 style={{ color: '#ffffff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 8 }}>
                {context.matchPct >= 80
                  ? "You're a strong match\nwith this group."
                  : context.matchPct >= 60
                  ? "You're a good match\nwith this group."
                  : "You have things in common\nwith this group."}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: 1.5 }}>
                Unlock to see exactly how much.
              </p>
            </>
          ) : (
            /* Generic — triggered from limit screen, nudge strip, etc. */
            <>
              <div style={{
                width: 52, height: 52, borderRadius: 16, marginBottom: 14,
                background: 'linear-gradient(145deg, rgba(240,235,227,0.1) 0%, rgba(240,235,227,0.03) 100%)',
                border: '1px solid rgba(240,235,227,0.13)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5"/>
                  <path d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M3 12h18" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M3.5 8.5h17M3.5 15.5h17" stroke="rgba(240,235,227,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 style={{ color: '#ffffff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 8 }}>
                Find your person<br />for every trip.
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: 1.5 }}>
                The right co-traveler is a few swipes away.
              </p>
            </>
          )}

          {/* Feature list — shown for both */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 14 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: 'easeOut' }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(240,235,227,0.3)' }} />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
                  {f.label}
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}> — {f.sub}</span>
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Pricing ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.36, ease: 'easeOut' }}
        >
          {/* Divider */}
          <div style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }} />

          {/* Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['annual', 'monthly'] as const).map(interval => (
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
                {interval === 'annual' ? 'Annual' : 'Monthly'}
                {interval === 'annual' && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-bold"
                    style={{
                      backgroundColor: billing === 'annual' ? '#30D158' : 'rgba(48,209,88,0.2)',
                      color: billing === 'annual' ? '#fff' : '#30D158',
                      fontSize: 9, whiteSpace: 'nowrap',
                    }}
                  >
                    SAVE 37%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Price card */}
          <div
            className="rounded-2xl px-4 py-3"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '0.5px solid rgba(255,255,255,0.1)',
            }}
          >
            {billing === 'annual' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, fontWeight: 600, marginTop: 5, marginRight: 1 }}>$</span>
                    <span style={{ color: '#fff', fontSize: 44, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>5</span>
                    <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, alignSelf: 'flex-end', paddingBottom: 5, marginLeft: 2 }}>/mo</span>
                  </div>
                  <div style={{ textAlign: 'right', paddingBottom: 4 }}>
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textDecoration: 'line-through', marginBottom: 3 }}>$7.99/mo</div>
                    <div style={{
                      padding: '2px 7px', borderRadius: 999, display: 'inline-block',
                      backgroundColor: 'rgba(48,209,88,0.12)', color: '#30D158',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    }}>
                      FOUNDING RATE
                    </div>
                  </div>
                </div>
                <div style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 7 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>Billed $59.99/year</span>
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>$0.16/day</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, fontWeight: 600, marginTop: 5, marginRight: 1 }}>$</span>
                  <span style={{ color: '#fff', fontSize: 44, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>7.99</span>
                  <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, alignSelf: 'flex-end', paddingBottom: 5, marginLeft: 2 }}>/mo</span>
                </div>
                <div style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 7 }} />
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>Billed monthly — cancel anytime</span>
              </>
            )}
          </div>
        </motion.div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.36, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {error && (
            <p className="text-center mb-2" style={{ color: '#FF453A', fontSize: 12 }}>{error}</p>
          )}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
              color: '#000', fontSize: 15, marginBottom: 8,
            }}
          >
            {loading ? 'Opening checkout…' : context ? 'Unlock my scores →' : 'Keep swiping →'}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
            Cancel anytime · Secure payment
          </p>
          {allowDismiss && onClose && (
            <button
              type="button"
              onClick={() => { haptic(4); onClose() }}
              className="w-full text-center py-2 mt-1 active:opacity-60"
              style={{ color: 'rgba(255,255,255,0.16)', fontSize: 13 }}
            >
              Maybe later
            </button>
          )}
        </motion.div>

      </div>
    </div>
  )

  return createPortal(content, document.body)
}
