'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

// ── Pre-launch gate ────────────────────────────────────────────────────────────
const LAUNCH = new Date('2026-07-01T00:00:00')
const ACCESS_KEY = 'tripalong_early_access'

function pad(n: number) { return String(n).padStart(2, '0') }

function useCountdown() {
  const calc = () => {
    const diff = Math.max(0, LAUNCH.getTime() - Date.now())
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }
  const [t, setT] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 14,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: 15, outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function TesterModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', age: '', email: '', reason: '' })
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name || !form.age || !form.email || !form.reason) return
    setState('submitting')
    const res = await fetch('/api/tester-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setState('error'); return }
    setState('success')
  }

  if (state === 'success') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div style={{
          background: '#111', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 28, padding: '40px 28px', textAlign: 'center', maxWidth: 340, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✈️</div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.3px' }}>
            Request sent!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
            We'll email you to get you set up as an early tester. Keep an eye on your inbox — we'll be in touch soon!
          </p>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 16,
              background: '#F0EBE3', color: '#000',
              fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#111', border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)',
        width: '100%', maxWidth: 480,
        boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 22px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
            Become a tester
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 22, lineHeight: 1, padding: '4px 8px' }}>×</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '0 0 22px', lineHeight: 1.5 }}>
          Get early access before launch. We'll personally reach out.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Your name"
            value={form.name}
            onChange={set('name')}
            style={INPUT_STYLE}
          />
          <input
            placeholder="Your age"
            type="number"
            inputMode="numeric"
            value={form.age}
            onChange={set('age')}
            style={INPUT_STYLE}
          />
          <input
            placeholder="Your email address"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={set('email')}
            style={INPUT_STYLE}
          />
          <textarea
            placeholder="Why do you want to test TripAlong?"
            value={form.reason}
            onChange={set('reason')}
            rows={3}
            style={{ ...INPUT_STYLE, resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        {state === 'error' && (
          <p style={{ color: 'rgba(255,80,80,0.8)', fontSize: 13, marginTop: 10 }}>
            Something went wrong — try again.
          </p>
        )}

        <button
          onClick={submit}
          disabled={state === 'submitting' || !form.name || !form.age || !form.email || !form.reason}
          style={{
            marginTop: 16, width: '100%', padding: '15px 0', borderRadius: 16,
            background: '#F0EBE3', color: '#000',
            fontWeight: 700, fontSize: 15, border: 'none',
            cursor: state === 'submitting' || !form.name || !form.age || !form.email || !form.reason ? 'default' : 'pointer',
            opacity: !form.name || !form.age || !form.email || !form.reason ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {state === 'submitting' ? 'Sending…' : 'Send request →'}
        </button>
      </div>
    </div>
  )
}

function PreLaunchPage() {
  const router = useRouter()
  const { days, hours, minutes, seconds } = useCountdown()
  const [notif, setNotif] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')
  const [showTester, setShowTester] = useState(false)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotif('granted')
    }
  }, [])

  const handleNotify = async () => {
    if (!('Notification' in window)) return
    setNotif('loading')
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotif('granted')
      setTimeout(() => router.push('/notify-confirmed'), 600)
    } else {
      setNotif('denied')
    }
  }

  const units = [
    { v: days, l: 'days' },
    { v: hours, l: 'hrs' },
    { v: minutes, l: 'min' },
    { v: seconds, l: 'sec' },
  ]

  return (
    <main style={{
      background: '#000', height: '100dvh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 28px', position: 'relative',
    }}>
      {showTester && <TesterModal onClose={() => setShowTester(false)} />}

      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 20px)', left: 26 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.3px' }}>TripAlong</span>
      </div>

      <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'rgba(240,235,227,0.07)',
          border: '0.5px solid rgba(240,235,227,0.15)',
          borderRadius: 20, padding: '5px 14px', marginBottom: 22,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Launching July 1st
          </span>
        </div>

        <h1 style={{
          color: '#fff', fontSize: 'clamp(30px, 8.5vw, 46px)',
          fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.8px', margin: '0 0 10px',
        }}>
          Your travel crew<br />
          <span style={{ color: 'rgba(255,255,255,0.28)' }}>is waiting.</span>
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 32 }}>
          Be the first in when we go live.
        </p>

        {/* Countdown */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 36 }}>
          {units.map(({ v, l }) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '14px 0', width: 70,
              }}>
                <span style={{
                  display: 'block', textAlign: 'center',
                  color: '#fff', fontSize: 30, fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {pad(v)}
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {l}
              </span>
            </div>
          ))}
        </div>

        {/* Notify button */}
        <button
          onClick={handleNotify}
          disabled={notif === 'loading' || notif === 'granted'}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 18,
            fontWeight: 700, fontSize: 16,
            backgroundColor: notif === 'granted' ? '#30D158' : '#F0EBE3',
            color: '#000', border: 'none',
            cursor: notif === 'loading' || notif === 'granted' ? 'default' : 'pointer',
            marginBottom: 10, transition: 'background-color 0.3s',
          }}
        >
          {notif === 'loading' ? 'One sec…' : notif === 'granted' ? '✓ Notifications accepted' : '🔔  Notify me at launch'}
        </button>

        {notif === 'denied' && (
          <p style={{ color: 'rgba(255,100,100,0.7)', fontSize: 12.5, marginBottom: 4 }}>
            Notifications blocked — enable them in browser settings
          </p>
        )}

        {/* Tester CTA — prominent secondary button */}
        <button
          onClick={() => setShowTester(true)}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 18,
            fontWeight: 700, fontSize: 15,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)',
            color: '#fff', cursor: 'pointer', marginBottom: 10,
            letterSpacing: '-0.1px',
          }}
        >
          🧪  Request to be a tester
        </button>

        {/* Early access — tiny and subtle */}
        <button
          onClick={() => router.push('/early-access')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.18)', fontSize: 12.5, fontWeight: 500,
            padding: '10px 0', display: 'block', width: '100%',
          }}
        >
          Have an early access code? →
        </button>
      </div>
    </main>
  )
}

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

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏕️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
  chill: '😊', nature: '🌿', beach: '🏖️', spiritual: '🙏', 'road trip': '🚗',
}

// 5-card portrait stack — each slot clearly offset so depth is obvious
const STACK = [
  { scale: 1.00, y:  0, rotate:  0,   opacity: 1.00, z: 5 },
  { scale: 0.92, y: 18, rotate:  3.5, opacity: 0.78, z: 4 },
  { scale: 0.84, y: 33, rotate: -2.8, opacity: 0.58, z: 3 },
  { scale: 0.76, y: 46, rotate:  3.2, opacity: 0.40, z: 2 },
  { scale: 0.68, y: 57, rotate: -2.2, opacity: 0.24, z: 1 },
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

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#111', borderRadius: 24, overflow: 'hidden',
    }}>
      {trip.cover_image && (
        <img
          src={trip.cover_image} alt={trip.destination} draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* Same gradient as in-app SwipeCard */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 28%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.96) 100%)',
      }} />

      {/* SAVE stamp */}
      <div style={{
        position: 'absolute', top: 22, right: 16, zIndex: 20,
        border: '2px solid #F0EBE3', borderRadius: 8, padding: '3px 10px',
        transform: 'rotate(15deg)',
        opacity: stamp === 'save' ? 1 : 0, transition: 'opacity 0.1s',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#F0EBE3', fontWeight: 900, fontSize: 16, letterSpacing: '1px' }}>SAVE</span>
      </div>

      {/* PASS stamp */}
      <div style={{
        position: 'absolute', top: 22, left: 16, zIndex: 20,
        border: '2px solid #FF453A', borderRadius: 8, padding: '3px 10px',
        transform: 'rotate(-15deg)',
        opacity: stamp === 'pass' ? 1 : 0, transition: 'opacity 0.1s',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#FF453A', fontWeight: 900, fontSize: 16, letterSpacing: '1px' }}>PASS</span>
      </div>

      {/* Trip info at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 15px 16px', zIndex: 10 }}>
        {trip.country && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.6)" />
            </svg>
            <span style={{ color: 'rgba(240,235,227,0.6)', fontSize: 10.5, fontWeight: 500 }}>
              {trip.country.toLowerCase()}
            </span>
          </div>
        )}
        <h2 style={{
          color: '#fff', fontWeight: 800, margin: '0 0 6px',
          fontSize: 'clamp(20px, 5.8vw, 28px)', lineHeight: 1.05, letterSpacing: '-0.5px',
        }}>
          {trip.destination}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.46)', fontSize: 11, margin: '0 0 7px' }}>
          {fmtDates(trip.start_date, trip.end_date, trip.is_flexible_dates)}
          {trip.budget_level ? ` · ${trip.budget_level}` : ''}
        </p>
        {vibes.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {vibes.map(v => (
              <span key={v} style={{
                fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: 'rgba(240,235,227,0.08)',
                border: '0.5px solid rgba(240,235,227,0.18)',
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

const GUIDELINES = [
  { icon: '🤝', text: 'Be respectful — treat every traveler the way you\'d want to be treated' },
  { icon: '🚫', text: 'No harassment, hate speech, or inappropriate messages' },
  { icon: '📍', text: 'Meet in public places for your first meet-up with a new travel companion' },
  { icon: '🎭', text: 'Be yourself — fake profiles or impersonation will get you banned' },
  { icon: '🚨', text: 'Report anything that feels off — we review every report' },
]

export default function SplashPage() {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [step, setStep] = useState<'splash' | 'guidelines'>('splash')
  const [cards, setCards] = useState<SplashTrip[]>([])
  const [topIndex, setTopIndex] = useState(0)
  const [exitingCard, setExitingCard] = useState<SplashTrip | null>(null)
  const [stamp, setStamp] = useState<'save' | 'pass' | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const swipeCount = useRef(0)
  const exitDir = useRef(1)

  useEffect(() => {
    setHasAccess(localStorage.getItem(ACCESS_KEY) === 'true')
  }, [])

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
    setExitingCard(cards[topIndex % cards.length])
    setStamp(dir > 0 ? 'save' : 'pass')
    setTopIndex(i => (i + 1) % cards.length)
    setTimeout(() => { setExitingCard(null); setStamp(null); setIsAnimating(false) }, 560)
  }, [isAnimating, cards, topIndex])

  useEffect(() => {
    if (cards.length < 2) return
    const t = setInterval(triggerSwipe, 1800)
    return () => clearInterval(t)
  }, [triggerSwipe, cards.length])

  if (hasAccess === null) return null
  if (!hasAccess) return <PreLaunchPage />

  return (
    <main style={{
      position: 'relative', background: '#000',
      height: '100dvh', overflow: 'hidden',
    }}>

      {/* ── Wordmark ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: step === 'guidelines' ? 0 : 1 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{
          position: 'absolute', zIndex: 20,
          top: 'calc(env(safe-area-inset-top) + 16px)',
          left: 26,
        }}
      >
        <span className="text-white font-extrabold text-2xl tracking-tight">TripAlong</span>
      </motion.div>

      {/* ── Portrait card stack — hidden on guidelines slide ── */}
      {/* Centering wrapper is separate from the motion element so translateX(-50%)
          isn't overridden by Framer Motion's scale transform */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 54px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '68vw',
        maxWidth: 282,
        height: '58dvh',
        zIndex: 5,
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: step === 'guidelines' ? 0 : 1, scale: step === 'guidelines' ? 0.96 : 1 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%', height: '100%',
          overflow: 'visible',
          pointerEvents: step === 'guidelines' ? 'none' : undefined,
          visibility: step === 'guidelines' ? 'hidden' : 'visible',
        } as React.CSSProperties}
      >
        {/* 5 stacked cards — rendered back to front */}
        {cards.length > 0 && [...Array(5)].map((_, slotIdx) => {
          const card = cards[(topIndex + slotIdx) % cards.length]
          const s = STACK[slotIdx]
          return (
            <motion.div
              key={card.id}
              initial={{ scale: s.scale, y: s.y, rotate: s.rotate, opacity: s.opacity }}
              animate={{ scale: s.scale, y: s.y, rotate: s.rotate, opacity: s.opacity }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute', inset: 0, zIndex: s.z,
                transformOrigin: 'bottom center',
              }}
            >
              <CardFace trip={card} stamp={slotIdx === 0 ? stamp : null} />
            </motion.div>
          )
        }).reverse()}

        {/* Exiting card flies off */}
        {exitingCard && (
          <motion.div
            key={`exit-${exitingCard.id}`}
            initial={{ x: 0, rotate: 0, opacity: 1, scale: 1, y: 0 }}
            animate={{ x: exitDir.current * 660, rotate: exitDir.current * 13, opacity: 0 }}
            transition={{ duration: 0.48, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ position: 'absolute', inset: 0, zIndex: 20, transformOrigin: 'bottom center' }}
          >
            <CardFace trip={exitingCard} stamp={stamp} />
          </motion.div>
        )}

        {/* Skeletons while loading */}
        {cards.length === 0 && [...Array(5)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: 24,
            background: `rgb(${16 + i * 5}, ${16 + i * 5}, ${16 + i * 5})`,
            transform: `scale(${STACK[i].scale}) translateY(${STACK[i].y}px) rotate(${STACK[i].rotate}deg)`,
            transformOrigin: 'bottom center', zIndex: STACK[i].z,
          }} />
        )).reverse()}

        {/* Gradient fade — cards dissolve into the text below */}
        <div style={{
          position: 'absolute', bottom: 0,
          left: -100, right: -100,  // wider than card to cover rotated corners
          height: '55%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 50%, #000 100%)',
          zIndex: 30, pointerEvents: 'none',
        }} />
      </motion.div>
      </div>

      {/* ── Slide 1: Hook + social proof + CTAs ── */}
      <AnimatePresence mode="wait">
        {step === 'splash' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.38 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              zIndex: 10,
              padding: '0 26px',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
              display: 'flex', flexDirection: 'column', gap: 0,
              background: 'linear-gradient(to bottom, transparent 0%, #000 18%)',
            }}
          >
            <h1 className={playfair.className} style={{
              fontSize: 'clamp(27px, 7.8vw, 40px)',
              fontWeight: 900, lineHeight: 1.12,
              letterSpacing: '-0.3px', color: '#fff', margin: '0 0 12px',
            }}>
              Go alone if you have to.
              <br />
              <span style={{ color: '#F0EBE3' }}>But now, you don't.</span>
            </h1>

            {/* Social proof */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 }}>
              <div style={{ display: 'flex' }}>
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

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button
                onClick={() => { haptic(8); setStep('guidelines') }}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 18,
                  fontWeight: 700, fontSize: 15.5,
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
            </div>
          </motion.div>
        )}

        {/* ── Slide 2: Community guidelines ── */}
        {step === 'guidelines' && (
          <motion.div
            key="guidelines"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
              zIndex: 10,
              backgroundColor: '#000',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '0 26px',
              paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              Community Guidelines
            </p>
            <h2 className={playfair.className} style={{
              fontSize: 'clamp(24px, 6.5vw, 34px)',
              fontWeight: 900, lineHeight: 1.12,
              color: '#fff', marginBottom: 20,
            }}>
              A few rules to<br />
              <span style={{ color: '#F0EBE3' }}>keep everyone safe.</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 28 }}>
              {GUIDELINES.map((g, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.28 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{g.icon}</span>
                  <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                    {g.text}
                  </p>
                </motion.div>
              ))}
            </div>

            <button
              onClick={() => { haptic(12); sessionStorage.setItem('ta_require_auth', '1'); router.push('/feed') }}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 18,
                fontWeight: 700, fontSize: 15.5,
                backgroundColor: '#F0EBE3', color: '#000',
                border: 'none', cursor: 'pointer', letterSpacing: '-0.1px',
                marginBottom: 10,
              }}
            >
              I agree — let's go ✓
            </button>
            <button
              onClick={() => { haptic(4); setStep('splash') }}
              style={{
                width: '100%', padding: '10px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: 500,
              }}
            >
              ← Back
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  )
}
