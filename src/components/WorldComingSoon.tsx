'use client'

import { useState, useRef } from 'react'
import { haptic } from '@/lib/haptics'

// Public placeholder for the TripAlong World tab while it's gated. Everyone sees
// "being built". Tapping the 🌍 globe 10 times within 10 seconds reveals a
// 4-digit access-code prompt; the correct code unlocks the real globe for that
// device (persisted by the parent in localStorage).
const ACCESS_CODE = '0707'
const TAPS_NEEDED = 10
const TAP_WINDOW_MS = 10_000

export function WorldComingSoon({ onUnlock }: { onUnlock: () => void }) {
  const [showCode, setShowCode] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const tapsRef = useRef<number[]>([])

  const registerTap = () => {
    const now = Date.now()
    // Keep only taps within the rolling 10s window.
    tapsRef.current = tapsRef.current.filter(t => now - t < TAP_WINDOW_MS)
    tapsRef.current.push(now)
    haptic(3)
    if (tapsRef.current.length >= TAPS_NEEDED) {
      tapsRef.current = []
      haptic(18)
      setShowCode(true)
    }
  }

  const check = (val: string) => {
    if (val === ACCESS_CODE) {
      haptic(24)
      onUnlock()
    } else {
      haptic(6)
      setError(true)
      setTimeout(() => { setError(false); setCode('') }, 550)
    }
  }

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    setCode(digits)
    setError(false)
    if (digits.length === 4) check(digits)
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Tap the globe 10× within 10s to reveal the code entry. */}
      <button
        type="button"
        aria-hidden="true"
        onClick={registerTap}
        className="text-5xl mb-5 select-none"
        style={{ background: 'transparent', padding: 12, WebkitTapHighlightColor: 'transparent' }}
      >
        🌍
      </button>
      <h1 className="text-[#F0EBE3] text-2xl font-semibold tracking-tight mb-2">TripAlong World</h1>
      <p className="text-white/45 text-sm max-w-xs leading-relaxed">
        A whole new way to explore trips is currently being built. Check back soon.
      </p>

      {showCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => { setShowCode(false); setCode(''); setError(false) }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-3xl px-6 py-7 flex flex-col items-center"
            style={{ width: 240, background: '#0c0c0c', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <p className="text-white/50 text-[11px] tracking-[0.2em] mb-4">ACCESS CODE</p>
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => onChange(e.target.value)}
              maxLength={4}
              placeholder="••••"
              className="w-full text-center bg-transparent outline-none"
              style={{
                fontSize: 26,
                letterSpacing: '0.55em',
                paddingLeft: '0.55em',
                color: error ? '#ff6b6b' : '#F0EBE3',
                caretColor: '#F0EBE3',
              }}
            />
            <div
              className="h-px w-full mt-2 transition-colors"
              style={{ background: error ? '#ff6b6b' : 'rgba(255,255,255,0.18)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
