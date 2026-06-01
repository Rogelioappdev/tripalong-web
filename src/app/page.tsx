'use client'

import { useEffect, useState, useCallback } from 'react'
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

// Stack slot styles (back → front)
const SLOT = [
  { scale: 0.86, y: 26, opacity: 0.55 }, // slot 2 — back
  { scale: 0.93, y: 13, opacity: 0.82 }, // slot 1 — middle
  { scale: 1.00, y:  0, opacity: 1.00 }, // slot 0 — front
]

export default function SplashPage() {
  const router = useRouter()
  const [cards, setCards] = useState<TripCard[]>([])
  const [frontIdx, setFrontIdx] = useState(0)
  const [exitingIdx, setExitingIdx] = useState<number | null>(null)

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

  const doSwipe = useCallback(() => {
    if (exitingIdx !== null || cards.length < 2) return
    const leaving = frontIdx
    setExitingIdx(leaving)
    setFrontIdx(i => (i + 1) % cards.length)   // advance stack immediately
    setTimeout(() => setExitingIdx(null), 550)
  }, [exitingIdx, frontIdx, cards.length])

  // Auto-swipe every 3.5s
  useEffect(() => {
    if (cards.length < 2) return
    const t = setInterval(doSwipe, 3500)
    return () => clearInterval(t)
  }, [doSwipe, cards.length])

  // Get slot (0=front, 1=middle, 2=back) for a given card index
  const getSlot = (idx: number) => {
    const rel = ((idx - frontIdx) % cards.length + cards.length) % cards.length
    return rel  // 0=front, 1=middle, 2=back, ≥3=not rendered
  }

  const visibleCards = cards.filter((_, i) => {
    if (i === exitingIdx) return true   // still visible while swiping out
    return getSlot(i) <= 2
  })

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
          paddingLeft: 28, paddingBottom: 14,
        }}
      >
        <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
          TripAlong
        </span>
      </motion.div>

      {/* ── Card stack ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
        style={{ flexShrink: 0, height: '52dvh', position: 'relative' }}
      >
        <AnimatePresence>
          {visibleCards.map((card, _, arr) => {
            const cardIdx = cards.indexOf(card)
            const isExiting = cardIdx === exitingIdx
            const slot = isExiting ? -1 : getSlot(cardIdx)
            const slotStyle = SLOT[slot] ?? SLOT[2]

            if (isExiting) {
              return (
                <motion.div
                  key={card.id}
                  initial={{ x: 0, rotate: 0, opacity: 1, scale: 1, y: 0 }}
                  animate={{ x: '130%', rotate: 16, opacity: 0 }}
                  transition={{ duration: 0.48, ease: [0.55, 0.055, 0.675, 0.19] }}
                  style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: '76vw', maxWidth: 320, height: '100%',
                    borderRadius: 22, overflow: 'hidden',
                    boxShadow: '0 24px 72px rgba(0,0,0,0.9)',
                    zIndex: 10,
                    transformOrigin: 'bottom center',
                  }}
                >
                  <img src={card.cover_image!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 28%, rgba(0,0,0,0.78) 100%)' }} />
                  {/* "JOIN" flash on exit */}
                  <div style={{
                    position: 'absolute', top: 20, left: 20,
                    background: 'rgba(48,209,88,0.92)', borderRadius: 10,
                    padding: '5px 12px', fontWeight: 700, fontSize: 14,
                    color: '#fff', letterSpacing: '0.5px',
                    border: '2px solid #30D158',
                  }}>
                    JOIN ✓
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '14px 16px', zIndex: 2 }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, margin: 0 }}>{card.destination}</p>
                    {card.country && <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12.5, margin: '3px 0 0' }}>{card.country}</p>}
                  </div>
                </motion.div>
              )
            }

            return (
              <motion.div
                key={card.id}
                animate={{
                  scale: slotStyle.scale,
                  y: slotStyle.y,
                  opacity: slotStyle.opacity,
                }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: '76vw', maxWidth: 320, height: '100%',
                  borderRadius: 22, overflow: 'hidden',
                  boxShadow: slot === 0 ? '0 24px 72px rgba(0,0,0,0.9)' : '0 12px 40px rgba(0,0,0,0.7)',
                  zIndex: 3 - slot,
                  willChange: 'transform',
                }}
              >
                <img src={card.cover_image!} alt={card.destination} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 28%, rgba(0,0,0,0.80) 100%)' }} />
                {slot === 0 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '14px 16px', zIndex: 2 }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, margin: 0 }}>{card.destination}</p>
                    {card.country && <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12.5, margin: '3px 0 0' }}>{card.country}</p>}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Skeleton while loading */}
        {cards.length === 0 && (
          <>
            <div style={{ position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%) scale(0.86)', width: '76vw', maxWidth: 320, height: '100%', borderRadius: 22, background: '#111', opacity: 0.55, zIndex: 1 }} />
            <div style={{ position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%) scale(0.93)', width: '76vw', maxWidth: 320, height: '100%', borderRadius: 22, background: '#161616', opacity: 0.82, zIndex: 2 }} />
            <div style={{ position: 'absolute', top: 0,  left: '50%', transform: 'translateX(-50%)',          width: '76vw', maxWidth: 320, height: '100%', borderRadius: 22, background: '#1e1e1e', zIndex: 3 }} />
          </>
        )}

        {/* Black fade at bottom */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 64,
          background: 'linear-gradient(to bottom, transparent, #000)',
          zIndex: 20, pointerEvents: 'none',
        }} />
      </motion.div>

      {/* ── Copy + CTAs ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '18px 28px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 36px)',
      }}>
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
                <div key={i} style={{
                  width: 26, height: 26, borderRadius: 13,
                  border: '1.5px solid #000',
                  marginLeft: i > 0 ? -8 : 0,
                  flexShrink: 0, overflow: 'hidden',
                  backgroundColor: '#1a1a1a',
                }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 12.5, margin: 0, lineHeight: 1.3 }}>
              Travelers already planning their next trip
            </p>
          </div>
        </motion.div>

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
