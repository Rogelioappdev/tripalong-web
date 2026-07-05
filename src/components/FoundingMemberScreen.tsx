'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { claimFoundingTrial } from '@/lib/trial'
import { getTravelImages } from '@/lib/queries'
import { PlusWelcomeFlow } from './PlusWelcomeFlow'
import type { UserProfile } from '@/lib/types'

interface Props {
  userId: string
  profile: UserProfile
  onClaimed: (updatedProfile: UserProfile) => void
  onDismiss: () => void
}

// ── Offer + orchestration ─────────────────────────────────────────────────────

export function FoundingMemberScreen({ userId, profile, onClaimed, onDismiss }: Props) {
  const [phase, setPhase] = useState<'offer' | 'welcome'>('offer')
  const [travelImages, setTravelImages] = useState<string[]>([])

  useEffect(() => {
    getTravelImages(12).then(imgs => setTravelImages(imgs))
  }, [])

  const handleClaim = () => {
    haptic(18)
    const claimed = { ...profile, trial_start_at: new Date().toISOString() }
    onClaimed(claimed) // optimistic update — UI feels instant
    setPhase('welcome')
    // Persist to DB — if it fails the user still sees the animation,
    // but onDismiss will refetch so the UI stays correct long-term
    claimFoundingTrial(userId).catch((err) => {
      console.error('Trial claim failed:', err)
    })
  }

  const [holding, setHolding] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startHold = () => {
    setHolding(true)
    haptic(6)
    holdTimer.current = setTimeout(() => {
      setHolding(false)
      handleClaim()
    }, 1500)
  }

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
    if (holding) { haptic(4); setHolding(false) }
  }

  const content = (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: '#050505' }}>

      {/* ── Offer screen — full screen ── */}
      <AnimatePresence>
      {phase === 'offer' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* Travel photo background — slowly clears as you read */}
          {travelImages[0] && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${travelImages[0]})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(22px) saturate(1.2) brightness(0.65)',
              transform: 'scale(1.07)',
            }} />
          )}

          {/* Gradient overlay — heavier at bottom so CTA is always legible */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.68) 45%, rgba(0,0,0,0.90) 75%, rgba(0,0,0,0.97) 100%)',
          }} />

          {/* Clearing veil — fades away over 5s, world opening up effect */}
          <motion.div
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 5, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, backgroundColor: '#000', pointerEvents: 'none' }}
          />

          {/* Content */}
          <div style={{
            position: 'relative', zIndex: 1,
            flex: 1, display: 'flex', flexDirection: 'column',
            paddingTop: 'calc(env(safe-area-inset-top) + 52px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
            paddingLeft: 28, paddingRight: 28,
          }}>

            {/* Identity badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.38, ease: 'easeOut' }}
              style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}
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

            {/* Hero: "7" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.55, type: 'spring', stiffness: 260, damping: 20 }}
              style={{ textAlign: 'center', lineHeight: 1, marginBottom: 2 }}
            >
              <span style={{ fontSize: 148, fontWeight: 900, letterSpacing: '-10px', color: '#ffffff', display: 'block' }}>
                7
              </span>
            </motion.div>

            {/* "days of Plus, free" */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.38, ease: 'easeOut' }}
              style={{ textAlign: 'center', marginBottom: 0 }}
            >
              <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 20, fontWeight: 500, letterSpacing: '-0.3px' }}>
                days of <span style={{ color: '#F0EBE3', fontWeight: 700 }}>Plus</span>, free
              </p>
            </motion.div>

            {/* Flexible gap */}
            <div style={{ flex: 1 }} />

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.44, duration: 0.38, ease: 'easeOut' }}
              style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 22 }}
            />

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 28 }}>
              {[
                { icon: '∞', label: 'Unlimited swipes, every day' },
                { icon: '👁', label: 'See who viewed your profile' },
                { icon: '✦', label: 'Match scores — see how well you fit each trip and traveler' },
              ].map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.36, ease: 'easeOut' }}
                  style={{ display: 'flex', alignItems: 'center', gap: 16 }}
                >
                  <span style={{ fontSize: 22, width: 34, textAlign: 'center', flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, fontWeight: 500 }}>{f.label}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.64, duration: 0.38, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}
            >
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, fontWeight: 500, marginBottom: 10, letterSpacing: '0.01em' }}>
                No card. No catch.
              </p>
              <button
                type="button"
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={e => e.preventDefault()}
                className="w-full py-4 rounded-2xl font-bold text-base select-none"
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
                  color: '#000', marginBottom: 4,
                  transform: holding ? 'scale(0.985)' : 'scale(1)',
                  transition: 'transform 0.1s ease',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                } as React.CSSProperties}
              >
                {/* Fill layer sweeps in while holding */}
                <motion.div
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 'inherit' }}
                  initial={{ width: '0%' }}
                  animate={{ width: holding ? '100%' : '0%' }}
                  transition={{ duration: holding ? 1.5 : 0.2, ease: 'linear' }}
                />
                <span style={{ position: 'relative', zIndex: 1 }}>
                  {holding ? 'Hold to confirm...' : 'Claim your 7 days →'}
                </span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-3 active:opacity-60"
                style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
              >
                Maybe later
              </button>
            </motion.div>

          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Welcome animation + feature slides ── */}
      {phase === 'welcome' && (
        <PlusWelcomeFlow userId={userId} onDone={(confirmed) => {
          if (confirmed) onClaimed(confirmed)
          onDismiss()
        }} />
      )}

    </div>
  )

  return createPortal(content, document.body)
}
