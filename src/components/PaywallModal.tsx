'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { startCheckout } from '@/lib/subscription'
import { haptic } from '@/lib/haptics'

interface Props {
  trigger: 'swipes' | 'rewind' | 'who-viewed'
  context?: string        // e.g. "Tokyo" for "Tokyo is waiting"
  onClose: () => void
}

const TRIGGER_COPY: Record<Props['trigger'], { headline: string; sub: string }> = {
  swipes:   { headline: 'Keep exploring', sub: 'You\'ve used your swipes for today. Upgrade for unlimited.' },
  rewind:   { headline: 'Want that trip back?', sub: 'Upgrade to undo your last swipe.' },
  'who-viewed': { headline: 'Someone checked you out', sub: 'Upgrade to see who\'s been viewing your profile.' },
}

const PLUS_FEATURES = [
  'Unlimited swipes — explore every trip',
  'See who viewed your profile',
  'Rewind — undo your last swipe',
]

export function PaywallModal({ trigger, context, onClose }: Props) {
  const [billingInterval, setBillingInterval] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState<string | null>(null)
  const copy = TRIGGER_COPY[trigger]

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const stopEvents = (e: React.SyntheticEvent) => e.stopPropagation()

  const headline = context && trigger === 'swipes'
    ? `${context} is waiting`
    : copy.headline

  const handleUpgrade = async (planKey: 'plus_monthly' | 'plus_annual' | 'pro_monthly' | 'pro_annual') => {
    haptic(12)
    setLoading(planKey)
    try {
      await startCheckout(planKey)
    } catch {
      setLoading(null)
    }
  }

  const content = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onPointerDown={stopEvents}
        onTouchStart={stopEvents}
        onClick={onClose}
      />

      <motion.div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ backgroundColor: '#0C0C0C', border: '0.5px solid rgba(255,255,255,0.1)', touchAction: 'pan-y' }}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        onPointerDown={stopEvents}
        onTouchStart={stopEvents}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-6 pt-3 pb-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #d4c9be 100%)' }}>
              <span style={{ fontSize: 26 }}>✈️</span>
            </div>
            <h2 className="text-white font-bold text-2xl mb-1">{headline}</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>{copy.sub}</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-1 mb-5 p-1 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={() => { haptic(4); setBillingInterval('annual') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: billingInterval === 'annual' ? '#F0EBE3' : 'transparent',
                color: billingInterval === 'annual' ? '#000' : 'rgba(255,255,255,0.45)',
              }}
            >
              Annual
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: billingInterval === 'annual' ? '#30D158' : 'rgba(48,209,88,0.2)', color: billingInterval === 'annual' ? '#fff' : '#30D158' }}>
                2 months free
              </span>
            </button>
            <button
              type="button"
              onClick={() => { haptic(4); setBillingInterval('monthly') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: billingInterval === 'monthly' ? '#F0EBE3' : 'transparent',
                color: billingInterval === 'monthly' ? '#000' : 'rgba(255,255,255,0.45)',
              }}
            >
              Monthly
            </button>
          </div>

          {/* Plus card */}
          <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: 'rgba(240,235,227,0.07)', border: '1px solid rgba(240,235,227,0.18)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-bold text-lg">TripAlong Plus</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {billingInterval === 'annual' ? '$59.99/year · $5/mo' : '$7.99/month'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-extrabold text-2xl">
                  {billingInterval === 'annual' ? '$5' : '$7.99'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>/month</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              {PLUS_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleUpgrade(billingInterval === 'annual' ? 'plus_annual' : 'plus_monthly')}
              disabled={!!loading}
              className="w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50 transition-opacity active:scale-[0.98]"
              style={{ backgroundColor: '#F0EBE3', color: '#000' }}
            >
              {loading === 'plus_annual' || loading === 'plus_monthly' ? 'Opening checkout…' : `Get Plus · ${billingInterval === 'annual' ? '$59.99/yr' : '$7.99/mo'}`}
            </button>
          </div>

          {/* Cancel link */}
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center py-2 text-sm transition-opacity active:opacity-60"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
