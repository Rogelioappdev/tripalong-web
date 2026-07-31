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
  vibes: string[]
  cover_image: string
  going: string
  decision: 'join' | 'pass'
}

function fmtDates(start: string | null, end: string | null, flex: boolean) {
  if (flex || (!start && !end)) return 'Flexible dates'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = start ? new Date(start).toLocaleDateString('en-US', opts) : ''
  if (!end) return s
  return `${s} – ${new Date(end).toLocaleDateString('en-US', opts)}`
}

// A small, public, RLS-safe fetch (no session-dependent joins) — same shape
// and query as LandingPhone.tsx's DemoFeed, reused here for the same reason:
// it works pre-signup, so a brand-new user gets a real preview of the actual
// feed (real trips, real photos) before they've created an account.
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
    vibes: (t.vibes ?? []).slice(0, 2),
    cover_image: t.cover_image,
    going: `${t.members?.[0]?.count ?? 0} going`,
    decision: i % 3 === 1 ? 'pass' : 'join',
  }))
}

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 26 }

// Variants read `custom` (the scripted decision's direction) so the same card
// can lean toward, then fly out on, whichever side matches its decision.
const cardVariants: Variants = {
  enter: { scale: 0.92, y: 16, opacity: 0.35 },
  center: { x: 0, rotate: 0, scale: 1, y: 0, opacity: 1, transition: SPRING },
  lean: (dir: number) => ({ x: dir * 22, rotate: dir * 3.5, scale: 1, y: 0, opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } }),
  exit: (dir: number) => ({ x: dir * 340, rotate: dir * 16, opacity: 0, transition: { duration: 0.42, ease: 'easeOut' } }),
}

function DemoCardFace({ trip, decided }: { trip: DemoTrip; decided: boolean }) {
  const isJoin = trip.decision === 'join'
  return (
    <div className="absolute inset-0 select-none bg-[#111]">
      <img src={trip.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />

      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 32%, rgba(0,0,0,0.68) 62%, rgba(0,0,0,0.95) 100%)',
      }} />

      {/* Decision tint — cream for join, red for pass */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ backgroundColor: isJoin ? '#F0EBE3' : '#FF453A', opacity: decided ? 0.16 : 0 }}
      />

      {/* Stamp */}
      <div
        className="absolute top-4 z-20 rounded-lg px-3 py-1 transition-opacity duration-200"
        style={{
          opacity: decided ? 1 : 0,
          left: isJoin ? 'auto' : 14,
          right: isJoin ? 14 : 'auto',
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

// A self-driving recreation of the real swipe feed, using real trips already
// in the database (public, RLS-safe fetch — same query LandingPhone.tsx's
// DemoFeed uses to preview real trips to logged-out visitors). The loop
// advances on a timer, no drag/input required, so a brand-new user sees
// exactly how the real feed works before they even sign up.
export function TripPreviewCard() {
  const [trips, setTrips] = useState<DemoTrip[] | null>(null)
  const [index, setIndex] = useState(0)
  const [decided, setDecided] = useState(false)

  // Guarded with `cancelled` so a resolved fetch never calls setState after
  // this step has been unmounted (e.g. the user swiped back to 'welcome' or
  // continued on to 'quiz' before the request finished).
  useEffect(() => {
    let cancelled = false
    fetchDemoTrips().then(t => { if (!cancelled) setTrips(t) })
    return () => { cancelled = true }
  }, [])

  const trip = trips && trips.length > 0 ? trips[index % trips.length] : null
  const nextTrip = trips && trips.length > 0 ? trips[(index + 1) % trips.length] : null
  const dir = trip?.decision === 'join' ? 1 : -1
  const isJoin = trip?.decision === 'join'

  // Decide at 1300ms, advance at 2150ms — mirrors LandingPhone.tsx's DemoFeed
  // timing exactly. Both timers are cleared on every re-run and on unmount,
  // which matters here (unlike the landing page) since this step really can
  // unmount mid-cycle as the user moves through onboarding.
  useEffect(() => {
    if (!trip) return
    setDecided(false)
    const tDecide = setTimeout(() => setDecided(true), 1300)
    const tAdvance = setTimeout(() => setIndex(i => i + 1), 2150)
    return () => { clearTimeout(tDecide); clearTimeout(tAdvance) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, !!trip])

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="relative w-full max-w-[280px] aspect-[3/4.1] rounded-[26px] overflow-hidden"
        style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}
      >
        {!trip || !nextTrip ? (
          <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: '#161616' }} />
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

      <div className="flex items-center justify-center gap-7">
        {[
          { label: 'Pass', color: '#FF453A', path: 'M18 6L6 18M6 6l12 12', active: decided && !isJoin, glow: false },
          { label: 'Join', color: '#30D158', path: 'M20 6L9 17l-5-5', active: decided && !!isJoin, glow: true },
          { label: 'Save', color: 'rgba(255,255,255,0.55)', path: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', active: false, glow: false },
        ].map(btn => (
          <div key={btn.label} className="flex flex-col items-center gap-1">
            <motion.div
              className="w-10 h-10 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center"
              animate={{
                scale: btn.active ? 1.12 : 1,
                boxShadow: btn.active && btn.glow ? '0 0 14px rgba(48,209,88,0.55)' : '0 0 0px rgba(0,0,0,0)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d={btn.path} stroke={btn.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <span className="text-white/30 text-[9px] font-semibold">{btn.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
