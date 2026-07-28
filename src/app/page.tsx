'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// The old splash (marketing hook + "Find my people" guest preview + community
// guidelines slide) has been superseded by /onboarding's own welcome/value-prop
// stages and real auth — this is now just a router: existing sessions go
// straight to /feed, everyone else lands on the one onboarding entry point.
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
