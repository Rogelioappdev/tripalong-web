'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useAnimation } from 'framer-motion'
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

const CARD_GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, rgba(0,0,0,0.7) 62%, rgba(0,0,0,0.97) 100%)'

export default function SplashPage() {
  const router = useRouter()
  const [cards, setCards] = useState<TripCard[]>([])
  const [isAnimating, setIsAnimating] = useState(false)

  // Two slots — A and B — swap the "front" role on each swipe
  const [slotA, setSlotA] = useState(0)
  const [slotB, setSlotB] = useState(1)
  const [frontIsA, setFrontIsA] = useState(true)
  const [showStamp, setShowStamp] = useState(false)

  const controlsA = useAnimation()
  const controlsB = useAnimation()

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
      .limit(8)
      .then(({ data }) => {
        if (data && data.length > 0) setCards(data as TripCard[])
      })
  }, [])

  // Set initial slot positions once cards load
  useEffect(() => {
    if (cards.length < 2) return
    controlsA.set({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 })
    controlsB.set({ x: 0, y: 10, scale: 0.97, opacity: 1 })
  }, [cards.length, controlsA, controlsB])

  const triggerSwipe = useCallback(async () => {
    if (isAnimating || cards.length < 2) return
    setIsAnimating(true)
    setShowStamp(true)

    const frontCtrl  = frontIsA ? controlsA : controlsB
    const behindCtrl = frontIsA ? controlsB : controlsA
    const currentBehindSlot = frontIsA ? slotB : slotA
    const nextCard = (currentBehindSlot + 1) % cards.length

    // Same values as the real SwipeCard
    await Promise.all([
      frontCtrl.start({ x: 700, opacity: 0, rotate: 20, transition: { duration: 0.3, ease: 'easeOut' } }),
      behindCtrl.start({ scale: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }),
    ])

    setShowStamp(false)

    // Reset old-front slot to behind position, load next card into it
    frontCtrl.set({ x: 0, opacity: 1, rotate: 0, scale: 0.97, y: 10 })
    if (frontIsA) setSlotA(nextCard); else setSlotB(nextCard)

    // Toggle which slot is front
    setFrontIsA(f => !f)
    setIsAnimating(false)
  }, [isAnimating, cards.length, frontIsA, controlsA, controlsB, slotA, slotB])

  useEffect(() => {
    if (cards.length < 2) return
    const t = setInterval(triggerSwipe, 3200)
    return () => clearInterval(t)
  }, [triggerSwipe, cards.length])

  const frontCard  = cards[frontIsA ? slotA : slotB] ?? null
  const behindCard = cards[frontIsA ? slotB : slotA] ?? null

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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        style={{ flexShrink: 0, height: '52dvh', position: 'relative', paddingLeft: 20, paddingRight: 20 }}
      >
        {/* Inner container — cards fill this, matching SwipeStack's inset-0 pattern */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden' }}>

          {/* Behind card (slot B or A depending on frontIsA) */}
          {behindCard ? (
            <motion.div
              animate={frontIsA ? controlsB : controlsA}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: 22, overflow: 'hidden',
                zIndex: 0, transformOrigin: 'bottom center',
              }}
            >
              <img src={behindCard.cover_image!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENT }} />
            </motion.div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: '#161616', zIndex: 0 }} />
          )}

          {/* Front card */}
          {frontCard ? (
            <motion.div
              animate={frontIsA ? controlsA : controlsB}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: 22, overflow: 'hidden',
                zIndex: 10, transformOrigin: 'bottom center',
              }}
            >
              <img src={frontCard.cover_image!} alt={frontCard.destination} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENT }} />

              {/* SAVE stamp — matches real app */}
              <motion.div
                animate={{ opacity: showStamp ? 1 : 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute', top: 28, right: 20, zIndex: 20,
                  border: '2.5px solid #F0EBE3', borderRadius: 12,
                  padding: '6px 14px', transform: 'rotate(15deg)',
                }}
              >
                <span style={{ color: '#F0EBE3', fontWeight: 900, fontSize: 20, letterSpacing: '1.5px' }}>SAVE</span>
              </motion.div>

              {/* Destination — matches real CardContent */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px', zIndex: 10 }}>
                {frontCard.country && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.7)" />
                    </svg>
                    <span style={{ color: 'rgba(240,235,227,0.7)', fontSize: 12, fontWeight: 500, letterSpacing: '0.3px' }}>
                      {frontCard.country.toLowerCase()}
                    </span>
                  </div>
                )}
                <h2 style={{
                  color: '#fff', fontWeight: 800,
                  fontSize: 'clamp(26px, 7.5vw, 38px)',
                  lineHeight: 1, letterSpacing: '-1px', margin: 0,
                }}>
                  {frontCard.destination}
                </h2>
              </div>
            </motion.div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: '#1e1e1e', zIndex: 10 }} />
          )}
        </div>

        {/* Gradient fade into text area */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 56,
          background: 'linear-gradient(to bottom, transparent, #000)',
          zIndex: 30, pointerEvents: 'none',
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
