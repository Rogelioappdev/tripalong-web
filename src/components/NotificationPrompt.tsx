'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
  onDone: () => void
}

export function NotificationPrompt({ userId, onDone }: Props) {
  const [loading, setLoading] = useState(false)

  if (typeof window === 'undefined') return null

  const handleAllow = async () => {
    haptic([10, 30, 10])

    // No Notification API at all (old iOS Safari without PWA)
    if (!('Notification' in window)) {
      onDone()
      return
    }

    setLoading(true)
    try {
      // Notification.requestPermission() MUST be the first await after the tap —
      // browsers reject it if called after other awaits (breaks user-gesture chain)
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        // Service worker + subscription in background — don't block UI
        registerInBackground(userId)
      }
    } catch {
      // Silently swallow — some browsers throw on unsupported devices
    }

    onDone()
  }

  const handleSkip = () => {
    haptic(6)
    onDone()
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        backgroundColor: '#000',
        display: 'flex', flexDirection: 'column',
        padding: '0 28px',
        paddingTop: 'calc(env(safe-area-inset-top) + 48px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 36px)',
      }}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          width: 88, height: 88, borderRadius: 26,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, fontSize: 44,
        }}
      >
        ✈️
      </motion.div>

      {/* Copy */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        style={{ flex: 1 }}
      >
        <h1 style={{
          color: '#fff', fontWeight: 800, fontSize: 32,
          lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 16,
        }}>
          Don't miss your<br />next trip.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
          Get notified when someone joins your trip, sends you a message, or a new match appears.
        </p>

        {/* What you'll get */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
          {[
            { icon: '💬', text: 'New messages from your travel group' },
            { icon: '🧳', text: "Someone joins a trip you're on" },
            { icon: '🌍', text: 'New trips that match your style' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                {icon}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.4, margin: 0 }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <button
          type="button"
          onClick={handleAllow}
          disabled={loading}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 18,
            fontWeight: 700, fontSize: 16,
            backgroundColor: loading ? 'rgba(240,235,227,0.5)' : '#F0EBE3',
            color: '#000', border: 'none', cursor: 'pointer', letterSpacing: '-0.1px',
            transition: 'background-color 0.15s',
          }}
        >
          {loading ? 'One sec...' : 'Turn on notifications'}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          style={{
            width: '100%', padding: '12px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 500,
          }}
        >
          Maybe later
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// Runs after permission granted — doesn't block the UI
async function registerInBackground(userId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    const existing = await reg.pushManager.getSubscription()
    const subscription = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const sub = subscription.toJSON()
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
      }),
    })

    localStorage.setItem('push_registered', '1')
  } catch {
    // Silent — subscription failure shouldn't affect the user
  }
}
