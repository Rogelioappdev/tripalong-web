'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '800', '900'] })

interface SplashTrip {
  id: string
  destination: string
  country: string | null
  cover_image: string | null
  start_date: string | null
  end_date: string | null
  is_flexible_dates: boolean
  budget_level: string | null
  vibes: string[] | null
  max_group_size: number
  member_count: number
}

const SOCIAL_AVATARS = [
  'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/avatars/a50cfe93-fd2d-4676-b4da-8c970f696690/avatar.jpg',
  'https://staticfiles.net/XlP32QmlVxrNYg4ib9lZAe5LJGxfaFgVp0_tbJ3VKYw/p/oDi6PJlREVk.jpg',
  'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/avatars/422890b6-f24c-44a1-aa83-fc29611120ea/avatar.jpg',
  'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/profile-photos/avatar-0-1778603906132.jpg',
]

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 28%, rgba(0,0,0,0.65) 58%, rgba(0,0,0,0.97) 100%)'

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏕️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
  chill: '😊', nature: '🌿', beach: '🏖️', spiritual: '🙏', 'road trip': '🚗',
}

// 5-card stack: each slot has a distinct position so the stack is clearly visible
const STACK = [
  { scale: 1.00, y:  0, rotate:  0,    opacity: 1.00, z: 5 }, // front
  { scale: 0.93, y: 20, rotate:  3.0,  opacity: 0.82, z: 4 },
  { scale: 0.86, y: 37, rotate: -2.2,  opacity: 0.65, z: 3 },
  { scale: 0.79, y: 51, rotate:  2.8,  opacity: 0.48, z: 2 },
  { scale: 0.72, y: 63, rotate: -1.8,  opacity: 0.32, z: 1 },
]

function fmtDates(start: string | null, end: string | null, flex: boolean) {
  if (flex) return 'Flexible dates'
  if (!start) return 'Dates TBD'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = new Date(start).toLocaleDateString('en-US', opts)
  if (!end) return s
  return `${s} – ${new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function CardFace({ trip, stamp }: { trip: SplashTrip; stamp: 'save' | 'pass' | null }) {
  const vibes = (trip.vibes ?? []).slice(0, 2)
  const spots = trip.max_group_size - trip.member_count

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#111', borderRadius: 22, overflow: 'hidden',
    }}>
      {trip.cover_image && (
        <img src={trip.cover_image} alt={trip.destination} draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* SAVE */}
      <div style={{
        position: 'absolute', top: 26, right: 18, zIndex: 20,
        border: '2.5px solid #F0EBE3', borderRadius: 10,
        padding: '4px 12px', transform: 'rotate(15deg)',
        opacity: stamp === 'save' ? 1 : 0,
        transition: 'opacity 0.12s ease',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#F0EBE3', fontWeight: 900, fontSize: 18, letterSpacing: '1px' }}>SAVE</span>
      </div>

      {/* PASS */}
      <div style={{
        position: 'absolute', top: 26, left: 18, zIndex: 20,
        border: '2.5px solid #FF453A', borderRadius: 10,
        padding: '4px 12px', transform: 'rotate(-15deg)',
        opacity: stamp === 'pass' ? 1 : 0,
        transition: 'opacity 0.12s ease',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#FF453A', fontWeight: 900, fontSize: 18, letterSpacing: '1px' }}>PASS</span>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 18px 18px', zIndex: 10 }}>
        {trip.country && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.65)" />
            </svg>
            <span style={{ color: 'rgba(240,235,227,0.65)', fontSize: 11, fontWeight: 500 }}>
              {trip.country.toLowerCase()}
            </span>
          </div>
        )}

        <h2 style={{
          color: '#fff', fontWeight: 800, margin: '0 0 7px',
          fontSize: 'clamp(24px, 6.8vw, 34px)',
          lineHeight: 1, letterSpacing: '-0.8px',
        }}>
          {trip.destination}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12 }}>
            📅 {fmtDates(trip.start_date, trip.end_date, trip.is_flexible_dates)}
          </span>
          {trip.budget_level && (
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>·</span>
          )}
          {trip.budget_level && (
            <span style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12, textTransform: 'capitalize' }}>
              💰 {trip.budget_level}
            </span>
          )}
          {spots > 0 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>·</span>
              <span style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12 }}>{spots} spot{spots !== 1 ? 's' : ''} left</span>
            </>
          )}
        </div>

        {vibes.length > 0 && (
          <div style={{ display: 'flex', gap: 5 }}>
            {vibes.map(v => (
              <span key={v} style={{
                fontSize: 11, borderRadius: 20, padding: '3px 9px',
                fontWeight: 600, textTransform: 'capitalize',
                backgroundColor: 'rgba(240,235,227,0.08)',
                border: '0.5px solid rgba(240,235,227,0.2)',
                color: '#F0EBE3',
              }}>
                {VIBE_EMOJI[v] ?? ''} {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SplashPage() {
  const router = useRouter()
  const [cards, setCards] = useState<SplashTrip[]>([])
  const [topIndex, setTopIndex] = useState(0)
  const [exitingCard, setExitingCard] = useState<SplashTrip | null>(null)
  const [stamp, setStamp] = useState<'save' | 'pass' | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const swipeCount = useRef(0)
  const exitDir = useRef(1)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/feed')
    })
  }, [router])

  useEffect(() => {
    supabase
      .from('trips')
      .select(`id, destination, country, cover_image,
        start_date, end_date, is_flexible_dates,
        budget_level, vibes, max_group_size,
        members:trip_members(count)`)
      .not('cover_image', 'is', null)
      .limit(8)
      .then(({ data }) => {
        if (!data || data.length === 0) return
        setCards(data.map((t: any) => ({ ...t, member_count: t.members?.[0]?.count ?? 0 })))
      })
  }, [])

  const triggerSwipe = useCallback(() => {
    if (isAnimating || cards.length < 2) return
    setIsAnimating(true)

    const dir = swipeCount.current % 2 === 0 ? 1 : -1
    exitDir.current = dir
    swipeCount.current++

    const leaving = cards[topIndex % cards.length]
    setExitingCard(leaving)
    setStamp(dir > 0 ? 'save' : 'pass')
    setTopIndex(i => (i + 1) % cards.length)

    setTimeout(() => {
      setExitingCard(null)
      setStamp(null)
      setIsAnimating(false)
    }, 580)
  }, [isAnimating, cards, topIndex])

  useEffect(() => {
    if (cards.length < 2) return
    const t = setInterval(triggerSwipe, 3000)
    return () => clearInterval(t)
  }, [triggerSwipe, cards.length])

  return (
    <main style={{ background: '#000', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{
          flexShrink: 0,
          paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
          paddingLeft: 26, paddingBottom: 10,
        }}
      >
        <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>TripAlong</span>
      </motion.div>

      {/* ── Card stack ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        style={{
          flexShrink: 0,
          height: '53dvh',
          position: 'relative',
          paddingLeft: 22, paddingRight: 22,
          overflow: 'visible',   // allow rotated card corners to peek
        }}
      >
        {/* 5-card stack — rendered back to front */}
        {cards.length > 0 && Array.from({ length: 5 }, (_, slotIdx) => {
          const cardIdx = (topIndex + slotIdx) % cards.length
          const card = cards[cardIdx]
          const s = STACK[slotIdx]
          return (
            <motion.div
              key={card.id}
              initial={{ scale: s.scale, y: s.y, rotate: s.rotate, opacity: s.opacity }}
              animate={{ scale: s.scale, y: s.y, rotate: s.rotate, opacity: s.opacity }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute', inset: 0,
                zIndex: s.z,
                transformOrigin: 'bottom center',
              }}
            >
              <CardFace
                trip={card}
                stamp={slotIdx === 0 ? stamp : null}
              />
            </motion.div>
          )
        }).reverse() /* render back cards first so front is on top */}

        {/* Exiting card — swipes out above the stack */}
        {exitingCard && (
          <motion.div
            key={`exit-${exitingCard.id}`}
            initial={{ x: 0, rotate: 0, opacity: 1 }}
            animate={{ x: exitDir.current * 680, rotate: exitDir.current * 14, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: 'absolute', inset: 0,
              zIndex: 20,
              transformOrigin: 'bottom center',
            }}
          >
            <CardFace trip={exitingCard} stamp={stamp} />
          </motion.div>
        )}

        {/* Skeleton while loading */}
        {cards.length === 0 && Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            borderRadius: 22,
            background: `rgba(${22 + i * 4}, ${22 + i * 4}, ${22 + i * 4}, 1)`,
            transform: `scale(${STACK[i].scale}) translateY(${STACK[i].y}px) rotate(${STACK[i].rotate}deg)`,
            transformOrigin: 'bottom center',
            zIndex: STACK[i].z,
          }} />
        )).reverse()}

        {/* Gradient fade to black at bottom */}
        <div style={{
          position: 'absolute', bottom: -2, left: -22, right: -22, height: 60,
          background: 'linear-gradient(to bottom, transparent, #000)',
          zIndex: 30, pointerEvents: 'none',
        }} />
      </motion.div>

      {/* Copy + CTAs */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '15px 26px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 30px)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.35 }}
        >
          <h1 className={playfair.className} style={{
            fontSize: 'clamp(26px, 7.5vw, 38px)',
            fontWeight: 900, lineHeight: 1.14,
            letterSpacing: '-0.3px', color: '#fff', margin: 0,
          }}>
            Go alone if you have to.
            <br />
            <span style={{ color: '#F0EBE3' }}>But now, you don't.</span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {SOCIAL_AVATARS.map((src, i) => (
                <div key={i} style={{
                  width: 24, height: 24, borderRadius: 12,
                  border: '1.5px solid #000',
                  marginLeft: i > 0 ? -7 : 0,
                  overflow: 'hidden', backgroundColor: '#1a1a1a', flexShrink: 0,
                }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12, margin: 0 }}>
              Travelers already planning their next trip
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.46 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 9 }}
        >
          <button
            onClick={() => { haptic(8); router.push('/feed') }}
            style={{
              width: '100%', padding: '15px 0', borderRadius: 18,
              fontWeight: 700, fontSize: 15,
              backgroundColor: '#F0EBE3', color: '#000',
              border: 'none', cursor: 'pointer', letterSpacing: '-0.1px',
            }}
          >
            Find my people →
          </button>
          <button
            onClick={() => { haptic(6); router.push('/login') }}
            style={{
              width: '100%', padding: '10px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 500,
            }}
          >
            Already have an account? Sign in
          </button>
        </motion.div>
      </div>
    </main>
  )
}
