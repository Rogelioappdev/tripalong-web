'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { claimFoundingTrial } from '@/lib/trial'
import { registerPush } from '@/lib/push'
import { getProfileViewers } from '@/lib/queries'
import type { UserProfile } from '@/lib/types'

interface Props {
  userId: string
  profile: UserProfile
  onClaimed: (updatedProfile: UserProfile) => void
  onDismiss: () => void
}

interface Viewer {
  id: string
  name: string
  profile_photo: string | null
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 rounded-full overflow-hidden" style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: '#F0EBE3' }}
            initial={{ width: i < current ? '100%' : '0%' }}
            animate={{ width: i < current ? '100%' : i === current ? '100%' : '0%' }}
            transition={i === current ? { duration: 0.4, ease: 'easeOut' } : { duration: 0 }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Avatar with blur reveal ───────────────────────────────────────────────────

function BlurAvatar({ viewer, delay, revealed }: { viewer: Viewer | null; delay: number; revealed: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay }}
      className="rounded-full overflow-hidden border-2"
      style={{ width: 72, height: 72, borderColor: 'rgba(240,235,227,0.2)', backgroundColor: '#1a1a1a', flexShrink: 0 }}
    >
      <motion.div
        className="w-full h-full"
        animate={{ filter: revealed ? 'blur(0px) saturate(1)' : 'blur(14px) saturate(0)' }}
        transition={{ duration: 0.55, delay: revealed ? delay + 0.1 : 0, ease: 'easeOut' }}
        style={{ filter: 'blur(14px) saturate(0)' }}
      >
        {viewer?.profile_photo ? (
          <img src={viewer.profile_photo} alt={viewer.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }} />
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Count up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active || target === 0) return
    const steps = Math.min(target, 30)
    const stepTime = 800 / steps
    const inc = target / steps
    let cur = 0
    const t = setInterval(() => {
      cur += inc
      if (cur >= target) { setVal(target); clearInterval(t) }
      else setVal(Math.floor(cur))
    }, stepTime)
    return () => clearInterval(t)
  }, [target, active])
  return val
}

// ── Slide 0 — Welcome ─────────────────────────────────────────────────────────

function SlideWelcome({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => { haptic(6); onNext() }, 2400)
    return () => clearTimeout(t)
  }, [onNext])

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 text-center">
      {/* Logo with glow */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
        style={{ position: 'relative' }}
      >
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: -20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(240,235,227,0.18) 0%, transparent 70%)',
          }}
        />
        <img
          src="/tripalong-logo.png"
          alt="TripAlong"
          style={{ width: 110, height: 110, objectFit: 'contain', mixBlendMode: 'screen', display: 'block' }}
        />
      </motion.div>

      {/* Text */}
      <div>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5, ease: 'easeOut' }}
          style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 6 }}
        >
          Welcome to
        </motion.p>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
          className="text-white font-extrabold"
          style={{ fontSize: 40, letterSpacing: '-1.5px', lineHeight: 1 }}
        >
          TripAlong Plus
        </motion.h1>
      </div>

      {/* Badge */}
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.85 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.85, type: 'spring', stiffness: 300, damping: 22 }}
        className="px-4 py-2 rounded-full font-bold"
        style={{
          backgroundColor: 'rgba(240,235,227,0.08)',
          border: '0.5px solid rgba(240,235,227,0.25)',
          color: '#F0EBE3',
          fontSize: 12,
          letterSpacing: '0.1em',
        }}
      >
        FOUNDING MEMBER
      </motion.div>
    </div>
  )
}

// ── Slide 1 — Unlimited swipes ────────────────────────────────────────────────

function SlideUnlimited() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-7 px-8 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.1 }}
        className="flex items-center justify-center rounded-3xl"
        style={{
          width: 110, height: 110,
          background: 'linear-gradient(135deg, rgba(240,235,227,0.1) 0%, rgba(240,235,227,0.03) 100%)',
          border: '1px solid rgba(240,235,227,0.15)',
        }}
      >
        <span style={{ fontSize: 56, lineHeight: 1 }}>∞</span>
      </motion.div>

      <div>
        <motion.h2
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.45, ease: 'easeOut' }}
          className="text-white font-extrabold mb-3"
          style={{ fontSize: 32, letterSpacing: '-0.8px', lineHeight: 1.1 }}
        >
          Unlimited swipes
        </motion.h2>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
          style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1.6 }}
        >
          Swipe through every trip in the feed. No daily walls, no waiting until tomorrow.
        </motion.p>
      </div>
    </div>
  )
}

// ── Slide 2 — Who viewed ──────────────────────────────────────────────────────

function SlideWhoViewed({ viewers }: { viewers: Viewer[] }) {
  const [revealed, setRevealed] = useState(false)
  const count = useCountUp(viewers.length > 0 ? viewers.length : 3, revealed)
  const display = viewers.length > 0 ? viewers.slice(0, 4) : Array(4).fill(null)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-7 px-8 text-center">
      {/* Avatars */}
      <div className="flex gap-3 justify-center">
        {display.map((v, i) => (
          <BlurAvatar key={i} viewer={v} delay={i * 0.12} revealed={revealed} />
        ))}
      </div>

      {/* Count */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-baseline justify-center gap-2 mb-3">
          <span className="text-white font-extrabold" style={{ fontSize: 48, letterSpacing: '-2px', lineHeight: 1 }}>
            {count}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18 }}>travelers</span>
        </div>
        <h2 className="text-white font-extrabold mb-3" style={{ fontSize: 28, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
          already found you
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.6 }}>
          See exactly who viewed your profile — and who might want to travel with you.
        </p>
      </motion.div>
    </div>
  )
}

// ── Slide 3 — Done ────────────────────────────────────────────────────────────

function SlideDone({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(48,209,88,0.2) 0%, rgba(48,209,88,0.05) 100%)',
          border: '1px solid rgba(48,209,88,0.3)',
          fontSize: 40,
        }}
      >
        ✓
      </motion.div>

      <div>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }}
          className="text-white font-extrabold mb-3"
          style={{ fontSize: 30, letterSpacing: '-0.6px', lineHeight: 1.15 }}
        >
          {"You're all set"}
        </motion.h2>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
          style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.6 }}
        >
          7 days of Plus — free. Find your next travel partner.
        </motion.p>
      </div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4, ease: 'easeOut' }}
        type="button"
        onClick={onDone}
        className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform"
        style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
      >
        Start exploring →
      </motion.button>
    </div>
  )
}

// ── Onboarding shell ──────────────────────────────────────────────────────────

function PlusOnboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [viewers, setViewers] = useState<Viewer[]>([])
  const TOTAL = 4

  useEffect(() => {
    getProfileViewers(4).then(v => setViewers(v))
  }, [])

  const next = useCallback(() => {
    setIdx(i => {
      if (i >= TOTAL - 1) return i
      haptic(8)
      setDirection(1)
      return i + 1
    })
  }, [])

  const skip = () => {
    haptic(4)
    onDone()
  }

  const handleDone = async () => {
    haptic(12)
    try { await registerPush(userId) } catch {}
    onDone()
  }

  const slides = [
    <SlideWelcome key="welcome" onNext={next} />,
    <SlideUnlimited key="unlimited" />,
    <SlideWhoViewed key="whoviewed" viewers={viewers} />,
    <SlideDone key="done" onDone={handleDone} />,
  ]

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0 }),
  }

  return (
    <div
      className="flex flex-col"
      style={{ position: 'absolute', inset: 0 }}
      onClick={idx > 0 && idx < TOTAL - 1 ? next : undefined}
    >
      {/* Progress bar */}
      <ProgressBar total={TOTAL} current={idx} />

      {/* Skip */}
      {idx > 0 && idx < TOTAL - 1 && (
        <div className="flex justify-end px-5 pt-3">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); skip() }}
            style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 600 }}
          >
            Skip
          </button>
        </div>
      )}

      {/* Slide */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={idx}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          className="flex-1 flex flex-col"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        >
          {slides[idx]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Offer screen ──────────────────────────────────────────────────────────────

export function FoundingMemberScreen({ userId, profile, onClaimed, onDismiss }: Props) {
  const [phase, setPhase] = useState<'offer' | 'onboarding'>('offer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClaim = async () => {
    haptic(18)
    setLoading(true)
    setError(null)
    try {
      await claimFoundingTrial(userId)
      onClaimed({ ...profile, trial_start_at: new Date().toISOString() })
      setPhase('onboarding')
    } catch (err: any) {
      setLoading(false)
      setError(err?.message ?? 'Something went wrong. Try again.')
    }
  }

  const content = (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: '#050505' }}>

      {/* ── Offer sheet — visible when phase is offer ── */}
      {phase === 'offer' && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 36 }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ flex: 1 }} />
          <div style={{ backgroundColor: '#0A0A0A', borderTop: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </div>
            <div className="flex flex-col items-center px-7 pt-5 pb-2 gap-6">
              {/* Logo + badge */}
              <div className="flex flex-col items-center gap-3">
                <img src="/tripalong-logo.png" alt="TripAlong"
                  style={{ width: 80, height: 80, objectFit: 'contain', mixBlendMode: 'screen' }} />
                <div className="px-3 py-1 rounded-full font-bold"
                  style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3', fontSize: 11, letterSpacing: '0.08em' }}>
                  FOUNDING MEMBER
                </div>
              </div>
              {/* Headline */}
              <div className="text-center">
                <h2 className="text-white font-bold mb-2" style={{ fontSize: 22, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                  {"You're one of TripAlong's first travelers"}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6 }}>
                  {"We're giving you "}
                  <span style={{ color: '#F0EBE3', fontWeight: 600 }}>7 days of Plus — free</span>
                  {". No card, no catch."}
                </p>
              </div>
              {/* Features */}
              <div className="w-full flex flex-col gap-2.5">
                {[
                  { icon: '∞', label: 'Unlimited swipes' },
                  { icon: '👁', label: 'See who viewed your profile' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ backgroundColor: 'rgba(240,235,227,0.05)', border: '0.5px solid rgba(240,235,227,0.1)' }}>
                    <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{f.icon}</span>
                    <span className="text-white font-semibold" style={{ fontSize: 14 }}>{f.label}</span>
                    <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#30D158' }}>
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              {/* CTA */}
              <div className="w-full flex flex-col gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}>
                {error && <p className="text-center" style={{ color: '#FF453A', fontSize: 12 }}>{error}</p>}
                <button type="button" onClick={handleClaim} disabled={loading}
                  className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}>
                  {loading ? 'Claiming…' : 'Claim free Plus →'}
                </button>
                <button type="button" onClick={onDismiss}
                  className="w-full py-2.5 active:opacity-60"
                  style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}>
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Onboarding — mounted instantly when phase switches ── */}
      {phase === 'onboarding' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <PlusOnboarding userId={userId} onDone={onDismiss} />
        </motion.div>
      )}

    </div>
  )

  return createPortal(content, document.body)
}
