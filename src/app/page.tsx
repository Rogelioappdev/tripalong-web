'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

export default function SplashPage() {
  const router = useRouter()

  // If already logged in, skip straight to feed
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/feed')
    })
  }, [router])

  return (
    <main className="relative min-h-screen bg-black flex flex-col overflow-hidden">
      {/* Cinematic background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 70%, rgba(60,40,20,0.55) 0%, rgba(10,8,6,0.9) 55%, #000 100%)',
        }}
      />
      {/* Subtle warm glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 15%, rgba(240,235,227,0.04) 0%, transparent 55%)',
        }}
      />

      <div
        className="relative flex-1 flex flex-col justify-between px-7"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 52px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 44px)',
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex items-center gap-2"
        >
          <span className="text-base">✈️</span>
          <span className="text-white/55 text-sm font-semibold tracking-widest uppercase">TripAlong</span>
        </motion.div>

        {/* Hero hook */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut', delay: 0.18 }}
          className="flex flex-col gap-5"
        >
          <h1
            className="text-white font-extrabold tracking-tight leading-[1.08]"
            style={{ fontSize: 'clamp(38px, 11vw, 56px)' }}
          >
            Go alone<br />
            if you have to.
            <br />
            <span style={{ color: 'rgba(240,235,227,0.55)' }}>
              But now, you<br />don't have to.
            </span>
          </h1>

          <p className="text-white/32 text-base leading-relaxed">
            Real trips. Real people.<br />Find your travel crew.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.42 }}
          className="flex flex-col gap-3"
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
            style={{ color: 'rgba(255,255,255,0.32)' }}
          >
            Already have an account? Sign in
          </button>
        </motion.div>
      </div>
    </main>
  )
}
