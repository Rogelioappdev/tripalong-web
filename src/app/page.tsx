'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { LandingPhone } from '@/components/landing/LandingPhone'

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
    <main className="min-h-screen bg-black flex flex-col overflow-hidden">
      <div
        className="flex flex-col max-w-sm mx-auto w-full px-6 min-h-screen"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="flex-1 flex items-center justify-center min-h-0"
        >
          <LandingPhone />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
          className="shrink-0 text-center"
        >
          <h1 className="text-white font-black tracking-tight mb-6" style={{ fontSize: 'clamp(32px, 10vw, 42px)', lineHeight: 1.1 }}>
            Never travel<br />alone again.
          </h1>

          <Link
            href="/onboarding"
            className="block w-full text-center font-bold py-4 rounded-full text-base active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            Get Started
          </Link>
          <Link
            href="/onboarding?mode=signin"
            className="block text-white/45 text-sm font-medium pt-4 active:opacity-60 transition-opacity"
          >
            Already have an account? <span className="text-white/70 font-semibold">Sign In</span>
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
