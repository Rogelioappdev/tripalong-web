'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const signInWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleSignIn = async () => {
    setError('')
    setStatus('Signing in...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setStatus('') }
    else window.location.href = '/feed'
  }

  const handleSignUp = async () => {
    setError('')
    setStatus('Creating account...')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setStatus('') }
    else window.location.href = '/onboarding'
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">TripAlong</h1>
        <p className="text-white/50">Find your travel crew</p>
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex items-center gap-3 bg-white text-black font-semibold px-8 py-4 rounded-2xl w-full max-w-sm justify-center"
        style={{ touchAction: 'manipulation' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 w-full max-w-sm">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="bg-white/8 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/30 text-base outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="bg-white/8 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/30 text-base outline-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {status && <p className="text-white/50 text-sm">{status}</p>}
        <button
          type="button"
          onClick={handleSignIn}
          className="bg-white/10 border border-white/20 text-white font-semibold py-4 rounded-2xl"
          style={{ touchAction: 'manipulation' }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={handleSignUp}
          className="text-white/30 text-sm py-2"
          style={{ touchAction: 'manipulation' }}
        >
          No account? Sign up
        </button>
      </div>
    </main>
  )
}
