'use client'

import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails } from '@/lib/types'

interface JoinCelebrationProps {
  trip: TripWithDetails
  onOpenChat: () => void
  onClose: () => void
}

export function JoinCelebration({ trip, onOpenChat, onClose }: JoinCelebrationProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
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
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.06 }}
        className="relative flex-1 flex flex-col items-center justify-center px-8 text-center"
      >
        {/* Plane — springs in then floats */}
        <motion.div
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="mb-7"
        >
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 14, delay: 0.14 }}
            style={{ fontSize: 80, display: 'block', lineHeight: 1 }}
          >
            ✈️
          </motion.span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-medium text-base mb-2"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          You're going to
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="text-white font-extrabold tracking-tight"
          style={{ fontSize: 46, lineHeight: '50px', letterSpacing: '-1.5px' }}
        >
          {trip.destination}
        </motion.h1>

        {trip.country && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
            className="font-medium text-base mt-2"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            {trip.country}
          </motion.p>
        )}
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32, delay: 0.46 }}
        className="relative px-5 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
      >
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
      </motion.div>
    </motion.div>
  )
}
