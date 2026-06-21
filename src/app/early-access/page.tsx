'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CORRECT_CODE = '0371'
const ACCESS_KEY = 'tripalong_early_access'

export default function EarlyAccessPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'success'>('idle')

  const submit = () => {
    if (code === CORRECT_CODE) {
      setState('success')
      localStorage.setItem(ACCESS_KEY, 'true')
      // Cookie lets the server-side middleware verify access on every request
      document.cookie = 'ta_access=true; path=/; max-age=31536000; SameSite=Lax'
      setTimeout(() => router.replace('/'), 1000)
    } else {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
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
          Early Access
        </p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8, lineHeight: 1.15 }}>
          Enter your code
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
          Get in before launch day.
        </p>

        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={e => { setCode(e.target.value); setState('idle') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="_ _ _ _"
          maxLength={4}
          autoFocus
          style={{
            width: '100%', padding: '18px 20px',
            borderRadius: 16, fontSize: 28, fontWeight: 700,
            textAlign: 'center', letterSpacing: '12px',
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
            Invalid code — try again.
          </p>
        )}
        {state === 'success' && (
          <p style={{ color: '#30D158', fontSize: 13, marginTop: 10 }}>
            ✓ Access granted! Welcome to TripAlong.
          </p>
        )}

        <button
          onClick={submit}
          disabled={code.length === 0 || state === 'success'}
          style={{
            marginTop: 16, width: '100%', padding: '16px 0',
            borderRadius: 18, fontWeight: 700, fontSize: 16,
            backgroundColor: state === 'success' ? '#30D158' : '#F0EBE3',
            color: '#000', border: 'none',
            cursor: code.length === 0 || state === 'success' ? 'default' : 'pointer',
            opacity: code.length === 0 ? 0.4 : 1,
            transition: 'opacity 0.2s, background-color 0.3s',
          }}
        >
          {state === 'success' ? 'Welcome! ✓' : 'Enter →'}
        </button>
      </div>
    </main>
  )
}
