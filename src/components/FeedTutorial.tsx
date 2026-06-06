'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { haptic } from '@/lib/haptics'

interface Props {
  onDone: () => void
}

const STEPS = [
  {
    title: 'Swipe to explore',
    body: 'Swipe right to save a trip, left to pass. Every trip you save goes to your saved list.',
  },
  {
    title: 'Saved trips',
    body: 'Every trip you save appears here. Tap any saved trip to join their group chat and start planning together.',
  },
  {
    title: 'Create your own trip',
    body: 'Have a trip in mind? Post it and let travelers find you. Your people are out there.',
  },
]

// ── Step 1: animated swipe demo card ─────────────────────────────────────────
function SwipeDemo() {
  const controls = useAnimationControls()
  const [stamp, setStamp] = useState<'save' | 'pass' | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      while (!cancelled) {
        // pause at center
        await new Promise(r => setTimeout(r, 800))
        if (cancelled) break
        // swipe right → save
        setStamp('save')
        await controls.start({ x: 120, rotate: 12, opacity: 0, transition: { duration: 0.45, ease: 'easeIn' } })
        if (cancelled) break
        setStamp(null)
        await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0 } })
        await new Promise(r => setTimeout(r, 700))
        if (cancelled) break
        // swipe left → pass
        setStamp('pass')
        await controls.start({ x: -120, rotate: -12, opacity: 0, transition: { duration: 0.45, ease: 'easeIn' } })
        if (cancelled) break
        setStamp(null)
        await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0 } })
      }
    }
    run()
    return () => { cancelled = true }
  }, [controls])

  return (
    <div style={{ position: 'relative', width: 160, height: 210, margin: '0 auto 8px' }}>
      {/* Back card hint */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        transform: 'scale(0.92) translateY(10px) rotate(3deg)',
      }} />
      {/* Main card */}
      <motion.div
        animate={controls}
        style={{
          position: 'absolute', inset: 0, borderRadius: 18,
          backgroundColor: '#1a1a1a',
          border: stamp === 'save'
            ? '2px solid #30D158'
            : stamp === 'pass'
            ? '2px solid #FF453A'
            : '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Mock trip card */}
        <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e3a4a 0%, #0d2435 100%)' }} />
        <div style={{ padding: '10px 12px' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginBottom: 2 }}>bali, indonesia</p>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px' }}>Bali</p>
        </div>

        {/* SAVE stamp */}
        <div style={{
          position: 'absolute', top: 12, right: 10, zIndex: 10,
          border: '2px solid #30D158', borderRadius: 6, padding: '2px 8px',
          transform: 'rotate(15deg)',
          opacity: stamp === 'save' ? 1 : 0, transition: 'opacity 0.1s',
        }}>
          <span style={{ color: '#30D158', fontWeight: 900, fontSize: 12 }}>SAVE</span>
        </div>

        {/* PASS stamp */}
        <div style={{
          position: 'absolute', top: 12, left: 10, zIndex: 10,
          border: '2px solid #FF453A', borderRadius: 6, padding: '2px 8px',
          transform: 'rotate(-15deg)',
          opacity: stamp === 'pass' ? 1 : 0, transition: 'opacity 0.1s',
        }}>
          <span style={{ color: '#FF453A', fontWeight: 900, fontSize: 12 }}>PASS</span>
        </div>
      </motion.div>

      {/* Swipe arrows */}
      <div style={{
        position: 'absolute', bottom: -28, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', padding: '0 8px',
      }}>
        <span style={{ color: 'rgba(255,69,58,0.6)', fontSize: 11, fontWeight: 600 }}>← Pass</span>
        <span style={{ color: 'rgba(48,209,88,0.6)', fontSize: 11, fontWeight: 600 }}>Save →</span>
      </div>
    </div>
  )
}

// ── Step 2: saved trips icon highlight ───────────────────────────────────────
function SavedDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
      <motion.div
        animate={{ scale: [1, 1.12, 1], boxShadow: ['0 0 0px rgba(240,235,227,0)', '0 0 20px rgba(240,235,227,0.35)', '0 0 0px rgba(240,235,227,0)'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: 'rgba(240,235,227,0.1)',
          border: '1.5px solid rgba(240,235,227,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
            stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </motion.div>
      {/* Mock saved trip rows */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Bali, Indonesia', 'Tokyo, Japan'].map((dest, i) => (
          <motion.div
            key={dest}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.35 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <div>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{dest}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>Tap to join group chat</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Step 3: create trip button highlight ─────────────────────────────────────
function CreateDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
      <motion.div
        animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0px rgba(240,235,227,0)', '0 0 24px rgba(240,235,227,0.4)', '0 0 0px rgba(240,235,227,0)'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </motion.div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Find it in the bottom navigation</p>
      </div>
    </div>
  )
}

const DEMOS = [<SwipeDemo key="swipe" />, <SavedDemo key="saved" />, <CreateDemo key="create" />]

// ── Main component ────────────────────────────────────────────────────────────
export function FeedTutorial({ onDone }: Props) {
  const [step, setStep] = useState(0)

  const next = () => {
    haptic(8)
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      onDone()
    }
  }

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
      } as React.CSSProperties}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        style={{
          width: '100%', maxWidth: 400,
          backgroundColor: '#111',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 28,
          padding: '28px 24px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 4, borderRadius: 2,
              width: i === step ? 24 : 6,
              backgroundColor: i === step ? '#F0EBE3' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Demo visual */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {DEMOS[step]}
          </motion.div>
        </AnimatePresence>

        {/* Text */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 8 }}>
            {STEPS[step].title}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, lineHeight: 1.6 }}>
            {STEPS[step].body}
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={next}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 18,
            fontWeight: 700, fontSize: 15,
            background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)',
            color: '#000', border: 'none', cursor: 'pointer',
          }}
        >
          {step < STEPS.length - 1 ? 'Next →' : "Let's go →"}
        </button>
      </motion.div>
    </motion.div>
  )

  return createPortal(content, document.body)
}
