'use client'

import { useEffect } from 'react'
import { motion, useAnimate } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails } from '@/lib/types'

interface JoinCelebrationProps {
  trip: TripWithDetails
  onOpenChat: () => void
  onClose: () => void
  inChat?: boolean
}

function FloatingPlane() {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    ;(async () => {
      // Spring in — wait for it to fully settle
      await animate(
        scope.current,
        { scale: 1, rotate: 0 },
        { type: 'spring', stiffness: 300, damping: 22, delay: 0.16 }
      )
      // Float continuously — only starts once spring is done
      animate(
        scope.current,
        { y: [0, -13, 0] },
        { duration: 2.8, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }
      )
    })()
  }, [animate])

  return (
    <div
      ref={scope}
      className="mb-7"
      style={{
        fontSize: 80,
        lineHeight: 1,
        display: 'block',
        willChange: 'transform',
        transform: 'scale(0) rotate(-30deg)',
      }}
    >
      ✈️
    </div>
  )
}

export function JoinCelebration({ trip, onOpenChat, onClose, inChat = false }: JoinCelebrationProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden"
    >
      {/* Blurred cover background */}
      {trip.cover_image && (
        <img
          src={trip.cover_image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(22px)', transform: 'scale(1.12)', opacity: 0.3 }}
        />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} />

      {/* Centered content */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.05 }}
        className="relative flex-1 flex flex-col items-center justify-center px-8 text-center"
        style={{ willChange: 'transform, opacity' }}
      >
        <FloatingPlane />

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: 'easeOut', delay: 0.3 }}
          className="font-medium text-base mb-2"
          style={{ color: 'rgba(255,255,255,0.5)', willChange: 'opacity, transform' }}
        >
          You're going to
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: 'easeOut', delay: 0.37 }}
          className="text-white font-extrabold tracking-tight"
          style={{ fontSize: 46, lineHeight: '50px', letterSpacing: '-1.5px', willChange: 'opacity, transform' }}
        >
          {trip.destination}
        </motion.h1>

        {trip.country && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.38, ease: 'easeOut', delay: 0.44 }}
            className="font-medium text-base mt-2"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            {trip.country}
          </motion.p>
        )}
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34, delay: 0.46 }}
        className="relative px-5 flex flex-col gap-3"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
          willChange: 'transform, opacity',
        }}
      >
        {inChat ? (
          <button
            type="button"
            onClick={() => { haptic(10); onOpenChat() }}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            Nice! 🙌
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { haptic(10); onOpenChat() }}
              className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
              style={{ backgroundColor: '#F0EBE3', color: '#000' }}
            >
              Open Group Chat →
            </button>
            <button
              type="button"
              onClick={() => { haptic(8); onClose() }}
              className="w-full py-4 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              Keep Exploring
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
