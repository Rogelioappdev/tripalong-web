'use client'

// Pre-auth marketing splash — the very first thing a new visitor sees, before
// the 'auth' stage. Modeled on a competitor's onboarding splash (rotating world
// clock + typewriter headline) but fully reskinned in TripAlong's own dark
// brand: black background, cream (#F0EBE3) accent, the app's real font
// (Outfit, applied globally — no serif). Self-contained — the page only needs
// to render it and wire its CTA to goStage('auth', 1).

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  // This button's visibility is load-bearing in a way nothing else here is:
  // App Review rejected 1.5 (82) for "the continue button was not visible
  // when we launched the app". It is therefore deliberately the ONE element
  // on this screen that no animation library can hide.
  //
  // History: it first faded in via a declarative Framer `animate={...}` prop
  // and reproducibly got stuck at opacity:0 forever — `disabled` correctly
  // flipped to false (proving typingDone became true) while the inline
  // opacity Framer had set never caught up. That was replaced with an
  // imperative useAnimation().start(), which worked, but kept the same
  // shape of risk: a JS-driven animation is the only thing standing between
  // the user and a visible call to action.
  //
  // Now it's a plain CSS transition on a plain button, and then a backstop.
  // The transition is compositor-driven, so a busy main thread during launch
  // can't starve it, and there's no library state to desync from React's.
  //
  // But a transition is still an animation, and verification showed the
  // honest limit of that: in a throttled context the button reached
  // typingDone (it was interactive) while its opacity stayed 0, because the
  // transition never advanced. A real launch renders a visible WebView where
  // transitions do run — but "should run" is what the last two versions of
  // this button also had. So the last word belongs to no animation at all:
  // ctaSettled drops the transition and pins opacity to 1 as a static
  // computed style. If the fade already played this is invisible; if
  // anything swallowed it, the button simply is there.
  const [ctaSettled, setCtaSettled] = useState(false)

  // Rotate which 3 of the 5 cities are shown, every 4s.
  useEffect(() => {
    const id = setInterval(() => {
      setTickerStart(s => (s + 1) % CITIES.length)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  // Typewriter reveal of the headline, character by character — slower and
  // more deliberate than a typical typing effect, so the reveal itself
  // builds anticipation instead of just dumping the line on screen. The
  // "I'm in" button's own fade-in (above) is tuned to the same slower pace
  // so the whole sequence reads as one unhurried beat, not two mismatched
  // speeds stitched together.
  //
  // The interval is paced off wall-clock time rather than tick count, and a
  // deadline finishes the job outright. Both exist because iOS throttles
  // timers in a WebView during app launch — exactly when this screen is on
  // screen. A tick-counted interval that gets starved doesn't just run slow,
  // it may never reach the last character, which leaves typingDone false and
  // the button at opacity 0 indefinitely. That is the failure App Review
  // reported, and it is invisible in any test where the tab stays focused.
  useEffect(() => {
    const started = Date.now()
    const perChar = 75
    const total = HEADLINE.length * perChar

    const finish = () => {
      setCharCount(HEADLINE.length)
      setTypingDone(true)
    }

    const id = setInterval(() => {
      const elapsed = Date.now() - started
      if (elapsed >= total) {
        clearInterval(id)
        finish()
      } else {
        setCharCount(Math.floor(elapsed / perChar))
      }
    }, perChar)

    // Hard deadline. Whatever happened to the interval, the CTA is live.
    const deadline = setTimeout(finish, total + 1500)
    // Backstop, comfortably after the fade would have finished on its own.
    const settle = setTimeout(() => setCtaSettled(true), total + 1500 + 1200)

    return () => { clearInterval(id); clearTimeout(deadline); clearTimeout(settle) }
  }, [])

  const visibleCities = [0, 1, 2].map(offset => CITIES[(tickerStart + offset) % CITIES.length])

  return (
    <div className="flex-1 flex flex-col">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-white font-extrabold tracking-tight text-3xl sm:text-4xl text-center mt-2 shrink-0"
      >
        TripAlong
      </motion.h1>

      <div className="h-5 mt-4 mb-5 sm:mb-8 flex items-center justify-center shrink-0">
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

      <div className="text-center px-1 shrink-0">
        <h2 className="text-white font-extrabold text-2xl sm:text-3xl leading-tight min-h-[64px] sm:min-h-[76px]">
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
      <div className="w-full flex-1 flex items-center justify-center mt-4 sm:mt-6 mb-2 min-h-0 overflow-hidden">
        <TripPreviewCard />
      </div>

      {/* Always mounted (not conditionally rendered) so its ~52px of height is
          reserved in the flex column from the very first paint — it used to
          only mount once typingDone flipped true, which meant the trip-card
          area above it (also flex-1) suddenly lost that height the instant
          the button appeared, visibly shifting/shrinking everything else up.
          Animating opacity instead of mount/unmount keeps the layout stable
          throughout, and `disabled` blocks taps until typing finishes. */}
      <button
        onClick={() => { haptic(8); onContinue() }}
        disabled={!typingDone}
        className="mt-auto shrink-0 w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98]"
        style={{
          ...CTA_STYLE,
          opacity: ctaSettled || typingDone ? 1 : 0,
          transition: ctaSettled ? 'none' : 'opacity 0.9s ease-in-out, transform 0.15s',
        }}
      >
        I&apos;m in →
      </button>
    </div>
  )
}
