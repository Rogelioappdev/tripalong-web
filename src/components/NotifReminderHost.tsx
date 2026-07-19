'use client'

// Single global host for the "turn on notifications" reminder toast. Mounted
// once in the protected layout; listens for remindNotifications() events and
// shows a small top toast — only when notifications aren't granted, and at most
// once per trigger every few days. Tapping "Turn on" launches the real
// permission flow (NotificationPrompt), which handles web + native.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getNotificationStatusAsync } from '@/lib/push'
import { haptic } from '@/lib/haptics'
import type { NotifTrigger } from '@/lib/notifReminder'
import { NotificationPrompt } from './NotificationPrompt'

const MESSAGES: Record<NotifTrigger, string> = {
  message: 'Turn on notifications to know when people respond',
  'create-trip': 'Turn on notifications to know when someone joins your trip',
  'join-trip': "Turn on notifications so you don't miss the group chat",
}

const THROTTLE_MS = 3 * 24 * 60 * 60 * 1000 // don't re-nudge the same trigger for 3 days

export function NotifReminderHost() {
  const [active, setActive] = useState<NotifTrigger | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const trigger = (e as CustomEvent).detail as NotifTrigger
      if (!trigger || active) return
      const key = `notif_reminder_${trigger}`
      let last = 0
      try { last = Number(localStorage.getItem(key) || 0) } catch {}
      if (Date.now() - last < THROTTLE_MS) return
      getNotificationStatusAsync().then(status => {
        if (status === 'granted' || status === 'unsupported') return
        try { localStorage.setItem(key, String(Date.now())) } catch {}
        setActive(trigger)
      })
    }
    window.addEventListener('ta:notif-reminder', handler)
    return () => window.removeEventListener('ta:notif-reminder', handler)
  }, [active])

  // Auto-dismiss if ignored.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(null), 8000)
    return () => clearTimeout(t)
  }, [active])

  // Guard SSR/prerender — document isn't available on the server.
  if (typeof document === 'undefined') return null

  if (showPrompt && userId) {
    return <NotificationPrompt userId={userId} onDone={() => { setShowPrompt(false); setActive(null) }} />
  }

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -70, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          style={{
            position: 'fixed',
            left: 12, right: 12,
            top: 'calc(env(safe-area-inset-top) + 10px)',
            zIndex: 250,
          }}
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.55)' }}
          >
            <span style={{ fontSize: 20 }}>🔔</span>
            <p className="flex-1 text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {MESSAGES[active]}
            </p>
            <button
              type="button"
              onClick={() => { haptic(10); setShowPrompt(true) }}
              className="shrink-0 font-semibold text-[13px] px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
              style={{ background: '#F0EBE3', color: '#000' }}
            >
              Turn on
            </button>
            <button
              type="button"
              onClick={() => { haptic(6); setActive(null) }}
              className="shrink-0 text-white/30 px-1"
              style={{ fontSize: 16 }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
