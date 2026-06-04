'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { claimFoundingTrial } from '@/lib/trial'
import { registerPush } from '@/lib/push'
import { getProfileViewers, getTravelImages } from '@/lib/queries'
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

// ── Progress bar ──────────────────────────────────────────────────────────────

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

// ── Blur-reveal avatar ────────────────────────────────────────────────────────

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

// ── Count-up hook ─────────────────────────────────────────────────────────────

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

// ── Unlock Animation — cinematic travel feeling ───────────────────────────────

function UnlockAnimation({ onComplete, images }: { onComplete: () => void; images: string[] }) {
  const [bgIdx, setBgIdx] = useState(0)

  const photoParticles = useMemo(() => {
    if (!images.length) return []
    const count = Math.min(images.length, 10)
    return Array.from({ length: count }, (_, i) => {
      const base = (i / count) * Math.PI * 2
      const jitter = (Math.random() - 0.5) * 0.55
      return {
        angle: base + jitter,
        distance: 95 + Math.random() * 155,
        size: 44 + Math.random() * 18,
        delay: 0.04 + Math.random() * 0.28,
        img: images[i % images.length],
        duration: 1.0 + Math.random() * 0.55,
      }
    })
  }, [images])

  const dotParticles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => {
      const base = (i / 18) * Math.PI * 2
      const jitter = (Math.random() - 0.5) * 0.9
      return {
        angle: base + jitter,
        distance: 55 + Math.random() * 135,
        size: 2 + Math.random() * 3.5,
        delay: 0.02 + Math.random() * 0.34,
        gold: Math.random() > 0.6,
        duration: 0.8 + Math.random() * 0.5,
      }
    }), [])

  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setBgIdx(i => (i + 1) % images.length), 900)
    return () => clearInterval(t)
  }, [images.length])

  useEffect(() => {
    const t = setTimeout(() => { haptic(6); onComplete() }, 3000)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* Crossfading blurred travel photo background */}
      <AnimatePresence mode="sync">
        {images.length > 0 && (
          <motion.div
            key={bgIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75 }}
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${images[bgIdx]})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(22px) saturate(1.3)',
              transform: 'scale(1.08)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Dark overlay — photos bleed through as ambient warmth */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)' }} />

      {/* Warm centre tint */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,168,110,0.09) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Brief flash on entry */}
      <motion.div
        initial={{ opacity: 0.3 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(240,235,227,0.22)', pointerEvents: 'none' }}
      />

      {/* Everything centred */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Expanding warm glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            width: 720, height: 720,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(240,235,227,0.13) 0%, rgba(200,168,110,0.06) 38%, transparent 65%)',
            pointerEvents: 'none',
            flexShrink: 0,
          }}
        />

        {/* Shockwave rings */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={{ scale: 0.1, opacity: 0.75 - i * 0.14 }}
            animate={{ scale: 5.5, opacity: 0 }}
            transition={{ duration: 1.8 + i * 0.15, delay: i * 0.2, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 106, height: 106,
              borderRadius: '50%',
              border: `${1.2 - i * 0.25}px solid rgba(240,235,227,${0.55 - i * 0.13})`,
              pointerEvents: 'none',
              flexShrink: 0,
            }}
          />
        ))}

        {/* Photo thumbnail particles — burst from centre outward */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }}>
          {photoParticles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 0.92, scale: 0.5 }}
              animate={{
                x: Math.cos(p.angle) * p.distance,
                y: Math.sin(p.angle) * p.distance,
                opacity: 0,
                scale: 1.05,
              }}
              transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0, 0.7, 1] }}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1.5px solid rgba(255,255,255,0.28)',
                top: -(p.size / 2), left: -(p.size / 2),
              }}
            >
              <img src={p.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" draggable={false} />
            </motion.div>
          ))}
        </div>

        {/* Dot accent sparkles */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }}>
          {dotParticles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 0.7, scale: 1 }}
              animate={{
                x: Math.cos(p.angle) * p.distance,
                y: Math.sin(p.angle) * p.distance,
                opacity: 0, scale: 0,
              }}
              transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0, 0.85, 1] }}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: '50%',
                backgroundColor: p.gold ? '#E8C87A' : '#F0EBE3',
                top: -(p.size / 2), left: -(p.size / 2),
              }}
            />
          ))}
        </div>

        {/* Centre: icon + text + badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, position: 'relative', zIndex: 1 }}>

          {/* ✈️ icon with pulsing halo */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.22, 1], opacity: 1 }}
            transition={{ duration: 0.66, delay: 0.05, type: 'spring', stiffness: 258, damping: 17 }}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div
              animate={{ opacity: [0.25, 0.68, 0.25], scale: [1, 1.13, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: 170, height: 170,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(240,235,227,0.26) 0%, transparent 68%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{
              width: 92, height: 92,
              borderRadius: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(145deg, rgba(240,235,227,0.13) 0%, rgba(200,168,110,0.07) 100%)',
              border: '1px solid rgba(240,235,227,0.22)',
              fontSize: 48,
              position: 'relative', zIndex: 1,
            }}>
              ✈️
            </div>
          </motion.div>

          {/* "Welcome to TripAlong Plus" */}
          <motion.div
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.48, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center' }}
          >
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, fontWeight: 500, marginBottom: 8, letterSpacing: '0.01em' }}>
              Welcome to
            </p>
            <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 1, margin: 0 }}>
              <span style={{ color: '#ffffff' }}>TripAlong </span>
              <span style={{ color: '#F0EBE3' }}>Plus</span>
            </h1>
          </motion.div>

          {/* Founding Member badge */}
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.82 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.78, type: 'spring', stiffness: 320, damping: 22 }}
            style={{
              padding: '8px 24px',
              borderRadius: 999,
              backgroundColor: 'rgba(240,235,227,0.08)',
              border: '0.5px solid rgba(240,235,227,0.3)',
            }}
          >
            <span style={{ color: '#F0EBE3', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}>
              ✦ FOUNDING MEMBER ✦
            </span>
          </motion.div>

        </div>
      </div>
    </div>
  )
}

// ── Feature slide: Unlimited ──────────────────────────────────────────────────

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

// ── Feature slide: Who viewed ─────────────────────────────────────────────────

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
      <div className="flex gap-3 justify-center">
        {display.map((v, i) => (
          <BlurAvatar key={i} viewer={v} delay={i * 0.12} revealed={revealed} />
        ))}
      </div>

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

// ── Feature slide: Done ───────────────────────────────────────────────────────

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

// ── Feature slides shell ──────────────────────────────────────────────────────

function PlusSlides({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [viewers, setViewers] = useState<Viewer[]>([])
  const TOTAL = 3

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

  const skip = () => { haptic(4); onDone() }

  const handleDone = async () => {
    haptic(12)
    try { await registerPush(userId) } catch {}
    onDone()
  }

  const slides = [
    <SlideUnlimited key="unlimited" />,
    <SlideWhoViewed key="whoviewed" viewers={viewers} />,
    <SlideDone key="done" onDone={handleDone} />,
  ]

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0 }),
  }

  const showHint = idx < TOTAL - 1

  return (
    <motion.div
      className="flex flex-col"
      style={{ position: 'absolute', inset: 0 }}
      onPanEnd={(_, info) => { if (showHint && info.offset.x < -50) next() }}
    >
      <ProgressBar total={TOTAL} current={idx} />

      {showHint && (
        <div className="flex justify-end px-5 pt-3">
          <button type="button" onClick={skip}
            style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 600 }}>
            Skip
          </button>
        </div>
      )}

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
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
        >
          {slides[idx]}
        </motion.div>
      </AnimatePresence>

      {showHint && (
        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        >
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <motion.div
              animate={{ x: [0, -6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 500 }}>Swipe left to continue</span>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

// ── Offer + orchestration ─────────────────────────────────────────────────────

export function FoundingMemberScreen({ userId, profile, onClaimed, onDismiss }: Props) {
  const [phase, setPhase] = useState<'offer' | 'unlock' | 'slides'>('offer')
  const [travelImages, setTravelImages] = useState<string[]>([])

  useEffect(() => {
    getTravelImages(12).then(imgs => setTravelImages(imgs))
  }, [])

  const handleClaim = () => {
    haptic(18)
    onClaimed({ ...profile, trial_start_at: new Date().toISOString() })
    setPhase('unlock')
    claimFoundingTrial(userId).catch(() => {})
  }

  const handleUnlockComplete = useCallback(() => setPhase('slides'), [])

  const content = (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: '#050505' }}>

      {/* ── Offer sheet ── */}
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

              <div className="flex flex-col items-center gap-3">
                <img src="/tripalong-logo.png" alt="TripAlong"
                  style={{ width: 80, height: 80, objectFit: 'contain', mixBlendMode: 'screen' }} />
                <div className="px-3 py-1 rounded-full font-bold"
                  style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3', fontSize: 11, letterSpacing: '0.08em' }}>
                  FOUNDING MEMBER
                </div>
              </div>

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

              <div className="w-full flex flex-col gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}>
                <button type="button" onClick={handleClaim}
                  className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}>
                  Claim free Plus →
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

      {/* ── Unlock animation ── */}
      {phase === 'unlock' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <UnlockAnimation onComplete={handleUnlockComplete} images={travelImages} />
        </motion.div>
      )}

      {/* ── Feature slides ── */}
      {phase === 'slides' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.38 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <PlusSlides userId={userId} onDone={onDismiss} />
        </motion.div>
      )}

    </div>
  )

  return createPortal(content, document.body)
}
