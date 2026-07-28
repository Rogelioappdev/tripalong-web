'use client'

import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

export function VideoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)' }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute z-10 flex items-center justify-center rounded-full active:scale-90 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 16, width: 34, height: 34, background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 15 }}
        aria-label="Close"
      >
        ✕
      </button>

      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>,
    document.body,
  )
}
