'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from 'framer-motion'
import type { SwipeCardHandle } from './SwipeCard'

// Checked live (not the frozen `isNativeApp` module constant from '@/lib/native-app') —
// this component's chunk can be evaluated before react-native-webview finishes
// injecting the bridge object, which would freeze the constant at `false` forever.
const isNativeApp = () => typeof window !== 'undefined' && !!(window as any).ReactNativeWebView

const AD_CLIENT = 'ca-pub-8644781373903568'
const AD_SLOT = '4676302670' // "Feed Card Web" responsive display unit

function WebAdSlot() {
  const pushed = useRef(false)
  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  }, [])

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', width: '100%' }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={AD_SLOT}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

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

      <div
        className="absolute inset-0 rounded-[22px] overflow-hidden select-none"
        style={{ backgroundColor: '#111', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: '#161616' }} />

        {isNativeApp() ? (
          <>
            <motion.div
              className="absolute inset-y-0 pointer-events-none"
              style={{
                width: '60%',
                background:
                  'linear-gradient(105deg, transparent 0%, rgba(240,235,227,0.06) 45%, rgba(240,235,227,0.10) 50%, rgba(240,235,227,0.06) 55%, transparent 100%)',
              }}
              initial={{ left: '-60%' }}
              animate={{ left: '110%' }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.2 }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.6) 100%)' }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3">
              <div className="rounded-lg" style={{ width: '62%', height: 30, backgroundColor: 'rgba(255,255,255,0.07)' }} />
              <div className="rounded-md" style={{ width: '40%', height: 14, backgroundColor: 'rgba(255,255,255,0.05)' }} />
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(240,235,227,0.45)' }} />
                <span className="text-xs font-medium tracking-wide" style={{ color: 'rgba(240,235,227,0.45)' }}>
                  Sponsored
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex items-center gap-1.5 px-5 pt-5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(240,235,227,0.45)' }} />
              <span className="text-xs font-medium tracking-wide" style={{ color: 'rgba(240,235,227,0.45)' }}>
                Sponsored
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center px-5 pb-5 pt-3 overflow-hidden">
              <WebAdSlot />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
})
