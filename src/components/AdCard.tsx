'use client'

import { forwardRef, useImperativeHandle } from 'react'
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from 'framer-motion'
import type { SwipeCardHandle } from './SwipeCard'

interface AdCardProps {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  isTop: boolean
  sharedX?: ReturnType<typeof useMotionValue<number>>
}

export const AdCard = forwardRef<SwipeCardHandle, AdCardProps>(function AdCard(
  { onSwipeLeft, onSwipeRight, isTop, sharedX },
  ref
) {
  const internalX = useMotionValue(0)
  const x = sharedX ?? internalX
  const controls = useAnimation()

  useImperativeHandle(ref, () => ({
    swipeLeft: async () => {
      await controls.start({ x: -700, opacity: 0, rotate: -20, transition: { duration: 0.3, ease: 'easeOut' } })
      onSwipeLeft()
    },
    swipeRight: async () => {
      await controls.start({ x: 700, opacity: 0, rotate: 20, transition: { duration: 0.3, ease: 'easeOut' } })
      onSwipeRight()
    },
  }))

  const rotate = useTransform(x, [-250, 250], [-18, 18])
  const passOpacity = useTransform(x, [-150, -20, 0], [1, 0.3, 0])
  const joinOpacity = useTransform(x, [0, 20, 150], [0, 0.3, 1])
  const behindScale = useTransform(x, [-200, 0, 200], [1.0, 0.97, 1.0])
  const behindY = useTransform(x, [-200, 0, 200], [0, 10, 0])
  const greenOverlay = useTransform(x, [0, 50, 200], [0, 0.06, 0.2])
  const redOverlay = useTransform(x, [0, -50, -200], [0, 0.06, 0.2])

  async function handleDragEnd(_: unknown, info: PanInfo) {
    const shouldSwipeRight = info.offset.x > 120 || info.velocity.x > 500
    const shouldSwipeLeft = info.offset.x < -120 || info.velocity.x < -500
    if (shouldSwipeRight) {
      await controls.start({ x: 700, opacity: 0, rotate: 20, transition: { duration: 0.3, ease: 'easeOut' } })
      onSwipeRight()
    } else if (shouldSwipeLeft) {
      await controls.start({ x: -700, opacity: 0, rotate: -20, transition: { duration: 0.3, ease: 'easeOut' } })
      onSwipeLeft()
    } else {
      controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } })
    }
  }

  return (
    <motion.div
      drag={isTop ? 'x' : false}
      dragConstraints={isTop ? { left: 0, right: 0 } : undefined}
      dragElastic={isTop ? 0.7 : undefined}
      animate={isTop ? controls : undefined}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: isTop ? 1 : behindScale,
        y: isTop ? 0 : behindY,
        touchAction: isTop ? 'none' : 'auto',
        zIndex: isTop ? 10 : 0,
        transformOrigin: isTop ? 'center' : 'bottom center',
        position: 'absolute',
        inset: 0,
      }}
      className={`rounded-[22px] overflow-hidden${isTop ? ' cursor-grab active:cursor-grabbing' : ''}`}
      onDragEnd={isTop ? handleDragEnd : undefined}
    >
      {/* Color wash overlays — same as SwipeCard */}
      {isTop && (
        <>
          <motion.div className="absolute inset-0 z-[5] pointer-events-none" style={{ backgroundColor: '#F0EBE3', opacity: greenOverlay }} />
          <motion.div className="absolute inset-0 z-[5] pointer-events-none" style={{ backgroundColor: '#FF453A', opacity: redOverlay }} />
          <motion.div
            className="absolute top-7 left-5 z-20 border-2 border-red-400 rounded-xl px-4 py-1.5 rotate-[-15deg]"
            style={{ opacity: passOpacity }}
          >
            <span className="text-red-400 font-black text-xl tracking-widest">PASS</span>
          </motion.div>
          <motion.div
            className="absolute top-7 right-5 z-20 border-2 rounded-xl px-4 py-1.5 rotate-[15deg]"
            style={{ opacity: joinOpacity, borderColor: '#F0EBE3' }}
          >
            <span className="font-black text-xl tracking-widest" style={{ color: '#F0EBE3' }}>SAVE</span>
          </motion.div>
        </>
      )}

      {/* Empty card frame — same background as trip card */}
      <div className="absolute inset-0 bg-[#111] rounded-[22px] overflow-hidden">
        {/* Subtle bottom gradient so "Sponsored" text is readable */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5) 100%)' }}
        />
        {/* Sponsored label — same position and style as the location pin in trip cards */}
        <div className="absolute bottom-5 left-5 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(240,235,227,0.5)]" />
          <span className="text-[rgba(240,235,227,0.5)] text-xs font-medium tracking-wide">Sponsored</span>
        </div>
      </div>
    </motion.div>
  )
})
