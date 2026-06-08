'use client'

import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { getPushState, registerPush } from '@/lib/push'
import { haptic } from '@/lib/haptics'

interface Props {
  userId: string
  onDone: () => void
}

export function NotificationPrompt({ userId, onDone }: Props) {
  if (typeof window === 'undefined') return null

  const handleAllow = async () => {
    haptic([10, 30, 10])
    await registerPush(userId)
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
            { icon: '🧳', text: 'Someone joins a trip you\'re on' },
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
          style={{
            width: '100%', padding: '16px 0', borderRadius: 18,
            fontWeight: 700, fontSize: 16,
            backgroundColor: '#F0EBE3', color: '#000',
            border: 'none', cursor: 'pointer', letterSpacing: '-0.1px',
          }}
        >
          Turn on notifications
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
