'use client'

// Full-screen image viewer with iMessage-style swipe-through when there are
// multiple photos, plus zoom: double-tap or pinch to zoom in, drag to pan
// while zoomed (swiping between photos is disabled while zoomed in, so it
// never fights panning). Tap the backdrop or ✕ to close.

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, animate } from 'framer-motion'
import { haptic } from '@/lib/haptics'

const MAX_ZOOM = 3
const DOUBLE_TAP_ZOOM = 2.5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DIST = 30 // px — taps further apart than this don't count as one double-tap

function distance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

// One photo slide: owns its own zoom/pan state and reports zoomed-in/out up
// to the parent, which needs that to know whether the swipe-between-photos
// drag should be active right now.
function ZoomableImage({ src, onZoomChange }: { src: string; onZoomChange: (zoomed: boolean) => void }) {
  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [zoomed, setZoomed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  // Plain refs, not state, so touchmove doesn't re-render on every frame.
  const pinch = useRef<{ startDist: number; startScale: number } | null>(null)
  const pan = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const setZoomState = (next: boolean) => {
    setZoomed(next)
    onZoomChange(next)
  }

  const zoomTo = (target: number, originX?: number, originY?: number) => {
    haptic(8)
    if (target <= 1) {
      animate(scale, 1, { type: 'spring', stiffness: 400, damping: 40 })
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 })
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 40 })
      setZoomState(false)
      return
    }
    // Zoom toward where the user tapped instead of always the center.
    const el = containerRef.current
    if (el && originX != null && originY != null) {
      const rect = el.getBoundingClientRect()
      animate(x, (rect.width / 2 - (originX - rect.left)) * (target - 1), { type: 'spring', stiffness: 400, damping: 40 })
      animate(y, (rect.height / 2 - (originY - rect.top)) * (target - 1), { type: 'spring', stiffness: 400, damping: 40 })
    }
    animate(scale, target, { type: 'spring', stiffness: 400, damping: 40 })
    setZoomState(true)
  }

  const handleDoubleTap = (clientX: number, clientY: number) => {
    const now = Date.now()
    const last = lastTap.current
    lastTap.current = { t: now, x: clientX, y: clientY }
    if (!last || now - last.t >= DOUBLE_TAP_MS || distance({ clientX, clientY }, { clientX: last.x, clientY: last.y }) >= DOUBLE_TAP_DIST) return
    lastTap.current = null
    zoomed ? zoomTo(1) : zoomTo(DOUBLE_TAP_ZOOM, clientX, clientY)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinch.current = { startDist: distance(e.touches[0], e.touches[1]), startScale: scale.get() }
      pan.current = null
    } else if (e.touches.length === 1) {
      handleDoubleTap(e.touches[0].clientX, e.touches[0].clientY)
      if (zoomed) pan.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, originX: x.get(), originY: y.get() }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault()
      const ratio = distance(e.touches[0], e.touches[1]) / pinch.current.startDist
      const next = Math.min(MAX_ZOOM, Math.max(1, pinch.current.startScale * ratio))
      scale.set(next)
      if ((next > 1.05) !== zoomed) setZoomState(next > 1.05)
    } else if (e.touches.length === 1 && pan.current) {
      e.preventDefault()
      x.set(pan.current.originX + (e.touches[0].clientX - pan.current.startX))
      y.set(pan.current.originY + (e.touches[0].clientY - pan.current.startY))
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length > 0) return
    pinch.current = null
    pan.current = null
    // Pinched back down below the zoomed threshold — snap fully closed.
    if (scale.get() <= 1.05) zoomTo(1)
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={(e) => { zoomed ? zoomTo(1) : zoomTo(DOUBLE_TAP_ZOOM, e.clientX, e.clientY) }}
      style={{ touchAction: zoomed ? 'none' : 'pan-y' }}
    >
      <motion.img
        src={src}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        style={{ scale, x, y, cursor: zoomed ? 'grab' : 'default' }}
        draggable={false}
      />
    </div>
  )
}

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
  const [zoomed, setZoomed] = useState(false) // swiping between photos only allowed at 1x

  if (typeof document === 'undefined' || images.length === 0) return null

  const go = (delta: number) => {
    const next = index + delta
    if (next < 0 || next >= images.length) return
    haptic(6)
    setIndex(next)
    setZoomed(false)
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

      {/* Swipe-between-photos layer — disabled while zoomed in so panning a
          zoomed photo never gets misread as "go to next photo". */}
      <motion.div
        key={index}
        className="relative w-full h-full"
        drag={images.length > 1 && !zoomed ? 'x' : false}
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
      >
        <ZoomableImage src={images[index]} onZoomChange={setZoomed} />
      </motion.div>

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
