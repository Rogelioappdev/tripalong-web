'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { haptic } from '@/lib/haptics'

interface Props {
  onDone: () => void
}

// ── Step 1: large realistic swipe card demo ───────────────────────────────────
function SwipeCardDemo() {
  const controls = useAnimationControls()
  const [stamp, setStamp] = useState<'save' | 'pass' | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, 900))
        if (cancelled) break
        // swipe right → SAVE
        setStamp('save')
        await controls.start({ x: 280, rotate: 18, opacity: 0, transition: { duration: 0.5, ease: [0.32, 0, 0.67, 0] } })
        if (cancelled) break
        setStamp(null)
        await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0 } })
        await new Promise(r => setTimeout(r, 700))
        if (cancelled) break
        // swipe left → PASS
        setStamp('pass')
        await controls.start({ x: -280, rotate: -18, opacity: 0, transition: { duration: 0.5, ease: [0.32, 0, 0.67, 0] } })
        if (cancelled) break
        setStamp(null)
        await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0 } })
      }
    }
    run()
    return () => { cancelled = true }
  }, [controls])

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto' }}>
      {/* Back card */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.06)',
        transform: 'scale(0.94) translateY(12px) rotate(4deg)',
      }} />
      {/* Main card */}
      <motion.div
        animate={controls}
        style={{
          position: 'relative', borderRadius: 24,
          overflow: 'hidden', aspectRatio: '3/4',
          border: stamp === 'save'
            ? '2.5px solid #30D158'
            : stamp === 'pass'
            ? '2.5px solid #FF453A'
            : '1px solid rgba(255,255,255,0.1)',
          backgroundColor: '#111',
          boxShadow: stamp === 'save'
            ? '0 0 28px rgba(48,209,88,0.25)'
            : stamp === 'pass'
            ? '0 0 28px rgba(255,69,58,0.25)'
            : '0 8px 40px rgba(0,0,0,0.5)',
          transition: 'border-color 0.12s, box-shadow 0.12s',
        }}
      >
        {/* Photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/trip-images/asia/bali/bali04.png"
          alt="Bali"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.85) 100%)',
        }} />
        {/* Trip info */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bali, Indonesia</p>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', lineHeight: 1 }}>Bali</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 4 }}>Aug 12 – Aug 20 · 4 travelers</p>
        </div>

        {/* SAVE stamp */}
        <motion.div
          animate={{ opacity: stamp === 'save' ? 1 : 0, scale: stamp === 'save' ? 1 : 0.7 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'absolute', top: 20, right: 16, zIndex: 10,
            border: '3px solid #30D158', borderRadius: 8, padding: '4px 14px',
            transform: 'rotate(12deg)',
          }}
        >
          <span style={{ color: '#30D158', fontWeight: 900, fontSize: 18, letterSpacing: '0.05em' }}>SAVE</span>
        </motion.div>

        {/* PASS stamp */}
        <motion.div
          animate={{ opacity: stamp === 'pass' ? 1 : 0, scale: stamp === 'pass' ? 1 : 0.7 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'absolute', top: 20, left: 16, zIndex: 10,
            border: '3px solid #FF453A', borderRadius: 8, padding: '4px 14px',
            transform: 'rotate(-12deg)',
          }}
        >
          <span style={{ color: '#FF453A', fontWeight: 900, fontSize: 18, letterSpacing: '0.05em' }}>PASS</span>
        </motion.div>
      </motion.div>

      {/* Swipe labels below card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '0 4px' }}>
        <span style={{ color: 'rgba(255,69,58,0.7)', fontSize: 12, fontWeight: 700 }}>← Pass</span>
        <span style={{ color: 'rgba(48,209,88,0.7)', fontSize: 12, fontWeight: 700 }}>Save →</span>
      </div>
    </div>
  )
}

// ── Step 2 & 3: mini feed header mock with one button glowing ─────────────────
function FeedHeaderMock({ highlight }: { highlight: 'saved' | 'create' }) {
  return (
    <div style={{
      width: '100%',
      backgroundColor: '#0a0a0a',
      borderRadius: 18,
      border: '0.5px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 12px',
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.4px' }}>TripAlong</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bookmark button */}
          <motion.div
            animate={highlight === 'saved' ? {
              boxShadow: ['0 0 0px rgba(240,235,227,0)', '0 0 14px rgba(240,235,227,0.6)', '0 0 0px rgba(240,235,227,0)'],
              scale: [1, 1.15, 1],
            } : {}}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              backgroundColor: highlight === 'saved' ? 'rgba(240,235,227,0.15)' : 'rgba(255,255,255,0.06)',
              border: highlight === 'saved' ? '1.5px solid rgba(240,235,227,0.5)' : '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                stroke={highlight === 'saved' ? '#F0EBE3' : 'rgba(255,255,255,0.3)'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>

          {/* Create Trip pill */}
          <motion.div
            animate={highlight === 'create' ? {
              boxShadow: ['0 0 0px rgba(240,235,227,0)', '0 0 16px rgba(240,235,227,0.55)', '0 0 0px rgba(240,235,227,0)'],
              scale: [1, 1.08, 1],
            } : {}}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              borderRadius: 24, paddingLeft: 10, paddingRight: 12, height: 32,
              backgroundColor: highlight === 'create' ? 'rgba(240,235,227,0.15)' : 'rgba(255,255,255,0.06)',
              border: highlight === 'create' ? '1.5px solid rgba(240,235,227,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14"
                stroke={highlight === 'create' ? '#F0EBE3' : 'rgba(255,255,255,0.3)'}
                strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: highlight === 'create' ? '#F0EBE3' : 'rgba(255,255,255,0.3)',
            }}>
              Create Trip
            </span>
          </motion.div>
        </div>
      </div>

      {/* Bouncing arrow + label */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        paddingRight: highlight === 'saved' ? 42 : 12,
        paddingBottom: 14, paddingLeft: 16,
      }}>
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <span style={{ color: '#F0EBE3', fontSize: 13, fontWeight: 700 }}>
            {highlight === 'saved' ? 'Your saved trips' : 'Create a trip'}
          </span>
          <span style={{ color: '#F0EBE3', fontSize: 16 }}>↑</span>
        </motion.div>
      </div>

      {/* Faded card peek */}
      <div style={{
        margin: '0 12px 12px', borderRadius: 14, height: 72,
        background: 'linear-gradient(135deg, #1e3a4a 0%, #0d2435 100%)',
        opacity: 0.45, display: 'flex', alignItems: 'flex-end', padding: 10,
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8 }}>bali, indonesia</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 13 }}>Bali</p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function FeedTutorial({ onDone }: Props) {
  const [step, setStep] = useState(0)

  const next = () => {
    haptic(8)
    if (step < 2) {
      setStep(s => s + 1)
    } else {
      onDone()
    }
  }

  const isSwipeStep = step === 0

  const content = (
    <AnimatePresence mode="wait">
      <motion.div
        key={step === 0 ? 'transparent' : 'dark'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: isSwipeStep ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.88)',
          backdropFilter: isSwipeStep ? 'none' : 'blur(6px)',
          WebkitBackdropFilter: isSwipeStep ? 'none' : 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 16px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        } as React.CSSProperties}
      >
        {/* ── Step 1 only: large animated swipe card demo ── */}
        {isSwipeStep && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{
              position: 'absolute', left: 16, right: 16,
              top: 'calc(env(safe-area-inset-top) + 16px)',
              bottom: 'calc(env(safe-area-inset-bottom) + 260px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <SwipeCardDemo />
          </motion.div>
        )}

        {/* ── Bottom sheet ── */}
        <motion.div
          key={`sheet-${step}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          style={{
            width: '100%', maxWidth: 400, alignSelf: 'center',
            backgroundColor: isSwipeStep ? 'rgba(10,10,10,0.92)' : '#111',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 28,
            padding: isSwipeStep ? '22px 24px 20px' : '28px 24px 24px',
            display: 'flex', flexDirection: 'column', gap: 18,
            backdropFilter: isSwipeStep ? 'blur(20px)' : 'none',
            WebkitBackdropFilter: isSwipeStep ? 'blur(20px)' : 'none',
          } as React.CSSProperties}
        >
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                height: 4, borderRadius: 2,
                width: i === step ? 24 : 6,
                backgroundColor: i === step ? '#F0EBE3' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>

          {/* Demo visual — only for steps 2 & 3 */}
          {!isSwipeStep && (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FeedHeaderMock highlight={step === 1 ? 'saved' : 'create'} />
              </motion.div>
            </AnimatePresence>
          )}

          {/* Text */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 8 }}>
              {step === 0 ? 'Swipe to explore' : step === 1 ? 'Your saved trips' : 'Create your own trip'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, lineHeight: 1.6 }}>
              {step === 0
                ? 'Swipe right to save a trip, left to pass. Every trip you save goes to your saved list.'
                : step === 1
                ? 'Every trip you save appears here. Tap any saved trip to join their group chat and start planning.'
                : 'Have a trip in mind? Post it and let travelers find you. Your people are out there.'}
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
            {step < 2 ? 'Next →' : "Let's go →"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}
