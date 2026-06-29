'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'

interface Props {
  onTrip: () => void
  onHangout: () => void
  onClose: () => void
}

export function CreatePicker({ onTrip, onHangout, onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          onClick={e => e.stopPropagation()}
          className="w-full rounded-t-[28px] px-4 pt-5"
          style={{
            backgroundColor: '#111',
            border: '0.5px solid rgba(255,255,255,0.1)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          }}
        >
          {/* Handle */}
          <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-5" />

          <p className="text-white/40 text-xs font-semibold tracking-widest uppercase text-center mb-4">
            What do you want to create?
          </p>

          <div className="flex flex-col gap-3 mb-3">
            {/* Trip option */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { haptic(10); onTrip() }}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                ✈️
              </div>
              <div>
                <p className="text-white font-bold text-base">Trip</p>
                <p className="text-white/40 text-sm mt-0.5">Multi-day travel to any destination</p>
              </div>
              <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>

            {/* Hangout option */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { haptic(10); onHangout() }}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                🥾
              </div>
              <div>
                <p className="text-white font-bold text-base">Hangout</p>
                <p className="text-white/40 text-sm mt-0.5">Day hike, road trip, local plans</p>
              </div>
              <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
