'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// The old marketing splash here (phone-frame mockup + "Get Started"/"Sign In")
// is retired in favor of going straight to /onboarding's own SplashCarousel
// (world clock + typewriter headline) as the very first thing a visitor
// sees — one less tap, one less screen. That old design isn't deleted, just
// unused: see components/landing/LandingPhone.tsx if it's ever needed again.
// The "Already have an account?" path isn't lost either — it's the toggle
// already inside onboarding's own auth stage ("Already have an account?
// Sign in" / authMode).
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/feed' : '/onboarding')
    })
  }, [router])

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </main>
  )
}
