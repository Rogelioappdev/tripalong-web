'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'

interface Props {
  onClose?: () => void // optional — on day 7 expiry we don't show a dismiss
  allowDismiss?: boolean
}

const FEATURES = [
  { icon: '∞', label: 'Unlimited swipes' },
  { icon: '👁', label: 'See who viewed your profile' },
  { icon: '↩', label: 'Rewind last swipe' },
]

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
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ backgroundColor: '#050505' }}>
      {/* Close — only if dismissible */}
      {allowDismiss && onClose && (
        <div className="flex justify-end px-5 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
          <button
            onClick={() => { haptic(6); onClose() }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col items-center px-6 pt-12 pb-4 text-center gap-6">

          {/* Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="flex items-center justify-center rounded-3xl"
              style={{
                width: 80, height: 80,
                background: 'linear-gradient(135deg, rgba(240,235,227,0.12) 0%, rgba(240,235,227,0.04) 100%)',
                border: '1px solid rgba(240,235,227,0.18)',
                fontSize: 36,
              }}
            >
              🌍
            </div>
            <div
              className="px-3 py-1 rounded-full font-bold"
              style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.2)', color: '#F0EBE3', fontSize: 10, letterSpacing: '0.08em' }}
            >
              FOUNDING MEMBER
            </div>
          </motion.div>

          {/* Headline */}
          <div>
            <h2 className="text-white font-bold mb-2" style={{ fontSize: 26, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
              Keep your Plus access
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.55 }}>
              Your free trial ended. Lock in your founding member rate before it's gone.
            </p>
          </div>

          {/* Pricing toggle */}
          <div className="w-full flex gap-2">
            {(['annual', 'monthly'] as const).map(interval => (
              <button
                key={interval}
                type="button"
                onClick={() => { haptic(4); setBilling(interval) }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all relative"
                style={{
                  backgroundColor: billing === interval ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
                  color: billing === interval ? '#000' : 'rgba(255,255,255,0.4)',
                  border: billing === interval ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
                }}
              >
                {interval === 'annual' ? 'Annual' : 'Monthly'}
                {interval === 'annual' && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-white font-bold"
                    style={{ backgroundColor: '#30D158', fontSize: 9, whiteSpace: 'nowrap' }}
                  >
                    BEST VALUE
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Price — Option A: strikethrough anchor */}
          <div className="w-full rounded-2xl p-5 flex flex-col items-center gap-1"
            style={{ backgroundColor: 'rgba(240,235,227,0.04)', border: '0.5px solid rgba(240,235,227,0.1)' }}>
            {billing === 'annual' ? (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, textDecoration: 'line-through' }}>$7.99/mo</span>
                  <span className="px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: 'rgba(48,209,88,0.15)', color: '#30D158', fontSize: 11 }}>
                    FOUNDING RATE
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-white font-extrabold" style={{ fontSize: 48, letterSpacing: '-2px', lineHeight: 1 }}>$5</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>/mo</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>Billed $59.99/year — cancel anytime</p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-white font-extrabold" style={{ fontSize: 48, letterSpacing: '-2px', lineHeight: 1 }}>$7.99</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>/mo</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>Billed monthly — cancel anytime</p>
              </>
            )}
          </div>

          {/* Features */}
          <div className="w-full flex flex-col gap-3">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(240,235,227,0.07)', fontSize: 16 }}>
                  {f.icon}
                </div>
                <span className="text-white font-medium" style={{ fontSize: 14 }}>{f.label}</span>
                <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#30D158' }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 px-6 pt-3 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.07)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', backgroundColor: '#050505' }}>
        {error && (
          <p className="text-center mb-2" style={{ color: '#FF453A', fontSize: 12 }}>{error}</p>
        )}
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000', fontSize: 15 }}
        >
          {loading ? 'Opening checkout…' : `Keep Plus · ${billing === 'annual' ? '$59.99/yr' : '$7.99/mo'}`}
        </button>
        {allowDismiss && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center py-2.5 active:opacity-60"
            style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
          >
            Maybe later
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
