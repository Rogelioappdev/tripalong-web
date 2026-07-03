'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { trialDaysLeft, getTrialStatus, claimFoundingTrial } from '@/lib/trial'
import { startCheckout } from '@/lib/subscription'
import type { UserProfile } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  profile: UserProfile | null
  userId: string
  onClose: () => void
}

const COMPARISON = [
  { feature: 'Daily swipes',          free: '10 / day',   plus: 'Unlimited' },
  { feature: 'Compatibility scores',  free: null,          plus: 'Visible'   },
  { feature: 'See who viewed you',    free: null,          plus: 'All viewers'},
  { feature: 'Join & browse trips',   free: 'Included',   plus: 'Included'  },
]

export function PlusDetailsSheet({ profile, userId, onClose }: Props) {
  const router = useRouter()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trialStatus = getTrialStatus(profile)
  const isPaid = profile?.subscription_tier === 'plus' || profile?.subscription_tier === 'pro'
  const daysLeft = trialDaysLeft(profile)
  const noTrial = trialStatus === 'none'

  const handleCTA = async () => {
    haptic(12)
    setLoading(true)
    setError(null)
    try {
      if (noTrial) {
        await claimFoundingTrial(userId)
        onClose()
        router.push('/feed')
      } else {
        await startCheckout(billing === 'annual' ? 'plus_annual' : 'plus_monthly')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.')
      setLoading(false)
    }
  }

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="fixed inset-0 z-[120] flex flex-col overflow-y-auto"
      style={{ backgroundColor: '#0A0906' }}
    >
      {/* Warm glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 120% 40% at 50% 0%, rgba(240,220,160,0.06) 0%, transparent 60%)',
      }} />

      {/* Close */}
      <div className="flex justify-end px-5 shrink-0 relative z-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
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

      <div className="flex flex-col flex-1 px-6 relative z-10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)', gap: 28, paddingTop: 8 }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.38, ease: 'easeOut' }}
          className="flex flex-col items-center text-center gap-2"
        >
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em' }}>
            TripAlong+
          </p>

          {noTrial && (
            <>
              <h2 className="text-white font-extrabold" style={{ fontSize: 28, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
                Try Plus free<br />for 7 days
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: 1.5 }}>
                No payment needed. Cancel anytime.<br />Then $6.99/mo.
              </p>
            </>
          )}

          {trialStatus === 'active' && (
            <>
              <h2 className="text-white font-extrabold" style={{ fontSize: 28, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left<br />on your trial
              </h2>
              {/* Progress bar */}
              <div className="w-full max-w-xs h-1.5 rounded-full mt-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div className="h-1.5 rounded-full bg-green-400 transition-all"
                  style={{ width: `${((7 - daysLeft) / 7) * 100}%` }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
                Upgrade to keep Plus after day 7
              </p>
            </>
          )}

          {trialStatus === 'expired' && (
            <>
              <h2 className="text-white font-extrabold" style={{ fontSize: 28, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
                Your trial<br />has ended
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
                Upgrade to keep your scores and viewers
              </p>
            </>
          )}
        </motion.div>

        {/* ── Comparison table ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.36, ease: 'easeOut' }}
          className="rounded-2xl overflow-hidden"
          style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
        >
          {/* Table header */}
          <div className="grid grid-cols-3 px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Feature</p>
            <p className="text-xs font-semibold text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>Free</p>
            <p className="text-xs font-bold text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>Plus</p>
          </div>

          {COMPARISON.map((row, i) => (
            <div
              key={row.feature}
              className="grid grid-cols-3 px-4 py-3 items-center"
              style={{
                borderBottom: i < COMPARISON.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : undefined,
                backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{row.feature}</p>
              <div className="flex justify-center">
                {row.free ? (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{row.free}</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="flex justify-center">
                {row.plus === 'Included' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="text-xs font-medium" style={{ color: '#fff', fontSize: 12 }}>{row.plus}</span>
                )}
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Billing toggle (only for upgrade path) ── */}
        {!noTrial && !isPaid && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.34, ease: 'easeOut' }}
            className="flex gap-2"
          >
            {(['monthly', 'annual'] as const).map(interval => (
              <button
                key={interval}
                type="button"
                onClick={() => { haptic(4); setBilling(interval) }}
                className="flex-1 py-2.5 rounded-2xl font-semibold relative transition-all"
                style={{
                  fontSize: 13,
                  backgroundColor: billing === interval ? '#F0EBE3' : 'rgba(255,255,255,0.05)',
                  color: billing === interval ? '#000' : 'rgba(255,255,255,0.38)',
                  border: billing === interval ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
                }}
              >
                {interval === 'monthly' ? '$6.99 / mo' : '$3.33 / mo'}
                {interval === 'annual' && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: billing === 'annual' ? '#30D158' : 'rgba(48,209,88,0.2)',
                      color: billing === 'annual' ? '#fff' : '#30D158',
                      fontSize: 9,
                    }}
                  >
                    SAVE 52%
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.34, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2 mt-auto"
        >
          {error && <p className="text-xs text-center" style={{ color: '#FF453A' }}>{error}</p>}
          <button
            type="button"
            onClick={handleCTA}
            disabled={loading || isPaid}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
          >
            {loading
              ? (noTrial ? 'Starting trial…' : 'Opening checkout…')
              : noTrial
              ? 'Start free trial →'
              : `Upgrade — ${billing === 'annual' ? '$3.33/mo' : '$6.99/mo'}`}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
            {noTrial ? 'No payment needed · 7 days free' : 'Cancel anytime · Secure payment'}
          </p>
        </motion.div>

      </div>
    </motion.div>
  )

  return createPortal(content, document.body)
}
