'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { GuidelinesSlide } from '@/components/GuidelinesSlide'

export default function EarlyAccessPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'success' | 'loading'>('idle')
  const [errorMsg, setErrorMsg] = useState('Invalid code — try again.')
  const [showGuidelines, setShowGuidelines] = useState(false)

  const submit = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setState('loading')

    // Must be logged in to redeem a code (code is tied to the user)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Save where they were going and send to login first
      sessionStorage.setItem('post_login_redirect', '/early-access')
      router.replace('/login')
      return
    }

    const { data, error } = await supabase.rpc('redeem_beta_code', { p_code: trimmed })

    if (error || !data?.ok) {
      const reason = data?.error
      if (reason === 'code_already_used') {
        setErrorMsg('This code has already been used.')
      } else {
        setErrorMsg('Invalid code — try again.')
      }
      setState('error')
      setTimeout(() => setState('idle'), 2500)
      return
    }

    // Grant access via cookie (same cookie the protected layout checks)
    document.cookie = 'ta_access=true; path=/; max-age=31536000; SameSite=Lax'
    setState('success')
    setTimeout(() => setShowGuidelines(true), 900)
  }

  const handleAgree = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    // New sign-ups need a profile first — same age check auth/callback uses
    const { data: profile } = await supabase
      .from('users')
      .select('age')
      .eq('id', user.id)
      .single()
    router.replace(!profile || profile.age === null ? '/onboarding' : '/feed')
  }

  if (showGuidelines) {
    return <GuidelinesSlide onAgree={handleAgree} />
  }

  return (
    <main style={{
      background: '#000', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 28px', position: 'relative',
    }}>
      <button
        onClick={() => router.back()}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 20px)', left: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.38)', fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4, padding: '8px 6px',
        }}
      >
        ← Back
      </button>

      <div style={{ textAlign: 'center', width: '100%', maxWidth: 320 }}>
        <p style={{
          color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600,
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Beta Access
        </p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8, lineHeight: 1.15 }}>
          Enter your invite code
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
          You should have received a code in your email.
        </p>

        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value); setState('idle') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="TRIP-XXXX"
          maxLength={9}
          autoFocus
          autoCapitalize="characters"
          style={{
            width: '100%', padding: '18px 20px',
            borderRadius: 16, fontSize: 22, fontWeight: 700,
            textAlign: 'center', letterSpacing: '4px',
            background: 'rgba(255,255,255,0.05)',
            border: state === 'error'
              ? '1.5px solid rgba(255,80,80,0.7)'
              : state === 'success'
              ? '1.5px solid #30D158'
              : '1px solid rgba(255,255,255,0.1)',
            color: '#fff', outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
        />

        {state === 'error' && (
          <p style={{ color: 'rgba(255,80,80,0.8)', fontSize: 13, marginTop: 10 }}>
            {errorMsg}
          </p>
        )}
        {state === 'success' && (
          <p style={{ color: '#30D158', fontSize: 13, marginTop: 10 }}>
            ✓ Access granted! Welcome to TripAlong.
          </p>
        )}

        <button
          onClick={submit}
          disabled={code.length === 0 || state === 'success' || state === 'loading'}
          style={{
            marginTop: 16, width: '100%', padding: '16px 0',
            borderRadius: 18, fontWeight: 700, fontSize: 16,
            backgroundColor: state === 'success' ? '#30D158' : '#F0EBE3',
            color: '#000', border: 'none',
            cursor: code.length === 0 || state === 'success' || state === 'loading' ? 'default' : 'pointer',
            opacity: code.length === 0 || state === 'loading' ? 0.4 : 1,
            transition: 'opacity 0.2s, background-color 0.3s',
          }}
        >
          {state === 'loading' ? 'Checking...' : state === 'success' ? 'Welcome! ✓' : 'Enter →'}
        </button>
      </div>
    </main>
  )
}
