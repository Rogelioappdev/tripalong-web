'use client'

import { useEffect, useState } from 'react'
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
// given device without ever overflowing. `container-type: inline-size` then
// makes the phone its own sizing basis: every internal measurement below is
// expressed in `cqw` (1% of the frame's own width), so bezel thickness, corner
// radii, the Dynamic Island, buttons and status bar all scale as one coherent
// object — a phone drawn at 350px tall and one at 650px tall look identically
// proportioned rather than the same fixed pixels stretched.
export function LandingPhone() {
  return (
    <div
      className="relative mx-auto"
      style={{
        height: '100%',
        maxWidth: '100%',
        aspectRatio: '9 / 19.3',
        containerType: 'inline-size',
      }}
    >
      {/* Physical side buttons — iPhone 15/16 Pro layout: action button + a
          two-piece volume rocker on the left edge, power on the right. Lengths
          and protrusion scale with the frame (cqw); vertical positions are a
          percentage of the frame's own height. Drawn before the bezel so the
          bezel paints over their inner portion, leaving only the edge proud. */}
      <div className="absolute" style={{ left: '-0.8cqw', top: '21.5%', width: '1.5cqw', height: '5.5cqw', borderRadius: '1cqw 0 0 1cqw', background: 'linear-gradient(90deg,#57575a,#161618)' }} />
      <div className="absolute" style={{ left: '-0.8cqw', top: '31%', width: '1.5cqw', height: '9cqw', borderRadius: '1cqw 0 0 1cqw', background: 'linear-gradient(90deg,#57575a,#161618)' }} />
      <div className="absolute" style={{ left: '-0.8cqw', top: '41.5%', width: '1.5cqw', height: '9cqw', borderRadius: '1cqw 0 0 1cqw', background: 'linear-gradient(90deg,#57575a,#161618)' }} />
      <div className="absolute" style={{ right: '-0.8cqw', top: '29%', width: '1.5cqw', height: '13cqw', borderRadius: '0 1cqw 1cqw 0', background: 'linear-gradient(270deg,#57575a,#161618)' }} />

      {/* Titanium frame — a symmetric multi-stop gradient catches light on both
          diagonal edges (not a single flat gradient), and layered inset shadows
          give a bright top rim, a dark bottom rim and a hairline inner chamfer,
          so the metal reads as a rounded machined edge rather than a fill. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: '15cqw',
          padding: '3.4cqw',
          background: 'linear-gradient(135deg,#5c5c60 0%,#2b2b2d 13%,#0b0b0c 50%,#2b2b2d 87%,#5c5c60 100%)',
          boxShadow:
            '0 6cqw 14cqw -4cqw rgba(0,0,0,0.75), inset 0 0.5cqw 0.6cqw -0.2cqw rgba(255,255,255,0.4), inset 0 -0.5cqw 0.7cqw -0.2cqw rgba(0,0,0,0.65), inset 0 0 0 0.3cqw rgba(255,255,255,0.06)',
        }}
      >
        {/* Screen — inner radius = frame radius minus padding, so corners stay
            concentric with the outer bezel at every size. */}
        <div className="relative w-full h-full overflow-hidden bg-black flex flex-col" style={{ borderRadius: '11.6cqw' }}>
          {/* Dynamic Island — a small centered pill (~30% of screen width), sized
              and positioned like the real thing rather than an oversized blob. */}
          <div
            className="absolute left-1/2 z-40 flex items-center justify-end"
            style={{ top: '1.6cqw', transform: 'translateX(-50%)', width: '30cqw', height: '8cqw', borderRadius: '4cqw', background: '#000', paddingRight: '2.4cqw' }}
          >
            <div style={{ width: '2cqw', height: '2cqw', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, rgba(70,90,120,0.9), rgba(10,12,18,0.95))' }} />
          </div>

          {/* Status bar — icon and text sizes are in cqw so they scale with the
              frame alongside everything else. */}
          <div className="flex items-center justify-between shrink-0 relative z-30" style={{ paddingLeft: '6.5cqw', paddingRight: '6.5cqw', paddingTop: '2.4cqw', paddingBottom: '1cqw' }}>
            <span className="text-white font-semibold tracking-tight" style={{ fontSize: '3.4cqw' }}>9:41</span>
            <div className="flex items-center" style={{ gap: '1.4cqw' }}>
              <svg style={{ width: '4.6cqw', height: 'auto' }} viewBox="0 0 18 12" fill="none">
                <rect x="0.5" y="7" width="3" height="4" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="5" y="4.5" width="3" height="6.5" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="9.5" y="2" width="3" height="9" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="14" y="0" width="3" height="11" rx="1" fill="rgba(255,255,255,0.45)" />
              </svg>
              <svg style={{ width: '5.2cqw', height: 'auto' }} viewBox="0 0 24 16" fill="none">
                <rect x="1" y="2" width="19" height="12" rx="3.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
                <rect x="2.5" y="3.5" width="14" height="9" rx="2" fill="rgba(255,255,255,0.9)" />
                <rect x="21" y="5.5" width="1.6" height="5" rx="0.8" fill="rgba(255,255,255,0.5)" />
              </svg>
            </div>
          </div>

          {/* App header — matches the real feed's mobile header exactly: left-aligned, font-extrabold */}
          <div className="flex items-center shrink-0" style={{ paddingLeft: '4.5cqw', paddingRight: '4.5cqw', paddingTop: '1.5cqw', paddingBottom: '2cqw' }}>
            <span className="text-white font-extrabold tracking-tight" style={{ fontSize: '4cqw' }}>TripAlong</span>
          </div>

          <DemoFeed />

          {/* Home indicator */}
          <div className="flex justify-center shrink-0" style={{ paddingBottom: '2.2cqw', paddingTop: '0.5cqw' }}>
            <div style={{ width: '34%', height: '1.2cqw', borderRadius: '1cqw', background: 'rgba(255,255,255,0.5)' }} />
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
