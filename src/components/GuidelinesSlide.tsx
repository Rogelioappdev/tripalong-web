'use client'

import { motion } from 'framer-motion'
import { Playfair_Display } from 'next/font/google'
import { haptic } from '@/lib/haptics'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '800', '900'] })

export const GUIDELINES = [
  { icon: '🤝', text: 'Be respectful — treat every traveler the way you\'d want to be treated' },
  { icon: '🚫', text: 'No harassment, hate speech, or inappropriate messages' },
  { icon: '📍', text: 'Meet in public places for your first meet-up with a new travel companion' },
  { icon: '🎭', text: 'Be yourself — fake profiles or impersonation will get you banned' },
  { icon: '🚨', text: 'Report anything that feels off — we review every report' },
]

interface GuidelinesSlideProps {
  onAgree: () => void
  onBack?: () => void
}

export function GuidelinesSlide({ onAgree, onBack }: GuidelinesSlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: '#000',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 26px',
        paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
        Community Guidelines
      </p>
      <h2 className={playfair.className} style={{
        fontSize: 'clamp(24px, 6.5vw, 34px)',
        fontWeight: 900, lineHeight: 1.12,
        color: '#fff', marginBottom: 20,
      }}>
        A few rules to<br />
        <span style={{ color: '#F0EBE3' }}>keep everyone safe.</span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 22 }}>
        {GUIDELINES.map((g, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.28 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
          >
            <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{g.icon}</span>
            <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
              {g.text}
            </p>
          </motion.div>
        ))}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, lineHeight: 1.5, marginBottom: 18 }}>
        By continuing, you agree to our Community Guidelines,{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(240,235,227,0.6)', textDecoration: 'underline' }}>
          Privacy Policy
        </a>{' '}and{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(240,235,227,0.6)', textDecoration: 'underline' }}>
          Terms of Service
        </a>.
      </p>

      <button
        onClick={() => { haptic(12); onAgree() }}
        style={{
          width: '100%', padding: '15px 0', borderRadius: 18,
          fontWeight: 700, fontSize: 15.5,
          backgroundColor: '#F0EBE3', color: '#000',
          border: 'none', cursor: 'pointer', letterSpacing: '-0.1px',
          marginBottom: onBack ? 10 : 0,
        }}
      >
        I agree — let's go ✓
      </button>
      {onBack && (
        <button
          onClick={() => { haptic(4); onBack() }}
          style={{
            width: '100%', padding: '10px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: 500,
          }}
        >
          ← Back
        </button>
      )}
    </motion.div>
  )
}
