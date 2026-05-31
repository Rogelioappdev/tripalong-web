'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

interface AuthGateProps {
  destination?: string
  onClose: () => void
}

export function AuthGate({ destination, onClose }: AuthGateProps) {
  const [showEmail, setShowEmail] = useState(false)
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const headline = destination ? `${destination} is calling.` : 'Your next trip is one yes away.'
  const subline = destination ? "You're one yes away. It's free." : 'Find your people. It\'s free.'

  const handleGoogle = () => {
    haptic(8)
    sessionStorage.setItem('postAuthRedirect', '/feed')
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleEmailSubmit = async () => {
    if (!email || !password) return
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        window.location.href = '/onboarding'
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/feed'
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-end justify-center" onClick={onClose}>
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as React.CSSProperties}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 36, mass: 0.85 }}
          className="relative w-full max-w-lg rounded-t-[28px] flex flex-col"
          style={{
            backgroundColor: '#0D0D0D',
            border: '0.5px solid rgba(255,255,255,0.08)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-6">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} />
          </div>

          <div className="px-6 flex flex-col gap-5">
            {/* Copy */}
            <div className="mb-1">
              <h2 className="text-white font-extrabold leading-tight mb-2" style={{ fontSize: 28 }}>
                {headline}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 15 }}>{subline}</p>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-black text-base active:scale-[0.98] transition-transform"
              style={{ backgroundColor: '#F0EBE3' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Email */}
            {!showEmail ? (
              <button
                onClick={() => { haptic(6); setShowEmail(true) }}
                className="w-full py-4 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              >
                Continue with Email
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEmailSubmit() }}
                  className="bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  onClick={handleEmailSubmit}
                  disabled={loading || !email || !password}
                  className="w-full py-4 rounded-2xl font-bold text-black text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: '#F0EBE3' }}
                >
                  {loading ? 'One sec...' : mode === 'signup' ? 'Create free account' : 'Sign in'}
                </button>
                <button
                  onClick={() => setMode(m => m === 'signup' ? 'signin' : 'signup')}
                  className="text-white/28 text-xs text-center py-1 active:opacity-60 transition-opacity"
                >
                  {mode === 'signup' ? 'Already have an account? Sign in' : 'No account? Sign up free'}
                </button>
              </div>
            )}

            <p className="text-white/18 text-xs text-center pb-1">
              By continuing you agree to our community guidelines
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
