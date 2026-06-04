'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'

interface Props {
  onClose?: () => void
  allowDismiss?: boolean
}

const DESTINATIONS = ['Bali', 'Tokyo', 'Medellín', 'Lisbon', 'Cape Town', 'Reykjavík', 'Kyoto', 'Porto', 'Oaxaca']

export function FoundingMemberPaywall({ onClose, allowDismiss = false }: Props) {
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
      {/* Subtle warm depth — not a photo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 110% 55% at 50% -5%, rgba(240,220,160,0.05) 0%, transparent 65%)',
      }} />

      {/* Close */}
      {allowDismiss && onClose && (
        <div
          className="absolute flex justify-end px-5"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)', left: 0, right: 0, zIndex: 2 }}
        >
          <button
            onClick={() => { haptic(6); onClose() }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div
        className="flex flex-col flex-1 overflow-y-auto"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + ${allowDismiss ? 64 : 52}px)`,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          paddingLeft: 24, paddingRight: 24,
        }}
      >

        {/* ── Hook ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="flex flex-col items-center text-center"
          style={{ marginBottom: 30 }}
        >
          {/* Icon */}
          <div style={{
            width: 68, height: 68, borderRadius: 22, marginBottom: 22,
            background: 'linear-gradient(145deg, rgba(240,235,227,0.1) 0%, rgba(240,235,227,0.03) 100%)',
            border: '1px solid rgba(240,235,227,0.13)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5"/>
              <path d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3 12h18" stroke="rgba(240,235,227,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3.5 8.5h17M3.5 15.5h17" stroke="rgba(240,235,227,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>

          <h2 style={{
            color: '#ffffff', fontSize: 28, fontWeight: 800,
            letterSpacing: '-0.6px', lineHeight: 1.15, marginBottom: 10,
          }}>
            Find your person<br />for every trip.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.6, maxWidth: 280 }}>
            The right co-traveler is a few swipes away. Keep going until you find them.
          </p>

          {/* Destination row */}
          <div style={{ position: 'relative', width: '100%', marginTop: 22, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
              {DESTINATIONS.map((dest, i) => (
                <motion.span
                  key={dest}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: i < 5 ? 1 - i * 0.14 : 0.1 }}
                  transition={{ delay: 0.08 + i * 0.05, duration: 0.32 }}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 999,
                    flexShrink: 0,
                    backgroundColor: 'rgba(240,235,227,0.05)',
                    border: '0.5px solid rgba(240,235,227,0.1)',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dest}
                </motion.span>
              ))}
            </div>
            {/* Right fade — implies there are more */}
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 72,
              background: 'linear-gradient(to right, transparent, #0A0906)',
              pointerEvents: 'none',
            }} />
          </div>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.36 }}
          style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 26 }}
        />

        {/* ── Pricing ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.38, ease: 'easeOut' }}
          style={{ marginBottom: 20 }}
        >
          {/* Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['annual', 'monthly'] as const).map(interval => (
              <button
                key={interval}
                type="button"
                onClick={() => { haptic(4); setBilling(interval) }}
                className="flex-1 py-3.5 rounded-2xl font-semibold transition-all relative"
                style={{
                  fontSize: 14,
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
            className="rounded-3xl p-5"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '0.5px solid rgba(255,255,255,0.1)',
            }}
          >
            {billing === 'annual' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 16, fontWeight: 600, marginTop: 8, marginRight: 2 }}>$</span>
                    <span style={{ color: '#fff', fontSize: 58, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1 }}>5</span>
                    <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 15, alignSelf: 'flex-end', paddingBottom: 8, marginLeft: 3 }}>/mo</span>
                  </div>
                  <div style={{ textAlign: 'right', paddingBottom: 8 }}>
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textDecoration: 'line-through', marginBottom: 3 }}>$7.99/mo</div>
                    <div style={{
                      padding: '3px 8px', borderRadius: 999, display: 'inline-block',
                      backgroundColor: 'rgba(48,209,88,0.12)', color: '#30D158',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                    }}>
                      FOUNDING RATE
                    </div>
                  </div>
                </div>
                <div style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>Billed $59.99/year</span>
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>$0.16/day</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 16, fontWeight: 600, marginTop: 8, marginRight: 2 }}>$</span>
                  <span style={{ color: '#fff', fontSize: 58, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1 }}>7.99</span>
                  <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 15, alignSelf: 'flex-end', paddingBottom: 8, marginLeft: 3 }}>/mo</span>
                </div>
                <div style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>Billed monthly — cancel anytime</span>
              </>
            )}
          </div>
        </motion.div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44, duration: 0.38, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {error && (
            <p className="text-center mb-2" style={{ color: '#FF453A', fontSize: 13 }}>{error}</p>
          )}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
              color: '#000', fontSize: 16, marginBottom: 10,
            }}
          >
            {loading ? 'Opening checkout…' : 'Keep swiping →'}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center' }}>
            Cancel anytime · Secure payment
          </p>
          {allowDismiss && onClose && (
            <button
              type="button"
              onClick={() => { haptic(4); onClose() }}
              className="w-full text-center py-2.5 mt-1 active:opacity-60"
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
