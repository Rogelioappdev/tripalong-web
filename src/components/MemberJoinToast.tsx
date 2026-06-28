'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { haptic } from '@/lib/haptics'

export interface JoinEvent {
  id: string
  name: string
  photo: string | null
  destination: string
}

interface Props {
  userId: string
}

export function MemberJoinToast({ userId }: Props) {
  const [toasts, setToasts] = useState<JoinEvent[]>([])
  const tripMapRef = useRef<Map<string, string>>(new Map()) // tripId → destination
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  // Preload trip map so realtime handler can resolve destination instantly
  useEffect(() => {
    supabase
      .from('trip_members')
      .select('trip_id, trips(destination)')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return
        const map = new Map<string, string>()
        ;(data as any[]).forEach(row => {
          if (row.trip_id && row.trips?.destination) {
            map.set(row.trip_id, row.trips.destination)
          }
        })
        tripMapRef.current = map
      })
  }, [userId])

  // Realtime subscription — watch for new trip_members rows
  useEffect(() => {
    const channel = supabase
      .channel(`member-joins:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_members' },
        async (payload) => {
          const row = payload.new as { user_id: string; trip_id: string }
          if (row.user_id === userId) return // ignore own joins
          const destination = tripMapRef.current.get(row.trip_id)
          if (!destination) return // not a trip we're on

          const { data: profile } = await supabase
            .from('users')
            .select('name, profile_photo')
            .eq('id', row.user_id)
            .single()

          if (!profile) return

          const toast: JoinEvent = {
            id: `${row.user_id}-${row.trip_id}-${Date.now()}`,
            name: (profile as any).name ?? 'Someone',
            photo: (profile as any).profile_photo ?? null,
            destination,
          }

          haptic(10)
          setToasts(prev => [...prev.slice(-2), toast])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
              {/* Avatar */}
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

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, margin: 0, lineHeight: 1.3, letterSpacing: '-0.1px' }}>
                  {toast.name} joined your trip ✈️
                </p>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toast.destination}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
