'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { claimFoundingTrial } from '@/lib/trial'
import { registerPush } from '@/lib/push'
import { getProfileViewers, getTravelImages, getSampleProfiles, getProfile } from '@/lib/queries'
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

// ── Reveal avatar ─────────────────────────────────────────────────────────────

function RevealAvatar({
  profile,
  revealDelay,
  locked,
}: {
  profile: { id: string; name: string; profile_photo: string | null } | null
  revealDelay: number
  locked?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [glowing, setGlowing] = useState(false)

  useEffect(() => {
    if (locked) return
    const t1 = setTimeout(() => { setRevealed(true); setGlowing(true) }, revealDelay)
    const t2 = setTimeout(() => setGlowing(false), revealDelay + 700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [revealDelay, locked])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Reveal glow ring */}
      <AnimatePresence>
        {glowing && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0.9 }}
            animate={{ scale: 1.45, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: -4,
              borderRadius: '50%',
              border: '2px solid rgba(240,235,227,0.7)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22, delay: revealDelay / 1000 - 0.05 }}
        style={{
          width: 72, height: 72,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${revealed && !locked ? 'rgba(240,235,227,0.45)' : 'rgba(240,235,227,0.12)'}`,
          backgroundColor: '#1a1a1a',
          position: 'relative',
          transition: 'border-color 0.4s',
        }}
      >
        <motion.div
          className="w-full h-full"
          animate={{
            filter: revealed && !locked ? 'blur(0px) saturate(1) brightness(1)' : 'blur(14px) saturate(0) brightness(0.7)',
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ filter: 'blur(14px) saturate(0) brightness(0.7)' }}
        >
          {profile?.profile_photo ? (
            <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }} />
          )}
        </motion.div>

        {/* Lock overlay on the last (teaser) profile */}
        {locked && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.28)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8"/>
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </motion.div>
    </div>
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

  const handleCta = () => { haptic(12); onComplete() }

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
              pointerEvents: 'none',
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
              ✦ TRIPALONG TRAVELER ✦
            </span>
          </motion.div>

        </div>
      </div>

      {/* CTA button — fades in after animation settles */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          left: 24, right: 24,
          bottom: 'calc(env(safe-area-inset-bottom) + 28px)',
          zIndex: 2,
        }}
      >
        <button
          type="button"
          onClick={handleCta}
          className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
        >
          See what's included →
        </button>
      </motion.div>

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

function SlideWhoViewed({ profiles, viewerCount }: { profiles: { id: string; name: string; profile_photo: string | null }[]; viewerCount: number }) {
  const displayCount = viewerCount > 0 ? viewerCount : profiles.length > 0 ? profiles.length + 4 : 7
  const count = useCountUp(displayCount, true)

  // Reveal delays staggered — last profile stays locked as tease
  const revealDelays = [500, 950, 1400]

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8 text-center">

      {/* Avatar row */}
      <div className="flex gap-4 justify-center">
        {[0, 1, 2, 3].map(i => (
          <RevealAvatar
            key={i}
            profile={profiles[i] ?? null}
            revealDelay={revealDelays[i] ?? 0}
            locked={i === 3}
          />
        ))}
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-white font-extrabold" style={{ fontSize: 52, letterSpacing: '-2.5px', lineHeight: 1 }}>
            {count}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18 }}>travelers</span>
        </div>
        <h2 className="text-white font-extrabold mb-3" style={{ fontSize: 26, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
          already found you
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.65 }}>
          With Plus you see exactly who — so you can reach out first.
        </p>
      </motion.div>

    </div>
  )
}

// ── Feature slide: Compatibility ──────────────────────────────────────────────

function SlideCompatibility() {
  const cards = [
    { dest: 'Bali', color: '#30D158', pct: 92, label: 'Strong match' },
    { dest: 'Tokyo', color: '#FFD60A', pct: 68, label: 'Good match' },
    { dest: 'Lisbon', color: 'rgba(255,255,255,0.3)', pct: 34, label: 'Different styles' },
  ]

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8 text-center">

      {/* Match cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.dest}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.14, duration: 0.42, type: 'spring', stiffness: 220, damping: 22 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: `0.5px solid ${i === 0 ? 'rgba(48,209,88,0.25)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: i === 0 ? '0 0 20px rgba(48,209,88,0.08)' : undefined,
            }}
          >
            {/* Colored dot */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.22 + i * 0.14, type: 'spring', stiffness: 320, damping: 18 }}
              style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                backgroundColor: c.color,
                boxShadow: i === 0 ? `0 0 8px ${c.color}80` : undefined,
              }}
            />
            {/* Destination */}
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 700, flex: 1, textAlign: 'left' }}>
              {c.dest}
            </span>
            {/* Label */}
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>{c.label}</span>
            {/* Percentage */}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.14, duration: 0.3 }}
              style={{ color: c.color, fontSize: 16, fontWeight: 800, minWidth: 40, textAlign: 'right' }}
            >
              {c.pct}%
            </motion.span>
          </motion.div>
        ))}
      </div>

      <div>
        <motion.h2
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.45, ease: 'easeOut' }}
          className="text-white font-extrabold mb-3"
          style={{ fontSize: 30, letterSpacing: '-0.6px', lineHeight: 1.15 }}
        >
          Know before you join.
        </motion.h2>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.64, duration: 0.4, ease: 'easeOut' }}
          style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.65 }}
        >
          See how well you match every trip and each traveler going — before you commit.
        </motion.p>
      </div>
    </div>
  )
}

// ── Feature slide: Done ───────────────────────────────────────────────────────

function SlideDone({ onDone, loading }: { onDone: () => void; loading?: boolean }) {
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
          TripAlong Traveler — 7 days of Plus, free. Go find your next trip.
        </motion.p>
      </div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4, ease: 'easeOut' }}
        type="button"
        onClick={onDone}
        disabled={loading}
        className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000', opacity: loading ? 0.8 : 1 }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
            Loading your Plus…
          </>
        ) : 'Start exploring →'}
      </motion.button>
    </div>
  )
}

// ── Feature slides shell ──────────────────────────────────────────────────────

function PlusSlides({ userId, onDone }: { userId: string; onDone: (profile: UserProfile | null) => void }) {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [confirming, setConfirming] = useState(false)
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [sampleProfiles, setSampleProfiles] = useState<{ id: string; name: string; profile_photo: string | null }[]>([])
  const TOTAL = 4

  useEffect(() => {
    Promise.all([
      getProfileViewers(4),
      getSampleProfiles(4),
    ]).then(([v, s]) => { setViewers(v); setSampleProfiles(s) })
  }, [])

  const next = useCallback(() => {
    setIdx(i => {
      if (i >= TOTAL - 1) return i
      haptic(8)
      setDirection(1)
      return i + 1
    })
  }, [])

  const skip = () => { haptic(4); onDone(null) }

  const handleDone = async () => {
    if (confirming) return
    haptic(12)
    setConfirming(true)
    try { await registerPush(userId) } catch {}
    const confirmed = await getProfile(userId).catch(() => null)
    onDone(confirmed)
  }

  // Use real viewers if available, otherwise sample profiles for the reveal demo
  const whoViewedProfiles = viewers.length >= 3
    ? viewers.slice(0, 4)
    : sampleProfiles.slice(0, 4)

  const slides = [
    <SlideUnlimited key="unlimited" />,
    <SlideWhoViewed key="whoviewed" profiles={whoViewedProfiles} viewerCount={viewers.length} />,
    <SlideCompatibility key="compatibility" />,
    <SlideDone key="done" onDone={handleDone} loading={confirming} />,
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
    const claimed = { ...profile, trial_start_at: new Date().toISOString() }
    onClaimed(claimed) // optimistic update — UI feels instant
    setPhase('unlock')
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

  const handleUnlockComplete = useCallback(() => setPhase('slides'), [])

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

      {/* ── Unlock animation ── */}
      {phase === 'unlock' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: 'easeIn' }}
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
          <PlusSlides userId={userId} onDone={(confirmed) => {
            if (confirmed) onClaimed(confirmed)
            onDismiss()
          }} />
        </motion.div>
      )}

    </div>
  )

  return createPortal(content, document.body)
}
