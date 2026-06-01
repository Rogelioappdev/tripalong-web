'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '800', '900'] })

interface TripCard {
  id: string
  destination: string
  country: string | null
  cover_image: string | null
}

const SOCIAL_AVATARS = [
  'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/avatars/a50cfe93-fd2d-4676-b4da-8c970f696690/avatar.jpg',
  'https://staticfiles.net/XlP32QmlVxrNYg4ib9lZAe5LJGxfaFgVp0_tbJ3VKYw/p/oDi6PJlREVk.jpg',
  'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/avatars/422890b6-f24c-44a1-aa83-fc29611120ea/avatar.jpg',
  'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/profile-photos/avatar-0-1778603906132.jpg',
]

export default function SplashPage() {
  const router = useRouter()
  const [cards, setCards] = useState<TripCard[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/feed')
    })
  }, [router])

  useEffect(() => {
    supabase
      .from('trips')
      .select('id, destination, country, cover_image')
      .not('cover_image', 'is', null)
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setCards(data as TripCard[])
      })
  }, [])

  // Auto-cycle front card every 3.5s
  useEffect(() => {
    if (cards.length < 2) return
    const t = setInterval(() => setActiveIdx(i => (i + 1) % cards.length), 3500)
    return () => clearInterval(t)
  }, [cards.length])

  const front = cards.length > 0 ? cards[activeIdx] : null
  const left  = cards.length > 1 ? cards[(activeIdx + 1) % cards.length] : null
  const right = cards.length > 2 ? cards[(activeIdx + 2) % cards.length] : null

  return (
    <main style={{ background: '#000', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Wordmark ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        style={{
          flexShrink: 0,
          paddingTop: 'calc(env(safe-area-inset-top) + 18px)',
          paddingLeft: 28,
          paddingBottom: 14,
        }}
      >
        <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
          TripAlong
        </span>
      </motion.div>

      {/* ── Card stack ── */}
      <div style={{ flexShrink: 0, height: '50dvh', position: 'relative' }}>

        {/* Left peeker — slides in + floats */}
        {left ? (
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 0.68, x: 0, y: [0, -6, 0] }}
            transition={{
              opacity: { duration: 0.55, delay: 0.22 },
              x:       { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.22 },
              y:       { duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1.6 },
            }}
            style={{
              position: 'absolute', top: '8%', left: '-14%',
              width: '52vw', height: '88%',
              borderRadius: 18, overflow: 'hidden',
              transform: 'rotate(-11deg)',
              boxShadow: '0 20px 56px rgba(0,0,0,0.9)',
              zIndex: 1,
            }}
          >
            <img src={left.cover_image!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
          </motion.div>
        ) : (
          <div style={{
            position: 'absolute', top: '8%', left: '-14%',
            width: '52vw', height: '88%', borderRadius: 18,
            background: '#141414', transform: 'rotate(-11deg)', zIndex: 1,
          }} />
        )}

        {/* Right peeker — slides in + floats */}
        {right ? (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 0.68, x: 0, y: [0, -5, 0] }}
            transition={{
              opacity: { duration: 0.55, delay: 0.28 },
              x:       { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.28 },
              y:       { duration: 3.9, repeat: Infinity, ease: 'easeInOut', delay: 2.1 },
            }}
            style={{
              position: 'absolute', top: '5%', right: '-12%',
              width: '52vw', height: '88%',
              borderRadius: 18, overflow: 'hidden',
              transform: 'rotate(9deg)',
              boxShadow: '0 20px 56px rgba(0,0,0,0.9)',
              zIndex: 1,
            }}
          >
            <img src={right.cover_image!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
          </motion.div>
        ) : (
          <div style={{
            position: 'absolute', top: '5%', right: '-12%',
            width: '52vw', height: '88%', borderRadius: 18,
            background: '#141414', transform: 'rotate(9deg)', zIndex: 1,
          }} />
        )}

        {/* Front card — float wrapper */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          style={{
            position: 'absolute', top: '3%', left: '50%',
            transform: 'translateX(-50%)',
            width: '74vw', maxWidth: 310, height: '94%',
            zIndex: 3,
          }}
        >
          {/* Entrance + card shell */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{
              width: '100%', height: '100%',
              borderRadius: 22, overflow: 'hidden',
              transform: 'rotate(-1.5deg)',
              boxShadow: '0 28px 80px rgba(0,0,0,0.95)',
            }}
          >
            {/* Cycling photo */}
            <AnimatePresence mode="sync">
              {front && (
                <motion.img
                  key={front.id}
                  src={front.cover_image!}
                  alt={front.destination}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.0 }}
                  style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Gradient overlay */}
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 1,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 28%, rgba(0,0,0,0.80) 100%)',
              }}
            />

            {/* Cycling destination label */}
            <AnimatePresence mode="wait">
              {front && (
                <motion.div
                  key={`lbl-${front.id}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.38 }}
                  style={{ position: 'absolute', bottom: 0, left: 0, padding: '14px 16px', zIndex: 2 }}
                >
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, margin: 0 }}>
                    {front.destination}
                  </p>
                  {front.country && (
                    <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12.5, margin: '3px 0 0' }}>
                      {front.country}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dot indicators */}
            {cards.length > 1 && (
              <div
                style={{
                  position: 'absolute', top: 12, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 4, zIndex: 2,
                }}
              >
                {cards.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 3, borderRadius: 2,
                      width: i === activeIdx ? 16 : 4,
                      backgroundColor: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                      transition: 'width 0.3s ease, background-color 0.3s ease',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Skeleton fallback bg */}
            {!front && <div style={{ position: 'absolute', inset: 0, background: '#161616' }} />}
          </motion.div>
        </motion.div>

        {/* Black fade at bottom of card area */}
        <div
          style={{
            position: 'absolute', bottom: -1, left: 0, right: 0,
            height: 72, background: 'linear-gradient(to bottom, transparent, #000)',
            zIndex: 5, pointerEvents: 'none',
          }}
        />
      </div>

      {/* ── Copy + CTAs ── */}
      <div
        style={{
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '20px 28px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 36px)',
        }}
      >
        {/* Headline + social proof */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.38 }}
        >
          <h1
            className={playfair.className}
            style={{
              fontSize: 'clamp(28px, 8vw, 40px)',
              fontWeight: 900, lineHeight: 1.13,
              letterSpacing: '-0.3px', color: '#fff', margin: 0,
            }}
          >
            Go alone if you have to.
            <br />
            <span style={{ color: '#F0EBE3' }}>But now, you don't.</span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {SOCIAL_AVATARS.map((src, i) => (
                <div
                  key={i}
                  style={{
                    width: 26, height: 26, borderRadius: 13,
                    border: '1.5px solid #000',
                    marginLeft: i > 0 ? -8 : 0,
                    flexShrink: 0, overflow: 'hidden',
                    backgroundColor: '#1a1a1a',
                  }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 12.5, margin: 0, lineHeight: 1.3 }}>
              Travelers already planning their next trip
            </p>
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.52 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <button
            onClick={() => { haptic(8); router.push('/feed') }}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 18,
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
              width: '100%', padding: '11px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.26)', fontSize: 13.5, fontWeight: 500,
            }}
          >
            Already have an account? Sign in
          </button>
        </motion.div>
      </div>
    </main>
  )
}
