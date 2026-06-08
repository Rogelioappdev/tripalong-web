'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
  onDone: () => void
}

type State = 'prompt' | 'loading' | 'denied' | 'unsupported' | 'success'

export function NotificationPrompt({ userId, onDone }: Props) {
  const [state, setState] = useState<State>('prompt')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    // Already denied from a previous session — show instructions instead
    if (Notification.permission === 'denied') {
      setState('denied')
    }
  }, [])

  if (typeof window === 'undefined') return null

  const handleAllow = async () => {
    haptic([10, 30, 10])
    setState('loading')
    try {
      // Must be first await — preserves user-gesture chain for browser permission dialog
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        registerInBackground(userId)
        setState('success')
        setTimeout(onDone, 1400)
      } else {
        setState('denied')
      }
    } catch {
      setState('denied')
    }
  }

  const handleSkip = () => { haptic(6); onDone() }

  const isIOS = /iphone|ipad/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const isChrome = /chrome/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') && !/edg/i.test(navigator.userAgent)

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
        transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          width: 88, height: 88, borderRadius: 26,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, fontSize: 44,
        }}
      >
        {state === 'success' ? '✅' : state === 'denied' ? '🔕' : '✈️'}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4 }}
        style={{ flex: 1 }}
      >
        {/* DENIED — browser blocked, show fix instructions */}
        {state === 'denied' && (
          <>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 14 }}>
              Notifications are blocked.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
              You blocked notifications for this site. To enable them:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isIOS ? (
                <>
                  <Step n={1} text='Open iPhone Settings → Safari' />
                  <Step n={2} text='Tap "Advanced" → "Website Data"' />
                  <Step n={3} text='Or: Settings → Notifications → Safari → Allow' />
                </>
              ) : isChrome ? (
                <>
                  <Step n={1} text='Tap the lock icon 🔒 in the address bar' />
                  <Step n={2} text='Tap "Site Settings" → "Notifications"' />
                  <Step n={3} text='Change from "Block" to "Allow", then reload' />
                </>
              ) : (
                <>
                  <Step n={1} text='Open your browser settings' />
                  <Step n={2} text='Find "Notifications" or "Site Permissions"' />
                  <Step n={3} text='Find TripAlong and set to "Allow"' />
                </>
              )}
            </div>
          </>
        )}

        {/* UNSUPPORTED */}
        {state === 'unsupported' && (
          <>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 14 }}>
              Add to Home Screen first.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.65 }}>
              On iPhone, notifications work when TripAlong is installed. Tap the Share button → "Add to Home Screen", then open from there.
            </p>
          </>
        )}

        {/* SUCCESS */}
        {state === 'success' && (
          <>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 14 }}>
              You're all set! 🎉
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.65 }}>
              We'll notify you when someone joins your trip or sends a message.
            </p>
          </>
        )}

        {/* DEFAULT PROMPT */}
        {(state === 'prompt' || state === 'loading') && (
          <>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 16 }}>
              Don't miss your<br />next trip.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
              Get notified when someone joins your trip, sends you a message, or a new match appears.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>{icon}</div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.4, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}
      >
        {state === 'denied' && (
          <button type="button" onClick={handleSkip}
            style={{ width: '100%', padding: '16px 0', borderRadius: 18, fontWeight: 700, fontSize: 16, backgroundColor: '#F0EBE3', color: '#000', border: 'none', cursor: 'pointer' }}>
            Got it
          </button>
        )}
        {state === 'unsupported' && (
          <button type="button" onClick={handleSkip}
            style={{ width: '100%', padding: '16px 0', borderRadius: 18, fontWeight: 700, fontSize: 16, backgroundColor: '#F0EBE3', color: '#000', border: 'none', cursor: 'pointer' }}>
            Got it
          </button>
        )}
        {(state === 'prompt' || state === 'loading') && (
          <>
            <button type="button" onClick={handleAllow} disabled={state === 'loading'}
              style={{ width: '100%', padding: '16px 0', borderRadius: 18, fontWeight: 700, fontSize: 16, backgroundColor: state === 'loading' ? 'rgba(240,235,227,0.5)' : '#F0EBE3', color: '#000', border: 'none', cursor: 'pointer' }}>
              {state === 'loading' ? 'One sec...' : 'Turn on notifications'}
            </button>
            <button type="button" onClick={handleSkip}
              style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 500 }}>
              Maybe later
            </button>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(240,235,227,0.12)', border: '1px solid rgba(240,235,227,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: '#F0EBE3', fontSize: 11, fontWeight: 700 }}>{n}</span>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  )
}

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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId, endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth }),
    })
    localStorage.setItem('push_registered', '1')
  } catch {}
}
