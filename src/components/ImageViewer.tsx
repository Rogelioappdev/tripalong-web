'use client'

// Full-screen image viewer with iMessage-style swipe-through when there are
// multiple photos. Drag left/right (or tap the side chevrons) to move between
// images; tap the backdrop or ✕ to close.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'

export function ImageViewer({
  images,
  startIndex = 0,
  onClose,
}: {
  images: string[]
  startIndex?: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(Math.max(0, Math.min(startIndex, images.length - 1)))

  if (typeof document === 'undefined' || images.length === 0) return null

  const go = (delta: number) => {
    const next = index + delta
    if (next < 0 || next >= images.length) return
    haptic(6)
    setIndex(next)
  }

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
      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute inset-x-0 flex justify-center" style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}>
          <span className="text-white/75 text-[13px] font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.45)' }}>
            {index + 1} / {images.length}
          </span>
        </div>
      )}

      {/* Close */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute z-10 flex items-center justify-center rounded-full active:scale-90 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 16, width: 34, height: 34, background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 15 }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Image — drag to swipe */}
      <motion.img
        key={index}
        src={images[index]}
        drag={images.length > 1 ? 'x' : false}
        dragSnapToOrigin
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70) go(1)
          else if (info.offset.x > 70) go(-1)
        }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="max-w-full max-h-full object-contain select-none"
        style={{ touchAction: 'pan-y', cursor: images.length > 1 ? 'grab' : 'default' }}
        draggable={false}
      />

      {/* Side chevrons (also works without touch) */}
      {images.length > 1 && index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(-1) }}
          className="absolute left-2 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          aria-label="Previous"
        >
          ‹
        </button>
      )}
      {images.length > 1 && index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(1) }}
          className="absolute right-2 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          aria-label="Next"
        >
          ›
        </button>
      )}
    </motion.div>,
    document.body,
  )
}
