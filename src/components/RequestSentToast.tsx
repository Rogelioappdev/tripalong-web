'use client'

import { motion } from 'framer-motion'

// Light confirmation toast shown right after requesting to join a full trip —
// mirrors MemberJoinToast's floating-pill style so it reads as "the same kind
// of notification" as the rest of the app, not a one-off alert. Reused as-is
// (via the message prop) for the creator's "X accepted to Y" confirmation.
export function RequestSentToast({ message = 'Request sent!' }: { message?: string }) {
  return (
    <motion.div
      initial={{ x: '-50%', y: -60, opacity: 0, scale: 0.9 }}
      animate={{ x: '-50%', y: 0, opacity: 1, scale: 1 }}
      exit={{ x: '-50%', y: -60, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 10px)',
        left: '50%',
        zIndex: 500,
        pointerEvents: 'none',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 18px 11px 12px',
        background: 'rgba(26,26,28,0.96)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 22,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          backgroundColor: '#30D158', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.1px' }}>{message}</span>
      </div>
    </motion.div>
  )
}
