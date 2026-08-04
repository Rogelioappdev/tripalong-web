'use client'

// Pre-auth marketing splash — the very first thing a new visitor sees, before
// the 'auth' stage. Modeled on a competitor's onboarding splash (rotating world
// clock + typewriter headline) but fully reskinned in TripAlong's own dark
// brand: black background, cream (#F0EBE3) accent, the app's real font
// (Outfit, applied globally — no serif). Self-contained — the page only needs
// to render it and wire its CTA to goStage('auth', 1).

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { TripPreviewCard } from '@/components/onboarding/TripPreviewCard'

const CTA_STYLE = { backgroundColor: '#F0EBE3', color: '#000' } as const

const HEADLINE = 'Never travel alone again'

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

export function SplashCarousel({ onContinue }: { onContinue: () => void }) {
  const [tickerStart, setTickerStart] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [typingDone, setTypingDone] = useState(false)
  // Verified via direct browser inspection (real getComputedStyle checks,
  // not a guess): the previous version drove this button's fade-in purely
  // through a declarative `animate={typingDone ? {...} : {...}}` prop, and
  // it reproducibly got stuck at its opacity:0/translateY(14px) state
  // forever — `disabled` correctly flipped to false (proving typingDone did
  // become true), but the inline opacity/transform Framer had set never
  // updated to match. Switched to the same imperative useAnimation()
  // pattern already proven to work elsewhere in this exact codebase
  // (finaleControls, passportImpactControls) — an explicit .start() call in
  // an effect, rather than relying on Framer re-diffing a new object
  // literal on every render.
  const buttonControls = useAnimation()

  useEffect(() => {
    if (typingDone) {
      buttonControls.start({ opacity: 1, transition: { duration: 0.6, ease: 'easeInOut' } })
    }
  }, [typingDone, buttonControls])

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
          {/* Always rendered (not conditionally), toggling opacity instead of
              removing it from the DOM — the real cause of the "everything
              shifts when the button appears" bug wasn't the button itself
              (already fixed to always be mounted below), it was this cursor:
              being an inline-block, unmounting it right when typingDone flips
              true could change the headline's own line-wrap and shrink its
              height by a line at that exact moment, shoving the bubble area
              and button up right as the button was fading in. Reserving its
              space the same way fixes both at once. */}
          <span
            className="inline-block w-[3px] h-[0.85em] bg-white/50 ml-0.5 align-middle animate-pulse"
            style={{ opacity: typingDone ? 0 : 1 }}
          />
        </h2>
      </div>

      {/* Real trips, real swipes — the same self-driving demo deck used on
          the 'valueprop' step right after auth (see TripPreviewCard), swapped
          in here for the old scattered vibe-emoji bubbles so a brand-new
          visitor sees the actual product, not an abstraction of it. */}
      <div className="w-full flex-1 flex items-center justify-center mt-6 mb-2 min-h-0 overflow-hidden">
        <TripPreviewCard />
      </div>

      {/* Always mounted (not conditionally rendered) so its ~52px of height is
          reserved in the flex column from the very first paint — it used to
          only mount once typingDone flipped true, which meant the trip-card
          area above it (also flex-1) suddenly lost that height the instant
          the button appeared, visibly shifting/shrinking everything else up.
          Animating opacity instead of mount/unmount keeps the layout stable
          throughout, and `disabled` blocks taps until typing finishes. */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={buttonControls}
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
