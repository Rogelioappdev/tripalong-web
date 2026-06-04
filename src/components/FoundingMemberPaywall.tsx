'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'
import { getTravelImages, getProfileViewers } from '@/lib/queries'

interface Props {
  onClose?: () => void
  allowDismiss?: boolean
}

export function FoundingMemberPaywall({ onClose, allowDismiss = false }: Props) {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [viewerCount, setViewerCount] = useState<number | null>(null)

  useEffect(() => {
    getTravelImages(3).then(imgs => { if (imgs[0]) setBgImage(imgs[0]) })
    getProfileViewers(999).then(v => setViewerCount(v.length))
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
    <div className="fixed inset-0 z-[110] overflow-hidden" style={{ backgroundColor: '#050505' }}>

      {/* Travel photo background */}
      {bgImage && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(22px) saturate(1.2) brightness(0.55)',
          transform: 'scale(1.07)',
        }} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.92) 72%, rgba(0,0,0,0.98) 100%)',
      }} />

      {/* Clearing veil */}
      <motion.div
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 5, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, backgroundColor: '#000', pointerEvents: 'none' }}
      />

      {/* Close button — only when dismissible */}
      {allowDismiss && onClose && (
        <div
          className="absolute flex justify-end px-5"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)', left: 0, right: 0, zIndex: 2 }}
        >
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

      {/* Content */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + ${allowDismiss ? 64 : 52}px)`,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          paddingLeft: 28, paddingRight: 28,
          zIndex: 1,
        }}
      >
        {/* Badge */}
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
              ✦ TRIPALONG TRAVELER ✦
            </span>
          </div>
        </motion.div>

        {/* Loss headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.38, ease: 'easeOut' }}
          style={{ textAlign: 'center', marginBottom: 10 }}
        >
          <p className="text-white font-extrabold" style={{ fontSize: 28, letterSpacing: '-0.6px', lineHeight: 1.1 }}>
            Your trial ended.
          </p>
          {viewerCount !== null && viewerCount > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{viewerCount} {viewerCount === 1 ? 'traveler' : 'travelers'}</span>
              {' '}found your profile this week.
            </p>
          )}
        </motion.div>

        {/* Flex gap */}
        <div style={{ flex: 1 }} />

        {/* Price — dominant anchor */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26, duration: 0.48, type: 'spring', stiffness: 260, damping: 22 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 600, marginTop: 18, marginRight: 4 }}>$</span>
            <span style={{ color: '#ffffff', fontSize: 96, fontWeight: 900, letterSpacing: '-6px', lineHeight: 1 }}>
              {billing === 'annual' ? '5' : '7.99'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16, fontWeight: 500, alignSelf: 'flex-end', paddingBottom: 14, marginLeft: 4 }}>
              /mo
            </span>
          </div>
          {billing === 'annual' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, textDecoration: 'line-through' }}>$7.99/mo</span>
              <span style={{
                padding: '3px 10px', borderRadius: 999,
                backgroundColor: 'rgba(48,209,88,0.15)',
                color: '#30D158', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              }}>
                FOUNDING RATE
              </span>
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 13, marginTop: 2 }}>
              Billed monthly — cancel anytime
            </p>
          )}
          {billing === 'annual' && (
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 13, marginTop: 4 }}>
              Billed $59.99/year — cancel anytime
            </p>
          )}
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36, duration: 0.34 }}
          style={{ display: 'flex', gap: 8, marginBottom: 24, marginTop: 16 }}
        >
          {(['annual', 'monthly'] as const).map(interval => (
            <button
              key={interval}
              type="button"
              onClick={() => { haptic(4); setBilling(interval) }}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all relative"
              style={{
                backgroundColor: billing === interval ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
                color: billing === interval ? '#000' : 'rgba(255,255,255,0.38)',
                border: billing === interval ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
              }}
            >
              {interval === 'annual' ? 'Annual · $59.99' : 'Monthly · $7.99'}
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
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44, duration: 0.38, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}
        >
          {error && (
            <p className="text-center mb-2" style={{ color: '#FF453A', fontSize: 12 }}>{error}</p>
          )}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000', fontSize: 15, marginBottom: 4 }}
          >
            {loading ? 'Opening checkout…' : 'Keep my Plus →'}
          </button>
          {allowDismiss && onClose && (
            <button
              type="button"
              onClick={() => { haptic(4); onClose() }}
              className="w-full text-center py-2.5 active:opacity-60"
              style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
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
