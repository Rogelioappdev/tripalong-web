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

const CARD_STACK = [
  { rotate: '-7deg', translateX: '-22px', translateY: '14px', zIndex: 1, delay: 0.08 },
  { rotate: '5deg',  translateX: '18px',  translateY: '8px',  zIndex: 2, delay: 0.18 },
  { rotate: '-1.5deg', translateX: '0px', translateY: '0px',  zIndex: 3, delay: 0.28 },
]

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

  return (
    <main className="relative min-h-screen bg-[#0A0A0A] flex flex-col overflow-hidden">

      {/* Top section: wordmark + card stack */}
      <div
        className="relative flex flex-col items-center"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 36px)',
          paddingBottom: 0,
        }}
      >
        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mb-8 px-7 self-start"
        >
          <span
            className={playfair.className}
            style={{ color: '#F0EBE3', fontSize: 26, fontWeight: 700, letterSpacing: '-0.3px' }}
          >
            TripAlong
          </span>
        </motion.div>

        {/* Card stack */}
        <div
          className="relative w-full"
          style={{ height: '52vw', maxHeight: 260, overflow: 'visible' }}
        >
          {cards.length > 0
            ? cards.slice(0, 3).map((card, i) => {
                const cfg = CARD_STACK[i]
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 48 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: cfg.delay }}
                    className="absolute"
                    style={{
                      left: '50%',
                      top: 0,
                      width: '62vw',
                      maxWidth: 280,
                      aspectRatio: '3/4',
                      transform: `translateX(calc(-50% + ${cfg.translateX})) translateY(${cfg.translateY}) rotate(${cfg.rotate})`,
                      zIndex: cfg.zIndex,
                      borderRadius: 20,
                      overflow: 'hidden',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                    }}
                  >
                    <img
                      src={card.cover_image!}
                      alt={card.destination}
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.75) 100%)' }}
                    />
                    <div className="absolute bottom-0 left-0 px-3 pb-3">
                      <p className="text-white font-bold text-sm leading-tight">{card.destination}</p>
                      {card.country && (
                        <p className="text-white/55 text-xs">{card.country}</p>
                      )}
                    </div>
                  </motion.div>
                )
              })
            : /* Skeleton placeholders while loading */
              CARD_STACK.map((cfg, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: 0,
                    width: '62vw',
                    maxWidth: 280,
                    aspectRatio: '3/4',
                    transform: `translateX(calc(-50% + ${cfg.translateX})) translateY(${cfg.translateY}) rotate(${cfg.rotate})`,
                    zIndex: cfg.zIndex,
                    borderRadius: 20,
                    backgroundColor: '#1A1A1A',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  }}
                />
              ))}
        </div>

        {/* Gradient fade below stack */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: 80,
            background: 'linear-gradient(to bottom, transparent, #0A0A0A)',
          }}
        />
      </div>

      {/* Copy + CTAs */}
      <div
        className="relative flex-1 flex flex-col justify-between px-7"
        style={{
          paddingTop: 32,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 44px)',
        }}
      >
        {/* Hero copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.38 }}
          className="flex flex-col gap-4"
        >
          <h1
            className={playfair.className}
            style={{
              fontSize: 'clamp(32px, 9.5vw, 46px)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
              color: '#fff',
            }}
          >
            Go alone if<br />
            you have to.{' '}
            <span style={{ color: 'rgba(240,235,227,0.48)', fontStyle: 'italic' }}>
              But now,<br />you don't have to.
            </span>
          </h1>

          {/* Social proof */}
          <div className="flex items-center gap-2.5 mt-1">
            <div className="flex -space-x-2">
              {['#E8A87C', '#7EC8E3', '#A8D8A8', '#F7DC6F'].map((color, i) => (
                <div
                  key={i}
                  className="rounded-full border-2 border-[#0A0A0A]"
                  style={{ width: 26, height: 26, backgroundColor: color }}
                />
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>
              Join travelers from 40+ countries
            </p>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.56 }}
          className="flex flex-col gap-3 mt-8"
        >
          <button
            onClick={() => { haptic(8); router.push('/feed') }}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            Find my people →
          </button>
          <button
            onClick={() => { haptic(6); router.push('/login') }}
            className="w-full py-3 text-sm font-medium active:opacity-60 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.30)' }}
          >
            Already have an account? Sign in
          </button>
        </motion.div>
      </div>
    </main>
  )
}
