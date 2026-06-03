'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { claimFoundingTrial } from '@/lib/trial'
import { registerPush } from '@/lib/push'
import type { UserProfile } from '@/lib/types'

interface Props {
  userId: string
  profile: UserProfile
  onClaimed: (updatedProfile: UserProfile) => void
  onDismiss: () => void
}

const SLIDES = [
  {
    icon: '🌍',
    title: 'Welcome, Founding Member',
    sub: "You're one of TripAlong's first travelers. We're giving you 7 days of Plus — free. No card, no catch.",
  },
  {
    icon: '∞',
    title: 'Unlimited swipes',
    sub: 'Swipe through every trip in the feed with no daily walls and no waiting until tomorrow.',
  },
  {
    icon: '👁',
    title: 'See who viewed your profile',
    sub: 'Real travelers are already checking you out. Plus shows you exactly who they are.',
  },
]

function OnboardingSlides({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const last = idx === SLIDES.length - 1
  const slide = SLIDES[idx]

  return (
    <motion.div
      key="onboarding"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="flex flex-col items-center justify-between h-full px-7 pt-10 pb-10"
    >
      {/* Progress dots */}
      <div className="flex gap-1.5">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              backgroundColor: i === idx ? '#F0EBE3' : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      {/* Icon */}
      <motion.div
        key={idx}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="flex items-center justify-center rounded-3xl"
        style={{
          width: 96, height: 96,
          background: 'linear-gradient(135deg, rgba(240,235,227,0.12) 0%, rgba(240,235,227,0.04) 100%)',
          border: '1px solid rgba(240,235,227,0.15)',
          fontSize: 44,
        }}
      >
        {slide.icon}
      </motion.div>

      {/* Text */}
      <div className="text-center">
        <h2 className="text-white font-bold mb-3" style={{ fontSize: 24, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
          {slide.title}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.6 }}>
          {slide.sub}
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => {
          haptic(8)
          if (last) { onDone(); return }
          setIdx(i => i + 1)
        }}
        className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
        style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
      >
        {last ? 'Start exploring →' : 'Next'}
      </button>

      {idx > 0 && (
        <button
          type="button"
          onClick={() => { haptic(4); setIdx(i => i - 1) }}
          className="active:opacity-60"
          style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}
        >
          Back
        </button>
      )}
    </motion.div>
  )
}

export function FoundingMemberScreen({ userId, profile, onClaimed, onDismiss }: Props) {
  const [phase, setPhase] = useState<'offer' | 'onboarding'>('offer')
  const [loading, setLoading] = useState(false)

  const handleClaim = async () => {
    haptic(18)
    setLoading(true)
    try {
      await claimFoundingTrial(userId)
      const now = new Date().toISOString()
      setPhase('onboarding')
      // Optimistically update profile so trial is active immediately
      onClaimed({ ...profile, trial_start_at: now })
    } catch {
      setLoading(false)
    }
  }

  const handleDone = async () => {
    haptic(10)
    // Ask for push permission at the end of onboarding
    try { await registerPush(userId) } catch {}
  }

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      <motion.div
        className="relative w-full flex flex-col"
        style={{
          backgroundColor: '#090909',
          borderTop: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '92dvh',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-[3px] rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </div>

        <div style={{ minHeight: 520 }}>
          <AnimatePresence mode="wait">
            {phase === 'offer' ? (
              <motion.div
                key="offer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center px-7 pt-6 pb-10 gap-7"
              >
                {/* Badge */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div
                    className="flex items-center justify-center rounded-3xl"
                    style={{
                      width: 88, height: 88,
                      background: 'linear-gradient(135deg, rgba(240,235,227,0.14) 0%, rgba(240,235,227,0.04) 100%)',
                      border: '1px solid rgba(240,235,227,0.18)',
                      fontSize: 40,
                    }}
                  >
                    🌍
                  </div>
                  <div
                    className="px-3 py-1 rounded-full font-bold"
                    style={{ backgroundColor: 'rgba(240,235,227,0.1)', border: '0.5px solid rgba(240,235,227,0.25)', color: '#F0EBE3', fontSize: 11, letterSpacing: '0.08em' }}
                  >
                    FOUNDING MEMBER
                  </div>
                </motion.div>

                {/* Text */}
                <div className="text-center">
                  <h2 className="text-white font-bold mb-3" style={{ fontSize: 24, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                    You're one of TripAlong's<br />first travelers
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.6 }}>
                    We're giving you <span style={{ color: '#F0EBE3', fontWeight: 600 }}>7 days of Plus — free</span>.
                    No card needed, no catch.
                  </p>
                </div>

                {/* What's included */}
                <div className="w-full flex flex-col gap-3">
                  {[
                    { icon: '∞', label: 'Unlimited swipes' },
                    { icon: '👁', label: 'See who viewed your profile' },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ backgroundColor: 'rgba(240,235,227,0.05)', border: '0.5px solid rgba(240,235,227,0.1)' }}>
                      <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{f.icon}</span>
                      <span className="text-white font-semibold" style={{ fontSize: 14 }}>{f.label}</span>
                      <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#30D158' }}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="w-full flex flex-col gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom))' }}>
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
                  >
                    {loading ? 'Claiming…' : 'Claim free Plus →'}
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="w-full py-2.5 active:opacity-60"
                    style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13 }}
                  >
                    Maybe later
                  </button>
                </div>
              </motion.div>
            ) : (
              <OnboardingSlides onDone={handleDone} />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
