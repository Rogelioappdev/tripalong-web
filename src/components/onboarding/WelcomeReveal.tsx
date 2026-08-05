'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

// Post-sign-in welcome reveal — the first thing a brand-new user sees after
// authenticating, replacing what used to be a bare spinner. Sequence:
//   intro     "Welcome to TripAlong" wordmark beat (covers image preload time)
//   emerge    real live trip cards scatter in and float
//   converge  cards fly together into one feed-like deck
//   cta       "One swipe away." + set-up-profile button → onDone()
// Everything shown is real data (same RLS-safe pre-auth trips query as
// LandingPhone's DemoFeed) — if fetch/preload can't produce enough images to
// look good, it silently skips itself via onDone() rather than showing a
// broken or half-empty animation.

type RevealTrip = { id: string; destination: string; cover_image: string }

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

const preloadImage = (src: string) =>
  new Promise<boolean>(resolve => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export function WelcomeReveal({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'emerge' | 'converge' | 'cta'>('intro')
  const [cards, setCards] = useState<RevealTrip[]>([])
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [skipVisible, setSkipVisible] = useState(false)
  const [canvas, setCanvas] = useState({ w: 0, h: 0 })
  const boxRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
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
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }

    later(() => setSkipVisible(true), 2000)
    const startedAt = performance.now()

    ;(async () => {
      // Same public, RLS-safe shape as LandingPhone's fetchDemoTrips — works
      // for a just-created account (and the member-code preview, which has
      // no account at all).
      const { data, count } = await supabase
        .from('trips')
        .select('id, destination, cover_image', { count: 'exact' })
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
        Promise.all(rows.map(async r => { if (await preloadImage(r.cover_image)) loaded.push(r) })),
        sleep(3000),
      ])
      if (cancelled) return

      // Hold the intro beat to at least ~1.7s so fast networks still get the
      // welcome moment instead of a subliminal flash.
      await sleep(Math.max(0, 1700 - (performance.now() - startedAt)))
      if (cancelled) return

      if (loaded.length < 3) { finish(); return }
      setCards(loaded.slice(0, SLOTS.length))

      if (reducedMotion) { setPhase('cta'); return }

      setPhase('emerge')
      haptic(6)
      later(() => { setPhase('converge'); haptic(12) }, 2400)
      later(() => setPhase('cta'), 3350)
    })()

    return () => { cancelled = true; timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Emerge coordinates in px, derived from measured canvas so the scatter
  // fills whatever phone (or desktop column) we actually got.
  const halfW = Math.max(0, canvas.w / 2 - CARD_W / 2 - 4)
  const halfH = Math.max(0, canvas.h / 2 - CARD_H / 2 - 6)

  const cardTarget = (i: number) => {
    const slot = SLOTS[i]
    if (phase === 'emerge') {
      return { x: slot.fx * halfW, y: slot.fy * halfH, rotate: slot.rot, scale: 1, opacity: 1 }
    }
    // converge / cta — the deck
    const pose = deckPose(i)
    return { x: pose.x, y: pose.y, rotate: pose.rot, scale: pose.scale, opacity: 1 }
  }

  const inDeck = phase === 'converge' || phase === 'cta'

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
            className="absolute inset-0 z-20 flex flex-col items-center justify-center"
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
          {phase === 'cta' && (
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
        {canvas.w > 0 && cards.map((trip, i) => (
          <motion.div
            key={trip.id}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              width: CARD_W,
              height: CARD_H,
              marginLeft: -CARD_W / 2,
              marginTop: -CARD_H / 2,
              zIndex: inDeck ? cards.length - i : i,
            }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0, rotate: 0 }}
            animate={cardTarget(i)}
            transition={{
              type: 'spring',
              stiffness: 220,
              damping: 26,
              // 0.35s base delay lets the intro overlay finish its 0.4s exit
              // before the first card pops — otherwise cards are born under
              // the still-fading wordmark.
              delay: phase === 'emerge' ? 0.35 + i * 0.09 : i * 0.02,
            }}
          >
            <div
              className="w-full h-full rounded-xl overflow-hidden relative bg-[#111] border border-white/10"
              style={{
                boxShadow: '0 10px 32px rgba(0,0,0,0.65)',
                animation: phase === 'emerge' ? 'wr-float 3.4s ease-in-out infinite' : 'none',
                animationDelay: `${-i * 0.55}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={trip.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }} />
              <p className="absolute bottom-1.5 inset-x-2 text-white text-[10px] font-bold leading-tight truncate">
                {trip.destination.split(',')[0]}
              </p>
            </div>
          </motion.div>
        ))}
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
        className="absolute top-0 right-0 z-30 px-2 py-1 text-white/35 text-xs font-semibold"
        style={{ pointerEvents: skipVisible && phase !== 'cta' ? 'auto' : 'none' }}
      >
        Skip
      </motion.button>
    </div>
  )
}
