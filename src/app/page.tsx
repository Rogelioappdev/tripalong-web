'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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

export default function SplashPage() {
  const router = useRouter()
  const [cards, setCards] = useState<TripCard[]>([])

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
      .limit(3)
      .then(({ data }) => {
        if (data && data.length > 0) setCards(data as TripCard[])
      })
  }, [])

  const front = cards[0] ?? null
  const left  = cards[1] ?? null
  const right = cards[2] ?? null

  return (
    <main
      style={{
        background: '#000',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        <span
          className={playfair.className}
          style={{ color: '#F0EBE3', fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px' }}
        >
          TripAlong
        </span>
      </motion.div>

      {/* ── Card stack ── */}
      <div
        style={{
          flexShrink: 0,
          height: '50dvh',
          position: 'relative',
        }}
      >
        {/* Left peeker */}
        {left ? (
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 0.72, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.22 }}
            style={{
              position: 'absolute',
              top: '8%',
              left: '-14%',
              width: '52vw',
              height: '88%',
              borderRadius: 18,
              overflow: 'hidden',
              transform: 'rotate(-11deg)',
              boxShadow: '0 20px 56px rgba(0,0,0,0.9)',
              zIndex: 1,
            }}
          >
            <img src={left.cover_image!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
          </motion.div>
        ) : (
          <div
            style={{
              position: 'absolute', top: '8%', left: '-14%',
              width: '52vw', height: '88%',
              borderRadius: 18, background: '#141414',
              transform: 'rotate(-11deg)', zIndex: 1,
            }}
          />
        )}

        {/* Right peeker */}
        {right ? (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 0.72, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
            style={{
              position: 'absolute',
              top: '5%',
              right: '-12%',
              width: '52vw',
              height: '88%',
              borderRadius: 18,
              overflow: 'hidden',
              transform: 'rotate(9deg)',
              boxShadow: '0 20px 56px rgba(0,0,0,0.9)',
              zIndex: 1,
            }}
          >
            <img src={right.cover_image!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
          </motion.div>
        ) : (
          <div
            style={{
              position: 'absolute', top: '5%', right: '-12%',
              width: '52vw', height: '88%',
              borderRadius: 18, background: '#141414',
              transform: 'rotate(9deg)', zIndex: 1,
            }}
          />
        )}

        {/* Front card — centered, prominent */}
        {front ? (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{
              position: 'absolute',
              top: '3%',
              left: '50%',
              transform: 'translateX(-50%) rotate(-1.5deg)',
              width: '74vw',
              maxWidth: 310,
              height: '94%',
              borderRadius: 22,
              overflow: 'hidden',
              boxShadow: '0 28px 80px rgba(0,0,0,0.95)',
              zIndex: 3,
            }}
          >
            <img
              src={front.cover_image!}
              alt={front.destination}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Gradient */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, transparent 30%, rgba(0,0,0,0.78) 100%)',
              }}
            />
            {/* Destination label */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '14px 16px' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2, margin: 0 }}>
                {front.destination}
              </p>
              {front.country && (
                <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12.5, margin: '3px 0 0' }}>
                  {front.country}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          /* Skeleton */
          <div
            style={{
              position: 'absolute', top: '3%', left: '50%',
              transform: 'translateX(-50%) rotate(-1.5deg)',
              width: '74vw', maxWidth: 310, height: '94%',
              borderRadius: 22, background: '#161616',
              boxShadow: '0 28px 80px rgba(0,0,0,0.95)', zIndex: 3,
            }}
          />
        )}

        {/* Gradient fade from cards into black below */}
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            left: 0,
            right: 0,
            height: 72,
            background: 'linear-gradient(to bottom, transparent, #000)',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* ── Copy + CTAs ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
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
              fontWeight: 900,
              lineHeight: 1.13,
              letterSpacing: '-0.3px',
              color: '#fff',
              margin: 0,
            }}
          >
            Go alone if you have to.
            <br />
            <span style={{ color: '#C8B99A' }}>
              But now, you don't.
            </span>
          </h1>

          {/* Social proof */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14 }}>
            {/* Stacked warm-tone circles */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {['#B8997A', '#9E8060', '#C4A882', '#8A7050'].map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: c,
                    border: '1.5px solid #000',
                    marginLeft: i > 0 ? -7 : 0,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            <p
              style={{
                color: 'rgba(255,255,255,0.32)',
                fontSize: 12.5,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
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
              width: '100%',
              padding: '16px 0',
              borderRadius: 18,
              fontWeight: 700,
              fontSize: 15.5,
              backgroundColor: '#F0EBE3',
              color: '#000',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '-0.1px',
            }}
          >
            Find my people →
          </button>
          <button
            onClick={() => { haptic(6); router.push('/login') }}
            style={{
              width: '100%',
              padding: '11px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.26)',
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            Already have an account? Sign in
          </button>
        </motion.div>
      </div>
    </main>
  )
}
