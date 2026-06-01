'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useAnimation } from 'framer-motion'
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

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, rgba(0,0,0,0.68) 58%, rgba(0,0,0,0.97) 100%)'

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏕️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
  chill: '😊', nature: '🌿', beach: '🏖️', spiritual: '🙏', 'road trip': '🚗',
}

function fmtDates(start: string | null, end: string | null, flex: boolean) {
  if (flex) return 'Flexible dates'
  if (!start) return 'Dates TBD'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = new Date(start).toLocaleDateString('en-US', opts)
  if (!end) return s
  const e = new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${s} – ${e}`
}

function CardFace({ trip, stamp }: { trip: SplashTrip; stamp: 'save' | 'pass' | null }) {
  const dates = fmtDates(trip.start_date, trip.end_date, trip.is_flexible_dates)
  const vibes = (trip.vibes ?? []).slice(0, 2)
  const spots = trip.max_group_size - trip.member_count

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#111', borderRadius: 22, overflow: 'hidden', userSelect: 'none' }}>
      {/* Photo */}
      {trip.cover_image && (
        <img src={trip.cover_image} alt={trip.destination} draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}

      {/* Gradient */}
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* SAVE stamp */}
      <motion.div
        animate={{ opacity: stamp === 'save' ? 1 : 0, scale: stamp === 'save' ? 1 : 0.85 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'absolute', top: 28, right: 20, zIndex: 20,
          border: '2.5px solid #F0EBE3', borderRadius: 12,
          padding: '5px 14px', transform: 'rotate(15deg)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#F0EBE3', fontWeight: 900, fontSize: 20, letterSpacing: '1.5px' }}>SAVE</span>
      </motion.div>

      {/* PASS stamp */}
      <motion.div
        animate={{ opacity: stamp === 'pass' ? 1 : 0, scale: stamp === 'pass' ? 1 : 0.85 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'absolute', top: 28, left: 20, zIndex: 20,
          border: '2.5px solid #FF453A', borderRadius: 12,
          padding: '5px 14px', transform: 'rotate(-15deg)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: '#FF453A', fontWeight: 900, fontSize: 20, letterSpacing: '1.5px' }}>PASS</span>
      </motion.div>

      {/* Bottom info — matches real CardContent */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 18px 18px', zIndex: 10 }}>

        {/* Country */}
        {trip.country && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.65)" />
            </svg>
            <span style={{ color: 'rgba(240,235,227,0.65)', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.3px' }}>
              {trip.country.toLowerCase()}
            </span>
          </div>
        )}

        {/* Destination */}
        <h2 style={{
          color: '#fff', fontWeight: 800, margin: '0 0 8px',
          fontSize: 'clamp(24px, 7vw, 36px)',
          lineHeight: 1, letterSpacing: '-0.8px',
        }}>
          {trip.destination}
        </h2>

        {/* Dates · Budget row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.42)" strokeWidth="1.8"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.42)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{dates}</span>
          </div>
          {trip.budget_level && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                    stroke="rgba(255,255,255,0.42)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'capitalize' }}>
                  {trip.budget_level}
                </span>
              </div>
            </>
          )}
          {spots > 0 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>·</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{spots} spot{spots !== 1 ? 's' : ''} left</span>
            </>
          )}
        </div>

        {/* Vibe tags */}
        {vibes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {vibes.map(v => (
              <span key={v} style={{
                fontSize: 11.5, borderRadius: 20, padding: '4px 10px',
                fontWeight: 600, textTransform: 'capitalize',
                backgroundColor: 'rgba(240,235,227,0.08)',
                border: '0.5px solid rgba(240,235,227,0.22)',
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
  const [isAnimating, setIsAnimating] = useState(false)
  const [stamp, setStamp] = useState<'save' | 'pass' | null>(null)
  const swipeCount = useRef(0)

  // Two-slot swap system
  const [slotA, setSlotA] = useState(0)
  const [slotB, setSlotB] = useState(1)
  const [frontIsA, setFrontIsA] = useState(true)
  const ctrlA = useAnimation()
  const ctrlB = useAnimation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/feed')
    })
  }, [router])

  useEffect(() => {
    supabase
      .from('trips')
      .select(`
        id, destination, country, cover_image,
        start_date, end_date, is_flexible_dates,
        budget_level, vibes, max_group_size,
        members:trip_members(count)
      `)
      .not('cover_image', 'is', null)
      .eq('status', 'planning')
      .limit(8)
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const trips = data.map((t: any) => ({
          ...t,
          member_count: t.members?.[0]?.count ?? 0,
        })) as SplashTrip[]
        setCards(trips)
      })
  }, [])

  useEffect(() => {
    if (cards.length < 2) return
    ctrlA.set({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 })
    ctrlB.set({ x: 0, y: 10, scale: 0.95, opacity: 1 })
  }, [cards.length, ctrlA, ctrlB])

  const triggerSwipe = useCallback(async () => {
    if (isAnimating || cards.length < 2) return
    setIsAnimating(true)

    const isRight = swipeCount.current % 2 === 0   // alternate right/left
    const dir = isRight ? 1 : -1
    swipeCount.current++

    setStamp(isRight ? 'save' : 'pass')

    const frontCtrl  = frontIsA ? ctrlA : ctrlB
    const behindCtrl = frontIsA ? ctrlB : ctrlA
    const currentBehind = frontIsA ? slotB : slotA
    const nextCard = (currentBehind + 1) % cards.length

    await Promise.all([
      // Two-phase drag → fly (feels like a real human swipe)
      frontCtrl.start({
        x: [0, dir * 80, dir * 720],
        rotate: [0, dir * 7, dir * 22],
        opacity: [1, 1, 0],
        transition: { duration: 0.42, times: [0, 0.28, 1], ease: 'easeIn' },
      }),
      // Behind card rises smoothly
      behindCtrl.start({
        scale: 1, y: 0,
        transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
      }),
    ])

    setStamp(null)

    // Reset old-front slot instantly, load next card
    frontCtrl.set({ x: 0, opacity: 1, rotate: 0, scale: 0.95, y: 10 })
    if (frontIsA) setSlotA(nextCard); else setSlotB(nextCard)
    setFrontIsA(f => !f)
    setIsAnimating(false)
  }, [isAnimating, cards.length, frontIsA, ctrlA, ctrlB, slotA, slotB])

  useEffect(() => {
    if (cards.length < 2) return
    const t = setInterval(triggerSwipe, 3000)
    return () => clearInterval(t)
  }, [triggerSwipe, cards.length])

  const frontCard  = cards[frontIsA ? slotA : slotB] ?? null
  const behindCard = cards[frontIsA ? slotB : slotA] ?? null

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

      {/* Card stack */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        style={{ flexShrink: 0, height: '54dvh', position: 'relative', paddingLeft: 18, paddingRight: 18 }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden' }}>

          {/* Behind card */}
          <motion.div
            animate={frontIsA ? ctrlB : ctrlA}
            style={{ position: 'absolute', inset: 0, zIndex: 0, transformOrigin: 'bottom center' }}
          >
            {behindCard
              ? <CardFace trip={behindCard} stamp={null} />
              : <div style={{ position: 'absolute', inset: 0, background: '#161616', borderRadius: 22 }} />}
          </motion.div>

          {/* Front card */}
          <motion.div
            animate={frontIsA ? ctrlA : ctrlB}
            style={{ position: 'absolute', inset: 0, zIndex: 10, transformOrigin: 'bottom center' }}
          >
            {frontCard
              ? <CardFace trip={frontCard} stamp={stamp} />
              : <div style={{ position: 'absolute', inset: 0, background: '#1e1e1e', borderRadius: 22 }} />}
          </motion.div>
        </div>

        {/* Fade into text area */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 52,
          background: 'linear-gradient(to bottom, transparent, #000)',
          zIndex: 30, pointerEvents: 'none',
        }} />
      </motion.div>

      {/* Copy + CTAs */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '16px 26px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {SOCIAL_AVATARS.map((src, i) => (
                <div key={i} style={{
                  width: 24, height: 24, borderRadius: 12,
                  border: '1.5px solid #000',
                  marginLeft: i > 0 ? -7 : 0,
                  flexShrink: 0, overflow: 'hidden',
                  backgroundColor: '#1a1a1a',
                }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12, margin: 0, lineHeight: 1.3 }}>
              Travelers already planning their next trip
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.48 }}
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
