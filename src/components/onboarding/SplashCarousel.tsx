'use client'

// Pre-auth marketing splash — the very first thing a new visitor sees, before
// the 'auth' stage. Modeled on a competitor's onboarding splash (rotating world
// clock + typewriter headline + scattered activity bubbles) but fully reskinned
// in TripAlong's own dark brand: black background, cream (#F0EBE3) accent, the
// app's real font (Outfit, applied globally — no serif). Self-contained — the
// page only needs to render it and wire its CTA to goStage('auth', 1).

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { VIBES } from '@/lib/tripOptions'

const CTA_STYLE = { backgroundColor: '#F0EBE3', color: '#000' } as const

const HEADLINE = 'join trips and meet travelers wherever you go'

// A handful of timezones spread across the globe — real local times computed
// via Intl.DateTimeFormat (never faked). 3 of these 5 are shown at once, and
// which 3 rotates every few seconds.
const CITIES: { name: string; flag: string; tz: string }[] = [
  { name: 'Los Angeles', flag: '🇺🇸', tz: 'America/Los_Angeles' },
  { name: 'London', flag: '🇬🇧', tz: 'Europe/London' },
  { name: 'Tokyo', flag: '🇯🇵', tz: 'Asia/Tokyo' },
  { name: 'Sydney', flag: '🇦🇺', tz: 'Australia/Sydney' },
  { name: 'Cape Town', flag: '🇿🇦', tz: 'Africa/Johannesburg' },
]

function cityTime(tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date())
}

// 7 vibes pulled from the app's real single-source-of-truth VIBES list (see
// lib/tripOptions.ts) rather than inventing new emoji — keeps this splash's
// icons consistent with the rest of the app (trip creation, World filters).
const BUBBLE_VIBE_VALUES = ['adventure', 'foodie', 'beach', 'party', 'backpacking', 'cultural', 'chill'] as const

// Loose, organic scatter (not a grid) — percentage anchors within a relative
// container, staggered vertically so the cluster reads as hand-placed.
const BUBBLE_LAYOUT: { top: string; left: string; size: number }[] = [
  { top: '2%', left: '2%', size: 66 },
  { top: '26%', left: '32%', size: 56 },
  { top: '0%', left: '60%', size: 70 },
  { top: '36%', left: '84%', size: 54 },
  { top: '58%', left: '10%', size: 60 },
  { top: '48%', left: '46%', size: 76 },
  { top: '64%', left: '74%', size: 52 },
]

// Muted accent colors (the same gradient stops used on TripPreviewCard) for the
// little photo-badge placeholders — no external images are hotlinked, ever.
const BADGE_COLORS = ['#F0EBE3', '#A85A6B', '#4A3C6B', '#E0955B']
const BADGE_INITIALS = ['M', 'J', 'K', 'S', 'L', 'R', 'A']

export function SplashCarousel({ onContinue }: { onContinue: () => void }) {
  const [tickerStart, setTickerStart] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [typingDone, setTypingDone] = useState(false)

  // Rotate which 3 of the 5 cities are shown, every 4s.
  useEffect(() => {
    const id = setInterval(() => {
      setTickerStart(s => (s + 1) % CITIES.length)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  // Typewriter reveal of the headline, character by character.
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i += 1
      setCharCount(i)
      if (i >= HEADLINE.length) {
        clearInterval(id)
        setTypingDone(true)
      }
    }, 45)
    return () => clearInterval(id)
  }, [])

  const visibleCities = [0, 1, 2].map(offset => CITIES[(tickerStart + offset) % CITIES.length])

  return (
    <div className="flex-1 flex flex-col">
      <style>{`
        @keyframes sc-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-white font-extrabold tracking-tight text-4xl text-center mt-2"
      >
        TripAlong
      </motion.h1>

      <div className="h-5 mt-5 mb-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={tickerStart}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex items-center justify-center"
          >
            {visibleCities.map((c, i) => (
              <span
                key={c.name}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 ${i > 0 ? 'border-l border-white/15' : ''}`}
              >
                <span>{c.flag}</span>
                <span className="text-white/50">{c.name}</span>
                <span className="text-white/30">{cityTime(c.tz)}</span>
              </span>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="text-center px-1">
        <h2 className="text-white font-extrabold text-3xl leading-tight min-h-[76px]">
          {HEADLINE.slice(0, charCount)}
          {!typingDone && (
            <span className="inline-block w-[3px] h-[0.85em] bg-white/50 ml-0.5 align-middle animate-pulse" />
          )}
        </h2>
      </div>

      <div className="relative w-full flex-1 mt-6 mb-2">
        {BUBBLE_LAYOUT.map((pos, i) => {
          const vibe = VIBES.find(v => v.value === BUBBLE_VIBE_VALUES[i])
          if (!vibe) return null
          const badgeColor = BADGE_COLORS[i % BADGE_COLORS.length]
          const badgeInitial = BADGE_INITIALS[i % BADGE_INITIALS.length]
          const badgeSize = Math.max(20, Math.round(pos.size * 0.34))
          return (
            <div
              key={vibe.value}
              className="absolute rounded-full flex items-center justify-center"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.size,
                height: pos.size,
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(3px)',
                animation: 'sc-float 3.6s ease-in-out infinite',
                animationDelay: `${i * 0.22}s`,
              }}
            >
              <span style={{ fontSize: Math.round(pos.size * 0.42) }}>{vibe.emoji}</span>
              <div
                className="absolute rounded-full flex items-center justify-center font-bold border-2 border-black"
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  right: -4,
                  bottom: -4,
                  backgroundColor: badgeColor,
                  color: badgeColor === '#F0EBE3' ? '#000' : '#fff',
                  fontSize: 10,
                }}
              >
                {badgeInitial}
              </div>
            </div>
          )
        })}
      </div>

      {/* Always mounted (not conditionally rendered) so its ~52px of height is
          reserved in the flex column from the very first paint — it used to
          only mount once typingDone flipped true, which meant the vibe-bubble
          area above it (also flex-1) suddenly lost that height the instant
          the button appeared, visibly shifting/shrinking everything else up.
          Animating opacity/y instead of mount/unmount keeps the layout stable
          throughout, and `disabled` blocks taps until typing finishes. */}
      <motion.button
        initial={false}
        animate={typingDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={() => { haptic(8); onContinue() }}
        disabled={!typingDone}
        className="mt-auto w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
        style={CTA_STYLE}
      >
        I&apos;m in →
      </motion.button>
    </div>
  )
}
