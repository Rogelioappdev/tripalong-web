'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'

type DemoTrip = {
  country: string
  destination: string
  dates: string
  budget: string
  desc: string
  vibes: string[]
  emoji: string
  gradient: string
  going: string
  initials: string[]
  decision: 'join' | 'pass'
}

const DEMO_TRIPS: DemoTrip[] = [
  {
    country: 'indonesia',
    destination: 'Bali',
    dates: 'Aug 14 – Aug 22',
    budget: 'mid budget',
    desc: 'Chasing waterfalls, beach days, and good food with a small crew.',
    vibes: ['adventure', 'foodie', 'relaxed'],
    emoji: '🌴',
    gradient: 'linear-gradient(155deg, #4A3C6B 0%, #A85A6B 38%, #E0955B 68%, #F2C879 100%)',
    going: 'Maya +4 going',
    initials: ['M', 'J', 'K'],
    decision: 'join',
  },
  {
    country: 'japan',
    destination: 'Kyoto',
    dates: 'Oct 3 – Oct 11',
    budget: 'mid budget',
    desc: 'Temples at sunrise, tiny ramen bars, and slow autumn wandering.',
    vibes: ['culture', 'foodie', 'chill'],
    emoji: '🏯',
    gradient: 'linear-gradient(155deg, #2B2A4A 0%, #6B4A7A 42%, #C46B8A 72%, #F0A5B8 100%)',
    going: 'Leo +2 going',
    initials: ['L', 'A', 'S'],
    decision: 'pass',
  },
  {
    country: 'portugal',
    destination: 'Lisbon',
    dates: 'Sep 6 – Sep 13',
    budget: 'budget',
    desc: 'Surf mornings, rooftop sunsets, and pastéis de nata on repeat.',
    vibes: ['surf', 'nightlife', 'social'],
    emoji: '🌊',
    gradient: 'linear-gradient(155deg, #123A4A 0%, #2A7A8A 42%, #E0955B 78%, #F2C879 100%)',
    going: 'Nina +5 going',
    initials: ['N', 'T', 'R'],
    decision: 'join',
  },
]

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
    <div className="relative w-full h-full rounded-[20px] overflow-hidden select-none">
      <div className="absolute inset-0" style={{ background: trip.gradient }} />
      <div
        className="absolute inset-0 opacity-40"
        style={{ background: 'radial-gradient(circle at 80% 15%, rgba(255,235,200,0.55), transparent 45%)' }}
      />
      <svg className="absolute bottom-0 left-0 right-0 w-full opacity-25" viewBox="0 0 300 100" fill="none">
        <path d="M0 60 Q 40 20 80 55 T 160 45 T 240 60 T 300 40 V100 H0 Z" fill="rgba(0,0,0,0.5)" />
      </svg>
      <span className="absolute bottom-[30%] right-[9%] text-4xl opacity-70">{trip.emoji}</span>

      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 32%, rgba(0,0,0,0.68) 62%, rgba(0,0,0,0.95) 100%)',
      }} />

      {/* Decision tint — cream for join (matches the real feed's join overlay), red for pass */}
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

        <p className="text-white/50 text-[11px] leading-snug mb-2.5 line-clamp-2">{trip.desc}</p>

        <div className="flex flex-wrap gap-1 mb-3">
          {trip.vibes.map(v => (
            <span key={v} className="text-[10px] rounded-full px-2.5 py-1 font-semibold capitalize"
              style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3' }}>
              {v}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {trip.initials.map((initial, i) => (
              <div key={initial} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-black"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 10 - i }}>
                {initial}
              </div>
            ))}
          </div>
          <span className="text-white/50 text-[11px]">{trip.going}</span>
        </div>
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

// A self-driving recreation of the real swipe feed. Everything — gradients,
// motifs, motion — is drawn in JSX/CSS so it loads instantly and can never
// flicker on a missing network asset (the failure mode a hotlinked hero image
// hit before). The loop advances on a timer, no drag/input required.
function DemoFeed() {
  const [index, setIndex] = useState(0)
  const [decided, setDecided] = useState(false)

  const trip = DEMO_TRIPS[index % DEMO_TRIPS.length]
  const nextTrip = DEMO_TRIPS[(index + 1) % DEMO_TRIPS.length]
  const dir = trip.decision === 'join' ? 1 : -1
  const isJoin = trip.decision === 'join'

  useEffect(() => {
    setDecided(false)
    const tDecide = setTimeout(() => setDecided(true), 1300)
    const tAdvance = setTimeout(() => setIndex(i => i + 1), 2150)
    return () => { clearTimeout(tDecide); clearTimeout(tAdvance) }
  }, [index])

  return (
    <div className="relative flex-1 min-h-0 px-3 pt-1.5">
      <div className="relative w-full h-full">
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
      </div>

      <div className="flex items-center justify-center gap-6 py-2.5">
        <ActionButton label="Pass" path="M18 6L6 18M6 6l12 12" color="#FF453A" active={decided && !isJoin} />
        <ActionButton label="Join" path="M20 6L9 17l-5-5" color="#30D158" active={decided && isJoin} glow />
        <ActionButton label="Save" path="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" color="rgba(255,255,255,0.55)" active={false} />
      </div>
    </div>
  )
}

export function LandingPhone() {
  return (
    <div
      className="relative shrink-0"
      style={{ width: 'clamp(228px, 70vw, 266px)', aspectRatio: '9 / 19.3' }}
    >
      {/* Side buttons drawn on the frame edge */}
      <div className="absolute left-[-2px] top-[24%] w-[3px] h-[30px] rounded-l-sm bg-[#1c1c1e]" />
      <div className="absolute left-[-2px] top-[33%] w-[3px] h-[52px] rounded-l-sm bg-[#1c1c1e]" />
      <div className="absolute left-[-2px] top-[45%] w-[3px] h-[52px] rounded-l-sm bg-[#1c1c1e]" />
      <div className="absolute right-[-2px] top-[36%] w-[3px] h-[68px] rounded-r-sm bg-[#1c1c1e]" />

      {/* Titanium bezel */}
      <div
        className="absolute inset-0 rounded-[46px]"
        style={{
          background: 'linear-gradient(145deg, #2a2a2c 0%, #050505 55%, #232325 100%)',
          padding: 9,
          boxShadow: '0 40px 80px -24px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Screen */}
        <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-black flex flex-col">
          {/* Dynamic Island */}
          <div className="absolute top-[9px] left-1/2 -translate-x-1/2 z-40 h-[26px] w-[33%] max-w-[92px] rounded-full bg-black flex items-center justify-end pr-2.5">
            <div className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: 'rgba(60,70,90,0.9)' }} />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-2.5 pb-1 shrink-0">
            <span className="text-white text-[11px] font-semibold tracking-tight">9:41</span>
            <div className="flex items-center gap-1">
              <svg width="15" height="10" viewBox="0 0 18 12" fill="none">
                <rect x="0.5" y="7" width="3" height="4" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="5" y="4.5" width="3" height="6.5" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="9.5" y="2" width="3" height="9" rx="1" fill="rgba(255,255,255,0.9)" />
                <rect x="14" y="0" width="3" height="11" rx="1" fill="rgba(255,255,255,0.45)" />
              </svg>
              <svg width="17" height="11" viewBox="0 0 24 16" fill="none">
                <rect x="1" y="2" width="19" height="12" rx="3.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
                <rect x="2.5" y="3.5" width="14" height="9" rx="2" fill="rgba(255,255,255,0.9)" />
                <rect x="21" y="5.5" width="1.6" height="5" rx="0.8" fill="rgba(255,255,255,0.5)" />
              </svg>
            </div>
          </div>

          {/* App header */}
          <div className="flex items-center justify-center pt-1.5 pb-2 shrink-0">
            <span className="text-[#F0EBE3] text-[13px] font-extrabold tracking-tight">TripAlong</span>
          </div>

          <DemoFeed />

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-0.5 shrink-0">
            <div className="w-[34%] h-[4px] rounded-full bg-white/50" />
          </div>
        </div>
      </div>
    </div>
  )
}
