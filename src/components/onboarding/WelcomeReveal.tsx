'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

// Post-sign-in welcome reveal — the first thing a brand-new user sees after
// authenticating, replacing what used to be a bare spinner. Sequence:
//   intro      "Welcome to TripAlong" wordmark beat (covers image preload)
//   emerge     real live trip cards scatter in and float
//   (spotlight) three cards take a sequential spotlight — scale up while the
//              rest dim — so the reveal is graspable, not a blur of images
//   converge   cards fly together into one mini deck
//   grow       "One swipe away." lands while the deck grows to the real
//              swipe-feed card size, faces filling in with live trip details
//   demo       the deck swipes itself: JOIN → PASS → SAVED, real feed stamps
//   cta        "Set up my profile" button fades in over the remaining deck
// Everything shown is real data (same RLS-safe pre-auth trips query as
// LandingPhone's DemoFeed) — if fetch/preload can't produce enough images to
// look good, it silently skips itself via onDone() rather than showing a
// broken or half-empty animation.

type RevealTrip = {
  id: string
  destination: string
  country: string
  cover_image: string
  dates: string
  budget: string
  vibes: string[]
  going: string
}

const CARD_W = 96
const CARD_H = 126

// Scatter slots as fractions of the canvas half-extent (so they scale with
// any phone width) — hand-placed for balance, not random, so cards never
// stack on top of each other or clip the caption above / CTA below.
const SLOTS = [
  { fx: -0.82, fy: -0.62, rot: -8 },
  { fx: 0.78, fy: -0.74, rot: 6 },
  { fx: -0.04, fy: -0.92, rot: -3 },
  { fx: 0.85, fy: 0.08, rot: 9 },
  { fx: -0.88, fy: 0.18, rot: -6 },
  { fx: 0.04, fy: 0.88, rot: 4 },
  { fx: 0.76, fy: 0.82, rot: -9 },
  { fx: -0.74, fy: 0.86, rot: 7 },
] as const

// Deck pose per stack position once the cards converge — top few fan out a
// touch like the feed's real card stack, the rest tuck in behind.
const deckPose = (i: number) => ({
  x: [0, -7, 8, -4, 5, -2, 3, 0][i] ?? 0,
  y: -6 + (i < 3 ? i * 2 : 4),
  rot: [-2, 5, -7, 3, -4, 6, -1, 2][i] ?? 0,
  scale: i < 3 ? 1 - i * 0.02 : 0.95,
})

// The three demo decisions, in swipe order. Colors/stamp treatment mirror
// the landing page's DemoCardFace exactly so this reads as the real feed.
const DECISIONS = ['join', 'pass', 'save'] as const
type Decision = (typeof DECISIONS)[number]

const decisionColor = (d: Decision) => (d === 'pass' ? '#FF453A' : '#F0EBE3')
const decisionLabel = (d: Decision) => (d === 'join' ? 'JOIN' : d === 'pass' ? 'PASS' : 'SAVED')

const fmtDates = (start: string | null, end: string | null, flex: boolean) => {
  if (flex || (!start && !end)) return 'Flexible dates'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = start ? new Date(start).toLocaleDateString('en-US', opts) : ''
  if (!end) return s
  return `${s} – ${new Date(end).toLocaleDateString('en-US', opts)}`
}

const preloadImage = (src: string) =>
  new Promise<boolean>(resolve => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function WelcomeReveal({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'emerge' | 'converge' | 'grow' | 'demo' | 'cta'>('intro')
  const [cards, setCards] = useState<RevealTrip[]>([])
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [spotlight, setSpotlight] = useState(-1)
  // Index of the card currently flying off in the demo (-1 = none yet).
  // Cards below it have already flown; keyframes end in the flown pose, so
  // no separate "gone" bookkeeping is needed.
  const [flying, setFlying] = useState(-1)
  const [skipVisible, setSkipVisible] = useState(false)
  const [canvas, setCanvas] = useState({ w: 0, h: 0 })
  const boxRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  const swipesRef = useRef(0)
  const reducedMotion = useReducedMotion()

  // Never fire onDone twice (skip tap racing the CTA, unmount timing, etc.)
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  // Tell the native shell we're painted so its splash fades into the intro
  // beat instead of sitting on its 4s fallback timer (same contract as
  // /feed's app_ready).
  useEffect(() => {
    const w = window as any
    if (!w.ReactNativeWebView) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'app_ready' }))
    }))
  }, [])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCanvas({ w: rect.width, h: rect.height })
  }, [])

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(() => { if (!cancelled) fn() }, ms)) }

    later(() => setSkipVisible(true), 2000)
    const startedAt = performance.now()

    ;(async () => {
      // Same public, RLS-safe shape as LandingPhone's fetchDemoTrips — works
      // for a just-created account (and the member-code preview, which has
      // no account at all).
      const { data, count } = await supabase
        .from('trips')
        .select('id, destination, country, cover_image, start_date, end_date, is_flexible_dates, budget_level, vibes, members:trip_members(count)', { count: 'exact' })
        .eq('status', 'planning')
        .not('cover_image', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8)
      if (cancelled) return
      if (count != null) setLiveCount(count)

      // Preload covers with a hard deadline — collect whatever finished in
      // time rather than waiting on the slowest image.
      const rows = data ?? []
      const loaded: RevealTrip[] = []
      await Promise.race([
        Promise.all(rows.map(async (t: any) => {
          if (await preloadImage(t.cover_image)) {
            loaded.push({
              id: t.id,
              destination: (t.destination ?? '').split(',')[0],
              country: (t.country ?? '').toLowerCase(),
              cover_image: t.cover_image,
              dates: fmtDates(t.start_date, t.end_date, t.is_flexible_dates),
              budget: t.budget_level ?? 'flexible budget',
              vibes: (t.vibes ?? []).slice(0, 2),
              going: `${t.members?.[0]?.count ?? 0} going`,
            })
          }
        })),
        sleep(3000),
      ])
      if (cancelled) return

      // Hold the intro beat to at least ~1.7s so fast networks still get the
      // welcome moment instead of a subliminal flash.
      await sleep(Math.max(0, 1700 - (performance.now() - startedAt)))
      if (cancelled) return

      if (loaded.length < 3) { finish(); return }
      const n = Math.min(loaded.length, SLOTS.length)
      setCards(loaded.slice(0, n))

      // Always leave at least one card behind for the CTA moment.
      const swipes = Math.min(DECISIONS.length, n - 1)
      swipesRef.current = swipes

      if (reducedMotion) { setPhase('cta'); setFlying(0); return }

      setPhase('emerge')
      haptic(6)

      // Sequential spotlights — each card gets a beat to be taken in before
      // the deck forms. Indices spread across the scatter for visual travel.
      const spotIdxs = n >= 6 ? [1, 3, 5] : [0, 1, 2].slice(0, n)
      let t = 1500
      for (const s of spotIdxs) {
        later(() => { setSpotlight(s); haptic(5) }, t)
        t += 900
      }
      later(() => { setSpotlight(-1); setPhase('converge'); haptic(12) }, t)
      t += 950
      later(() => { setPhase('grow'); haptic(6) }, t)
      t += 900
      for (let k = 0; k < swipes; k++) {
        later(() => { setPhase('demo'); setFlying(k); haptic(8) }, t)
        t += 1000
      }
      later(() => { setFlying(swipes); setPhase('cta') }, t)
    })()

    return () => { cancelled = true; timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Emerge coordinates in px, derived from measured canvas so the scatter
  // fills whatever phone (or desktop column) we actually got.
  const halfW = Math.max(0, canvas.w / 2 - CARD_W / 2 - 4)
  const halfH = Math.max(0, canvas.h / 2 - CARD_H / 2 - 6)

  // Grown card size — the real swipe-feed card footprint (3:4.1 like
  // TripPreviewCard), fit to whatever canvas we have.
  const bigW = Math.min(canvas.w - 28, 300, Math.max(1, (canvas.h - 12) * (3 / 4.1)))
  const bigH = bigW * (4.1 / 3)

  const grown = phase === 'grow' || phase === 'demo' || phase === 'cta'
  const cardW = grown ? bigW : CARD_W
  const cardH = grown ? bigH : CARD_H

  const flightFor = (d: Decision, baseRot: number) =>
    d === 'join'
      ? { x: [0, 26, 560], rotate: [baseRot, 6, 22], opacity: [1, 1, 0] }
      : d === 'pass'
        ? { x: [0, -26, -560], rotate: [baseRot, -6, -22], opacity: [1, 1, 0] }
        : { y: [0, -14, 470], scale: [1, 1.03, 0.55], rotate: [baseRot, -3, -8], opacity: [1, 1, 0] }

  const flownFor = (d: Decision) =>
    d === 'join'
      ? { x: 560, rotate: 22, opacity: 0 }
      : d === 'pass'
        ? { x: -560, rotate: -22, opacity: 0 }
        : { y: 470, scale: 0.55, opacity: 0 }

  const cardAnimate = (i: number): Record<string, unknown> => {
    const size = { width: cardW, height: cardH, marginLeft: -cardW / 2, marginTop: -cardH / 2 }
    if (phase === 'emerge') {
      const slot = SLOTS[i]
      const spot = spotlight === i
      return {
        ...size,
        x: slot.fx * halfW,
        y: slot.fy * halfH,
        rotate: spot ? 0 : slot.rot,
        scale: spot ? 1.34 : spotlight >= 0 ? 0.94 : 1,
        opacity: spotlight >= 0 && !spot ? 0.45 : 1,
      }
    }
    const pose = deckPose(i)
    if ((phase === 'demo' || phase === 'cta') && i < swipesRef.current) {
      if (i < flying) return { ...size, ...flownFor(DECISIONS[i]) }
      if (i === flying && phase === 'demo') return { ...size, ...flightFor(DECISIONS[i], pose.rot * 0.5) }
    }
    // Deck — tighter pose once grown so the big stack reads like the feed.
    const f = grown ? 0.55 : 1
    return {
      ...size,
      x: pose.x * f,
      y: pose.y * f,
      rotate: pose.rot * f,
      scale: grown ? (i < 3 ? 1 : 0.99) : pose.scale,
      opacity: 1,
    }
  }

  const cardTransition = (i: number): Record<string, unknown> => {
    if (phase === 'demo' && i === flying && i < swipesRef.current) {
      return { duration: 0.95, times: [0, 0.42, 1], ease: 'easeIn' }
    }
    return {
      type: 'spring',
      stiffness: 220,
      damping: 26,
      // 0.35s base delay lets the intro overlay finish its 0.4s exit before
      // the first card pops — otherwise cards are born under the still-
      // fading wordmark.
      delay: phase === 'emerge' ? 0.35 + i * 0.09 : i * 0.02,
    }
  }

  return (
    <div className="flex-1 flex flex-col relative min-h-0">
      {/* Same inner-element float pattern as SplashCarousel's sc-float —
          the CSS transform lives on a child of the Framer-animated node so
          the two never fight over one transform property. */}
      <style>{`
        @keyframes wr-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Intro beat — overlays everything, exits as the cards arrive */}
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="wr-intro"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center"
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.4, ease: 'easeInOut' } }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src="/tagalong-icon.png"
              alt=""
              className="w-14 h-14 object-contain mb-3"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            />
            <motion.p
              className="text-white/40 text-sm font-semibold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
            >
              Welcome to
            </motion.p>
            <motion.h1
              className="text-white font-extrabold text-4xl tracking-tight"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.55, ease: 'easeOut' }}
            >
              TripAlong
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caption — fixed-height block so swapping copy never shifts the
          canvas below (always-reserve-layout lesson from the splash screen) */}
      <div className="shrink-0 text-center" style={{ minHeight: 84 }}>
        <AnimatePresence mode="wait">
          {(phase === 'emerge' || phase === 'converge') && (
            <motion.div
              key="wr-live"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-1.5">Happening now</p>
              <h1 className="text-white font-extrabold text-2xl leading-tight">Real trips, live right now.</h1>
            </motion.div>
          )}
          {grown && (
            <motion.div
              key="wr-cta-head"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <h1 className="text-white font-extrabold text-3xl leading-tight mb-1.5">One swipe away.</h1>
              <p className="text-white/38 text-sm leading-relaxed">
                {liveCount != null && liveCount >= 10
                  ? `${liveCount} live trips waiting for you.`
                  : 'Real people, planning real trips.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card canvas */}
      <div ref={boxRef} className="relative flex-1 min-h-0">
        {canvas.w > 0 && cards.map((trip, i) => {
          const decision: Decision | null = i < swipesRef.current ? DECISIONS[i] : null
          const stampOn = phase === 'demo' && i === flying && decision != null
          return (
            <motion.div
              key={trip.id}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                zIndex: phase === 'emerge' ? (spotlight === i ? 25 : i) : cards.length - i,
              }}
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 0, rotate: 0, width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2 }}
              animate={cardAnimate(i)}
              transition={cardTransition(i)}
            >
              <div
                className={`w-full h-full overflow-hidden relative bg-[#111] border border-white/10 ${grown ? 'rounded-[20px]' : 'rounded-xl'}`}
                style={{
                  boxShadow: spotlight === i ? '0 14px 44px rgba(0,0,0,0.8)' : '0 10px 32px rgba(0,0,0,0.65)',
                  animation: phase === 'emerge' && spotlight !== i ? 'wr-float 3.4s ease-in-out infinite' : 'none',
                  animationDelay: `${-i * 0.55}s`,
                  transition: 'border-radius 0.4s ease',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={trip.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />

                {/* Mini face — destination tag only, fades out as the card grows */}
                <div className="absolute inset-0" style={{ opacity: grown ? 0 : 1, transition: 'opacity 0.35s ease' }}>
                  <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }} />
                  <p className="absolute bottom-1.5 inset-x-2 text-white text-[10px] font-bold leading-tight truncate">
                    {trip.destination}
                  </p>
                </div>

                {/* Full feed-card face — mirrors the landing DemoCardFace, only
                    rendered for cards that can become visible deck tops */}
                {i < 5 && (
                  <div className="absolute inset-0" style={{ opacity: grown ? 1 : 0, transition: 'opacity 0.45s ease 0.15s' }}>
                    <div className="absolute inset-0" style={{
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 30%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.95) 100%)',
                    }} />
                    {/* Decision tint */}
                    {decision && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundColor: decisionColor(decision),
                          opacity: stampOn ? 0.16 : 0,
                          transition: 'opacity 0.3s ease',
                        }}
                      />
                    )}
                    {/* Stamp — same treatment as the landing demo feed */}
                    {decision && (
                      <div
                        className="absolute top-5 z-20 rounded-lg px-3 py-1"
                        style={{
                          opacity: stampOn ? 1 : 0,
                          transition: 'opacity 0.2s ease 0.1s',
                          left: decision === 'pass' ? 16 : decision === 'save' ? '50%' : 'auto',
                          right: decision === 'join' ? 16 : 'auto',
                          transform: decision === 'join' ? 'rotate(12deg)' : decision === 'pass' ? 'rotate(-12deg)' : 'translateX(-50%) rotate(-6deg)',
                          border: `2px solid ${decisionColor(decision)}`,
                        }}
                      >
                        <span className="font-black text-sm tracking-widest" style={{ color: decisionColor(decision) }}>
                          {decisionLabel(decision)}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                      <div className="flex items-center gap-1 mb-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.7)" />
                        </svg>
                        <span className="text-[#F0EBE3]/70 text-[10px] font-medium tracking-wide">{trip.country}</span>
                      </div>
                      <h3 className="text-white font-extrabold leading-none mb-1.5 tracking-tight text-[24px]">{trip.destination}</h3>
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" />
                          <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <span className="text-white/50 text-[11px]">{trip.dates}</span>
                        <span className="text-white/25">·</span>
                        <span className="text-white/50 text-[11px] capitalize">{trip.budget}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {trip.vibes.map(v => (
                          <span key={v} className="text-[10px] rounded-full px-2.5 py-1 font-semibold capitalize"
                            style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3' }}>
                            {v}
                          </span>
                        ))}
                      </div>
                      <span className="text-white/50 text-[11px]">{trip.going}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* CTA — always mounted so its space is reserved from first paint and
          nothing above ever shifts when it appears */}
      <div className="shrink-0 pt-4">
        <motion.button
          onClick={() => { haptic(8); finish() }}
          disabled={phase !== 'cta'}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: phase === 'cta' ? 1 : 0, y: phase === 'cta' ? 0 : 14 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          Set up my profile →
        </motion.button>
      </div>

      {/* Quiet escape hatch, never in the way */}
      <motion.button
        onClick={finish}
        animate={{ opacity: skipVisible && phase !== 'cta' ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute top-0 right-0 z-40 px-2 py-1 text-white/35 text-xs font-semibold"
        style={{ pointerEvents: skipVisible && phase !== 'cta' ? 'auto' : 'none' }}
      >
        Skip
      </motion.button>
    </div>
  )
}
