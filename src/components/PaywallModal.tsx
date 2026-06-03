'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { startCheckout } from '@/lib/subscription'
import { haptic } from '@/lib/haptics'

interface Props {
  trigger: 'swipes' | 'rewind' | 'who-viewed'
  context?: string   // destination name for swipe trigger
  onClose: () => void
}

const FEATURES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="currentColor"/>
      </svg>
    ),
    label: 'Unlimited swipes',
    sub: 'Never hit a wall mid-session',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" fill="currentColor"/>
      </svg>
    ),
    label: 'See who viewed your profile',
    sub: 'Know who\'s already interested',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z" fill="currentColor"/>
      </svg>
    ),
    label: 'Rewind last swipe',
    sub: 'Take back a pass in an instant',
  },
]

function BlurredAvatars() {
  return (
    <div className="flex items-center justify-center mb-2">
      <div className="relative flex">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-12 h-12 rounded-full border-2 relative overflow-hidden"
            style={{
              borderColor: '#080808',
              marginLeft: i === 0 ? 0 : -14,
              zIndex: 5 - i,
              background: `hsl(${200 + i * 30}, 30%, ${20 + i * 5}%)`,
            }}
          >
            <div className="absolute inset-0" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.35)' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </div>
          </div>
        ))}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center absolute -bottom-1 -right-1"
          style={{ backgroundColor: '#F0EBE3', zIndex: 10 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#000" strokeWidth="2.2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#000" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

export function PaywallModal({ trigger, context, onClose }: Props) {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const headline =
    trigger === 'swipes' && context ? `${context} is waiting` :
    trigger === 'swipes' ? 'More trips are waiting' :
    trigger === 'rewind' ? 'Want that trip back?' :
    'See who checked you out'

  const sub =
    trigger === 'swipes' ? "You've hit today's limit. Upgrade for unlimited." :
    trigger === 'rewind' ? 'Unlock rewind and never lose a great trip again.' :
    'Real travelers are already checking your profile.'

  const handleUpgrade = async () => {
    haptic(12)
    setLoading(true)
    try {
      await startCheckout(billing === 'annual' ? 'plus_annual' : 'plus_monthly')
    } catch {
      setLoading(false)
    }
  }

  const content = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
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
        className="relative w-full sm:max-w-sm"
        style={{ backgroundColor: '#0A0A0A', borderTop: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', touchAction: 'none' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        onPointerDown={stop}
        onTouchStart={stop}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="w-8 h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="px-5 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}>

          {/* Hero */}
          <div className="text-center mb-5">
            {trigger === 'who-viewed' ? (
              <BlurredAvatars />
            ) : (
              <div className="flex items-center justify-center mx-auto mb-3">
                {trigger === 'rewind' ? (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(240,235,227,0.15) 0%, rgba(240,235,227,0.05) 100%)', border: '1px solid rgba(240,235,227,0.15)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z" fill="rgba(240,235,227,0.8)"/>
                    </svg>
                  </div>
                ) : (
                  <img src="/tripalong-logo.png" alt="TripAlong" style={{ width: 64, height: 64, objectFit: 'contain', mixBlendMode: 'screen' }} />
                )}
              </div>
            )}
            <h2 className="text-white font-bold mb-1" style={{ fontSize: 22, letterSpacing: '-0.3px' }}>{headline}</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.4 }}>{sub}</p>
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
                    SAVE 38%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-white font-extrabold" style={{ fontSize: 48, letterSpacing: '-2px', lineHeight: 1 }}>
              {billing === 'annual' ? '$5' : '$7.99'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>/mo</span>
          </div>
          <p className="text-center mb-5" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            {billing === 'annual' ? 'Billed $59.99/year — cancel anytime' : 'Billed monthly — cancel anytime'}
          </p>

          {/* Features */}
          <div className="flex flex-col gap-3 mb-5 px-1">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(240,235,227,0.08)', color: '#F0EBE3' }}>
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold" style={{ fontSize: 13 }}>{f.label}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000', fontSize: 15 }}
          >
            {loading
              ? 'Opening checkout…'
              : `Unlock Plus · ${billing === 'annual' ? '$59.99/yr' : '$7.99/mo'}`}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center py-3 active:opacity-60"
            style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
          >
            Maybe later
          </button>

        </div>
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
