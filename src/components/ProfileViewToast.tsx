'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { getMyViewerCount, getProfileViewers } from '@/lib/queries'

interface ViewToast {
  id: string
  name: string
  photo: string | null
}

interface Props {
  userId: string
}

// Polling instead of a postgres_changes subscription — Realtime delivery has
// proven unreliable for this project (see the DM/chat sync fixes), so a
// short poll on the real view count is the dependable way to detect a new
// view and show an in-app toast for it.
const POLL_MS = 12_000

export function ProfileViewToast({ userId }: Props) {
  const [toasts, setToasts] = useState<ViewToast[]>([])
  const lastCountRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const count = await getMyViewerCount()
      if (cancelled) return
      if (lastCountRef.current !== null && count > lastCountRef.current) {
        // getProfileViewers is Plus/trial-gated and comes back empty for free
        // users — still show a generic toast (no name/photo) so free users
        // get the same "someone's interested" nudge, just without identity.
        const viewers = await getProfileViewers(1)
        if (!cancelled) {
          haptic(10)
          setToasts(prev => [...prev.slice(-2), {
            id: `view-${Date.now()}`,
            name: viewers[0]?.name ?? 'Someone',
            photo: viewers[0]?.profile_photo ?? null,
          }])
        }
      }
      lastCountRef.current = count
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [userId])

  // Auto-dismiss newest toast after 4s
  useEffect(() => {
    if (!toasts.length) return
    if (timerRef.current) clearTimeout(timerRef.current)
    const latest = toasts[toasts.length - 1]
    timerRef.current = setTimeout(() => dismiss(latest.id), 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toasts])

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 10px)',
        left: 12, right: 12,
        zIndex: 500,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ y: -72, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -72, opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => { haptic(6); dismiss(toast.id) }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 14px 10px 10px',
              background: 'rgba(26,26,28,0.96)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 22,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                overflow: 'hidden', flexShrink: 0,
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {toast.photo ? (
                  <img src={toast.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 16 }}>
                    {toast.name[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, margin: 0, lineHeight: 1.3, letterSpacing: '-0.1px' }}>
                  {toast.name} viewed your profile 👀
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
