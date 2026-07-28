'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This page's sign-in/sign-up form has been superseded by the auth stage
// built into /onboarding (same Google + email logic, same destinations),
// so anyone who still lands here (old links, bookmarks) is sent straight there
// instead of maintaining two parallel auth UIs.
export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/onboarding')
  }, [router])

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </main>
  )
}
