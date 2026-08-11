'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'

interface Props {
  onClose: () => void
  onApplied?: (creatorName?: string) => void
}

export function CreatorCodeSheet({ onClose, onApplied }: Props) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<'input' | 'loading' | 'done'>('input')
  const [error, setError] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState<string | null>(null)

  const submit = async () => {
    if (!code.trim() || state === 'loading') return
    haptic(10)
    setState('loading')
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in first.')
      const res = await fetch('/api/creator-code/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Could not apply that code.')

      track('creator_code_applied', { already_attributed: !!body.alreadyAttributed })
      setCreatorName(body.creatorName ?? null)
      setState('done')
      haptic(16)
      setTimeout(() => { onApplied?.(body.creatorName); onClose() }, 1400)
    } catch (err: any) {
      setState('input')
      setError(err?.message ?? 'Could not apply that code.')
    }
  }

  const content = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center">
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full sm:max-w-sm"
        style={{
          backgroundColor: '#0A0A0A',
          borderTop: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: '28px 28px 0 0',
          padding: '10px 24px calc(env(safe-area-inset-bottom) + 24px)',
        }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-1 pb-5">
          <div className="w-8 h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </div>

        {state === 'done' ? (
          <div className="text-center" style={{ paddingBottom: 12 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
            <p className="text-white font-bold" style={{ fontSize: 18 }}>
              {creatorName ? `${creatorName}'s code applied` : 'Code applied'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5, marginTop: 4 }}>
              Thanks for supporting them.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-white font-extrabold" style={{ fontSize: 21, letterSpacing: '-0.3px' }}>
              Got a creator code?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, marginTop: 5, lineHeight: 1.5 }}>
              If a creator sent you here, enter their code so they get credit for it.
            </p>

            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="MAYA"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="w-full mt-4 px-4 py-3.5 rounded-2xl text-white font-bold outline-none"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: `1px solid ${error ? 'rgba(255,69,58,0.5)' : 'rgba(255,255,255,0.12)'}`,
                fontSize: 17, letterSpacing: '0.06em',
              }}
            />

            {error && (
              <p style={{ color: '#FF453A', fontSize: 12.5, marginTop: 8 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!code.trim() || state === 'loading'}
              className="w-full mt-4 py-4 rounded-2xl font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000', fontSize: 15 }}
            >
              {state === 'loading' ? 'Applying…' : 'Apply code'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-center py-3 active:opacity-60"
              style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13.5 }}
            >
              I don&rsquo;t have one
            </button>
          </>
        )}
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
