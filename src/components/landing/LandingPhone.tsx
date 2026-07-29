'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { supabase } from '@/lib/supabase'

type DemoTrip = {
  id: string
  country: string
  destination: string
  dates: string
  budget: string
  desc: string
  vibes: string[]
  cover_image: string
  going: string
  initials: string[]
  decision: 'join' | 'pass'
}

function fmtDates(start: string | null, end: string | null, flex: boolean) {
  if (flex || (!start && !end)) return 'Flexible dates'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = start ? new Date(start).toLocaleDateString('en-US', opts) : ''
  if (!end) return s
  return `${s} – ${new Date(end).toLocaleDateString('en-US', opts)}`
}

// A small, public, RLS-safe fetch (no session-dependent joins) — this is the
// same shape the pre-onboarding splash page used to preview real trips to
// logged-out visitors, reused here for the same reason: it works for anyone,
// signed in or not, and only needs fields that are safe to show pre-signup.
async function fetchDemoTrips(): Promise<DemoTrip[]> {
  const { data } = await supabase
    .from('trips')
    .select(`id, destination, country, cover_image, start_date, end_date, is_flexible_dates,
      budget_level, vibes, members:trip_members(count)`)
    .eq('status', 'planning')
    .not('cover_image', 'is', null)
    .order('created_at', { ascending: false })
    .limit(6)
  if (!data) return []
  return data.map((t: any, i: number) => ({
    id: t.id,
    country: (t.country ?? '').toLowerCase(),
    destination: t.destination,
    dates: fmtDates(t.start_date, t.end_date, t.is_flexible_dates),
    budget: t.budget_level ?? 'flexible budget',
    desc: '',
    vibes: (t.vibes ?? []).slice(0, 2),
    cover_image: t.cover_image,
    going: `${t.members?.[0]?.count ?? 0} going`,
    initials: [],
    decision: i % 3 === 1 ? 'pass' : 'join',
  }))
}

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 26 }

// Variants read `custom` (the swipe direction) so the same card can lean toward
// and then fly out on whichever side matches its scripted decision.
const cardVariants: Variants = {
  enter: { scale: 0.92, y: 16, opacity: 0.35 },
  center: { x: 0, rotate: 0, scale: 1, y: 0, opacity: 1, transition: SPRING },
  lean: (dir: number) => ({ x: dir * 26, rotate: dir * 4, scale: 1, y: 0, opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } }),
  exit: (dir: number) => ({ x: dir * 460, rotate: dir * 18, opacity: 0, transition: { duration: 0.42, ease: 'easeOut' } }),
}

function DemoCardFace({ trip, decided }: { trip: DemoTrip; decided: boolean }) {
  const isJoin = trip.decision === 'join'
  return (
    <div className="relative w-full h-full rounded-[20px] overflow-hidden select-none bg-[#111]">
      <img src={trip.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />

      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 30%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.95) 100%)',
      }} />

      {/* Decision tint — cream for join, red for pass */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ backgroundColor: isJoin ? '#F0EBE3' : '#FF453A', opacity: decided ? 0.16 : 0 }}
      />

      {/* Stamp */}
      <div
        className="absolute top-5 z-20 rounded-lg px-3 py-1 transition-opacity duration-200"
        style={{
          opacity: decided ? 1 : 0,
          left: isJoin ? 'auto' : 16,
          right: isJoin ? 16 : 'auto',
          transform: `rotate(${isJoin ? 12 : -12}deg)`,
          border: `2px solid ${isJoin ? '#F0EBE3' : '#FF453A'}`,
        }}
      >
        <span className="font-black text-sm tracking-widest" style={{ color: isJoin ? '#F0EBE3' : '#FF453A' }}>
          {isJoin ? 'JOIN' : 'PASS'}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
        <div className="flex items-center gap-1 mb-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.7)" />
          </svg>
          <span className="text-[#F0EBE3]/70 text-[10px] font-medium tracking-wide">{trip.country}</span>
        </div>

        <h3 className="text-white font-extrabold leading-none mb-1.5 tracking-tight text-[26px]">{trip.destination}</h3>

        <div className="flex items-center gap-1.5 mb-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="text-white/50 text-[11px]">{trip.dates}</span>
          <span className="text-white/25">·</span>
          <span className="text-white/50 text-[11px]">{trip.budget}</span>
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
  )
}

function ActionButton({ label, path, color, active, glow }: { label: string; path: string; color: string; active: boolean; glow?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className="w-9 h-9 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center"
        animate={{
          scale: active ? 1.12 : 1,
          boxShadow: active && glow ? '0 0 16px rgba(240,235,227,0.5)' : '0 0 0px rgba(0,0,0,0)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d={path} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
      <span className="text-white/30 text-[8px] font-semibold">{label}</span>
    </div>
  )
}

// A self-driving recreation of the real swipe feed, using real trips already
// in the database (public, RLS-safe fetch — same fields the old pre-onboarding
// splash page showed to logged-out visitors). The loop advances on a timer,
// no drag/input required.
function DemoFeed() {
  const [trips, setTrips] = useState<DemoTrip[] | null>(null)
  const [index, setIndex] = useState(0)
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    fetchDemoTrips().then(setTrips)
  }, [])

  const trip = trips && trips.length > 0 ? trips[index % trips.length] : null
  const nextTrip = trips && trips.length > 0 ? trips[(index + 1) % trips.length] : null
  const dir = trip?.decision === 'join' ? 1 : -1
  const isJoin = trip?.decision === 'join'

  useEffect(() => {
    if (!trip) return
    setDecided(false)
    const tDecide = setTimeout(() => setDecided(true), 1300)
    const tAdvance = setTimeout(() => setIndex(i => i + 1), 2150)
    return () => { clearTimeout(tDecide); clearTimeout(tAdvance) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, !!trip])

  return (
    <div className="relative flex-1 min-h-0 px-3 pt-1.5">
      <div className="relative w-full h-full">
        {!trip || !nextTrip ? (
          <div className="absolute inset-0 rounded-[20px] animate-pulse" style={{ backgroundColor: '#161616' }} />
        ) : (
          <>
            {/* Card behind — gives the deck depth; the entering top card rises over it */}
            <div className="absolute inset-0" style={{ transform: 'scale(0.92) translateY(16px)', opacity: 0.5 }}>
              <DemoCardFace trip={nextTrip} decided={false} />
            </div>

            <AnimatePresence custom={dir}>
              <motion.div
                key={index}
                custom={dir}
                variants={cardVariants}
                initial="enter"
                animate={decided ? 'lean' : 'center'}
                exit="exit"
                className="absolute inset-0"
              >
                <DemoCardFace trip={trip} decided={decided} />
              </motion.div>
            </AnimatePresence>

            {/* Joined confirmation — the payoff moment, flashes as a join lands */}
            <AnimatePresence>
              {decided && isJoin && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                  className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                >
                  <div className="flex items-center gap-1.5 rounded-full px-3.5 py-2"
                    style={{ backgroundColor: 'rgba(48,209,88,0.92)', boxShadow: '0 8px 24px -6px rgba(48,209,88,0.6)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-white text-xs font-bold">Joined the group</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 py-2.5">
        <ActionButton label="Pass" path="M18 6L6 18M6 6l12 12" color="#FF453A" active={decided && !isJoin} />
        <ActionButton label="Join" path="M20 6L9 17l-5-5" color="#30D158" active={decided && !!isJoin} glow />
        <ActionButton label="Save" path="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" color="rgba(255,255,255,0.55)" active={false} />
      </div>
    </div>
  )
}

// The frame fills 100% of its flex parent's available height with the aspect
// ratio locked, so by construction it is always as large as it can be on the
// given device without ever overflowing.
//
// Every internal measurement is a multiple of one unit — 1% of the frame's
// own rendered width — so bezel thickness, corner radii, the Dynamic Island,
// buttons and status bar all scale together as one coherent object instead of
// independently-tuned fixed pixels that would look boxy once enlarged. That
// unit used to be expressed via container query units (`cqw`), but those
// silently collapsed to 0 in the target WebView (older engine, no container-
// query support) — invisible in dev tools, invisible on device. Measuring the
// frame's real width in JS via ResizeObserver and exposing it as a plain CSS
// variable (`--u`, used through `calc(var(--u) * N)`) needs nothing newer
// than CSS custom properties, which every relevant engine has supported for
// close to a decade — the same scaling math, a far safer foundation.
function u(n: number) {
  return `calc(var(--u) * ${n})`
}

const RATIO = 9 / 19.3 // width / height

export function LandingPhone() {
  const frameRef = useRef<HTMLDivElement>(null)
  // Explicit pixel dimensions computed in JS rather than CSS `aspect-ratio` —
  // that property is itself a relatively modern addition, and combining it
  // with `height: 100%` on a flex-item (whose width would otherwise come
  // from the ratio) turned out to be exactly the kind of thing this specific
  // WebView engine doesn't resolve: the frame measured 0×0 and nothing in it
  // could ever become visible, no matter what unit the children used.
  // Measuring the parent's real height and doing the ratio math by hand
  // needs nothing from the engine beyond getBoundingClientRect, which every
  // WebView has always had.
  const [size, setSize] = useState({ w: 200, h: 200 / RATIO })

  useEffect(() => {
    const el = frameRef.current
    const parent = el?.parentElement
    if (!parent) return
    const measure = () => {
      const availH = parent.clientHeight
      const availW = parent.clientWidth
      let h = availH
      let w = h * RATIO
      if (w > availW) { w = availW; h = w / RATIO }
      setSize({ w, h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const unit = size.w / 100

  return (
    <div
      ref={frameRef}
      className="relative mx-auto"
      style={{
        width: `${size.w}px`,
        height: `${size.h}px`,
        ['--u' as string]: `${unit}px`,
      }}
    >
      {/* Physical side buttons — iPhone 15/16 Pro layout: action button + a
          two-piece volume rocker on the left edge, power on the right. Lengths
          and protrusion scale with the frame; vertical positions are a
          percentage of the frame's own height. Drawn before the bezel so the
          bezel paints over their inner portion, leaving only the edge proud. */}
      <div className="absolute" style={{ left: u(-0.8), top: '21.5%', width: u(1.5), height: u(5.5), borderRadius: `${u(1)} 0 0 ${u(1)}`, background: 'linear-gradient(90deg,#57575a,#161618)' }} />
      <div className="absolute" style={{ left: u(-0.8), top: '31%', width: u(1.5), height: u(9), borderRadius: `${u(1)} 0 0 ${u(1)}`, background: 'linear-gradient(90deg,#57575a,#161618)' }} />
      <div className="absolute" style={{ left: u(-0.8), top: '41.5%', width: u(1.5), height: u(9), borderRadius: `${u(1)} 0 0 ${u(1)}`, background: 'linear-gradient(90deg,#57575a,#161618)' }} />
      <div className="absolute" style={{ right: u(-0.8), top: '29%', width: u(1.5), height: u(13), borderRadius: `0 ${u(1)} ${u(1)} 0`, background: 'linear-gradient(270deg,#57575a,#161618)' }} />

      {/* Titanium frame — a symmetric multi-stop gradient catches light on both
          diagonal edges (not a single flat gradient), and layered inset shadows
          give a bright top rim, a dark bottom rim and a hairline inner chamfer,
          so the metal reads as a rounded machined edge rather than a fill. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: u(15),
          padding: u(3.4),
          background: 'linear-gradient(135deg,#5c5c60 0%,#2b2b2d 13%,#0b0b0c 50%,#2b2b2d 87%,#5c5c60 100%)',
          boxShadow:
            `0 ${u(6)} ${u(14)} ${u(-4)} rgba(0,0,0,0.75), inset 0 ${u(0.5)} ${u(0.6)} ${u(-0.2)} rgba(255,255,255,0.4), inset 0 ${u(-0.5)} ${u(0.7)} ${u(-0.2)} rgba(0,0,0,0.65), inset 0 0 0 ${u(0.3)} rgba(255,255,255,0.06)`,
        }}
      >
        {/* Screen — inner radius = frame radius minus padding, so corners stay
            concentric with the outer bezel at every size. */}
        <div className="relative w-full h-full overflow-hidden bg-black flex flex-col" style={{ borderRadius: u(11.6) }}>
          {/* Dynamic Island — a small centered pill (~30% of screen width), sized
              and positioned like the real thing rather than an oversized blob. */}
          <div
            className="absolute left-1/2 z-40 flex items-center justify-end"
            style={{ top: u(1.6), transform: 'translateX(-50%)', width: u(30), height: u(8), borderRadius: u(4), background: '#000', paddingRight: u(2.4) }}
          >
            <div style={{ width: u(2), height: u(2), borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, rgba(70,90,120,0.9), rgba(10,12,18,0.95))' }} />
          </div>

          {/* Status bar — icon and text sizes scale with the frame alongside everything else. */}
          <div className="flex items-center justify-between shrink-0 relative z-30" style={{ paddingLeft: u(6.5), paddingRight: u(6.5), paddingTop: u(2.4), paddingBottom: u(1) }}>
            <span className="text-white font-semibold tracking-tight" style={{ fontSize: u(3.4) }}>9:41</span>
            <div className="flex items-center" style={{ gap: u(1.4) }}>
              <svg style={{ width: u(4.6), height: 'auto' }} viewBox="0 0 18 12" fill="none">
                <rect x="0.5" y="7" width="3" height="4" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="5" y="4.5" width="3" height="6.5" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="9.5" y="2" width="3" height="9" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="14" y="0" width="3" height="11" rx="1" fill="rgba(255,255,255,0.45)" />
              </svg>
              <svg style={{ width: u(5.2), height: 'auto' }} viewBox="0 0 24 16" fill="none">
                <rect x="1" y="2" width="19" height="12" rx="3.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
                <rect x="2.5" y="3.5" width="14" height="9" rx="2" fill="rgba(255,255,255,0.9)" />
                <rect x="21" y="5.5" width="1.6" height="5" rx="0.8" fill="rgba(255,255,255,0.5)" />
              </svg>
            </div>
          </div>

          {/* App header — matches the real feed's mobile header exactly: left-aligned, font-extrabold */}
          <div className="flex items-center shrink-0" style={{ paddingLeft: u(4.5), paddingRight: u(4.5), paddingTop: u(1.5), paddingBottom: u(2) }}>
            <span className="text-white font-extrabold tracking-tight" style={{ fontSize: u(4) }}>TripAlong</span>
          </div>

          <DemoFeed />

          {/* Home indicator */}
          <div className="flex justify-center shrink-0" style={{ paddingBottom: u(2.2), paddingTop: u(0.5) }}>
            <div style={{ width: '34%', height: u(1.2), borderRadius: u(1), background: 'rgba(255,255,255,0.5)' }} />
          </div>

          {/* Glass sheen — a subtle diagonal reflection over the top-left so the
              display reads as glossy glass. Non-interactive; sits above the feed
              but below the status bar and Dynamic Island so those stay crisp. */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.035) 16%, transparent 38%)' }}
          />
        </div>
      </div>
    </div>
  )
}
