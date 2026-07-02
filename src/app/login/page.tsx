'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'
import { isNativeApp } from '@/lib/native-app'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const signInWithGoogle = () => {
    haptic(8)
    if (isNativeApp) {
      // Google blocks/degrades OAuth inside embedded WebViews — hand off to
      // native so it can open a real system browser instead.
      ;(window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'google_signin' }))
      return
    }
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const postLoginRedirect = () => {
    const hasBeta = document.cookie.includes('ta_access=true')
    window.location.href = hasBeta ? '/feed' : '/early-access'
  }

  const handleSignIn = async () => {
    setError('')
    setStatus('Signing in...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setStatus('') }
    else postLoginRedirect()
  }

  const handleSignUp = async () => {
    setError('')
    setStatus('Creating account...')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setStatus('') }
    else window.location.href = '/onboarding'
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div
        className="flex-1 flex flex-col max-w-sm mx-auto w-full px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 40px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}
      >
        {/* Back */}
        <button
          onClick={() => { haptic(6); router.push('/') }}
          className="text-white/30 text-sm self-start mb-10 active:opacity-60 transition-opacity"
        >
          ← Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col gap-7 flex-1"
        >
          <div>
            <h1 className="text-white font-extrabold text-3xl mb-1">Welcome back.</h1>
            <p className="text-white/35 text-sm">Your crew is waiting.</p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex items-center gap-3 font-semibold px-5 py-4 rounded-2xl w-full justify-center active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/25 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSignIn() }}
              className="bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {status && <p className="text-white/40 text-xs">{status}</p>}
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.15)' }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="text-white/28 text-sm py-2 text-center active:opacity-60 transition-opacity"
            >
              No account? Sign up free
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
