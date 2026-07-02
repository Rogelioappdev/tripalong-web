'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let resolved = false

    const redirect = async (session: Session) => {
      if (resolved) return
      resolved = true
      const hasBeta = document.cookie.includes('ta_access=true') || process.env.NEXT_PUBLIC_SKIP_ACCESS_GATE === 'true'
      if (!hasBeta) {
        router.replace('/early-access')
        return
      }
      const { data: user } = await supabase
        .from('users')
        .select('age')
        .eq('id', session.user.id)
        .single()
      router.replace(!user || user.age === null ? '/onboarding' : '/feed')
    }

    // Case 1: session already in localStorage (e.g. returning user)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirect(session)
    })

    // Case 2: fresh OAuth — Supabase JS auto-exchanges the ?code= param and fires SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) redirect(session)
    })

    // Safety timeout — send back to splash if nothing resolves
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; router.replace('/') }
    }, 8000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [router])

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </main>
  )
}
