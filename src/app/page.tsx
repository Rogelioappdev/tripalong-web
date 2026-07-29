'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { LandingPhone } from '@/components/landing/LandingPhone'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '800', '900'] })

const VALUE_PROPS = [
  { emoji: '🧭', title: 'Swipe real trips', body: 'Browse actual trips travelers are planning right now — not stock listings.' },
  { emoji: '💬', title: 'Land in the group', body: "Match with a trip and you're instantly in its group chat with everyone going." },
  { emoji: '🗺️', title: 'Plan it together', body: 'Sort dates, budget, and the itinerary with your crew before you fly.' },
]

export default function RootPage() {
  const router = useRouter()
  // Render nothing until we've confirmed there's no session — a returning
  // logged-in user should be bounced to /feed without ever flashing marketing.
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/feed')
      else setChecked(true)
    })
  }, [router])

  if (!checked) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Ambient warmth behind the hero so the black doesn't read as dead space */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-[80vh]"
        style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(240,235,227,0.10), transparent 70%)' }}
      />

      <section className="relative flex flex-col items-center px-6 pt-14 pb-16 lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:pt-24 lg:pb-24 max-w-6xl mx-auto">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md text-center lg:text-left lg:max-w-lg"
        >
          <span className="text-[#F0EBE3]/60 text-xs font-bold tracking-[0.28em] uppercase">TripAlong</span>

          <h1 className={`${playfair.className} text-white font-black tracking-tight mt-4 mb-5`}
            style={{ fontSize: 'clamp(38px, 11vw, 60px)', lineHeight: 1.02 }}>
            Never travel<br />alone again.
          </h1>

          <p className="text-white/55 text-base leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
            Swipe through real trips other travelers are planning. Match with one, land in the
            group chat, and go together — planning it side by side with the people going.
          </p>

          <div className="flex flex-col items-center gap-4 lg:items-start">
            <motion.div whileTap={{ scale: 0.97 }} className="w-full max-w-xs lg:mx-0">
              <Link
                href="/onboarding"
                className="block w-full text-center font-bold py-4 rounded-2xl text-base"
                style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
              >
                Find your trip →
              </Link>
            </motion.div>
            <Link href="/onboarding?mode=signin" className="text-white/45 text-sm font-medium hover:text-white/70 transition-colors">
              Already have an account? <span className="text-white/70 underline underline-offset-2">Sign in</span>
            </Link>
          </div>
        </motion.div>

        {/* Phone */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.12 }}
          className="mt-14 lg:mt-0 flex justify-center"
        >
          <LandingPhone />
        </motion.div>
      </section>

      {/* How it works */}
      <section className="relative px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUE_PROPS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.08 }}
              className="rounded-3xl p-5 text-center sm:text-left"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <div className="text-3xl mb-3">{p.emoji}</div>
              <h3 className="text-white font-bold text-base mb-1.5">{p.title}</h3>
              <p className="text-white/45 text-sm leading-snug">{p.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 mt-14">
          <p className={`${playfair.className} text-white font-bold text-center`} style={{ fontSize: 'clamp(24px, 6vw, 34px)' }}>
            Your next trip has a crew.
          </p>
          <motion.div whileTap={{ scale: 0.97 }} className="w-full max-w-xs">
            <Link
              href="/onboarding"
              className="block w-full text-center font-bold py-4 rounded-2xl text-base"
              style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
            >
              Find your trip →
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
