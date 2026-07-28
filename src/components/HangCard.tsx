'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo, type TapInfo } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { resizedImage, resizedAvatar } from '@/lib/imageUrl'
import type { HangalongWithDetails, ActivityType, WhenLabel } from '@/lib/types'

export interface HangCardHandle {
  swipeLeft: () => Promise<void>
  swipeRight: () => Promise<void>
}

interface HangCardProps {
  hang: HangalongWithDetails
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onTap: () => void
  isTop: boolean
  isMine?: boolean
  isJoined?: boolean
  onCreatorTap?: (userId: string) => void
  sharedX?: ReturnType<typeof useMotionValue<number>>
}

const ACTIVITY_CONFIG: Record<ActivityType, { emoji: string; label: string; color: string; bg: string }> = {
  hike:      { emoji: '🥾', label: 'Hike',      color: '#4ade80', bg: 'linear-gradient(160deg, #0f2218 0%, #0a140d 100%)' },
  road_trip: { emoji: '🚗', label: 'Road Trip',  color: '#fb923c', bg: 'linear-gradient(160deg, #2a1500 0%, #1a0d00 100%)' },
  beach:     { emoji: '🏖️', label: 'Beach',      color: '#38bdf8', bg: 'linear-gradient(160deg, #001f2e 0%, #000d14 100%)' },
  climbing:  { emoji: '🧗', label: 'Climbing',   color: '#c084fc', bg: 'linear-gradient(160deg, #1a0a2e 0%, #0d0518 100%)' },
  urban:     { emoji: '🌆', label: 'Urban',      color: '#94a3b8', bg: 'linear-gradient(160deg, #111827 0%, #060810 100%)' },
  day_trip:  { emoji: '🚌', label: 'Day Trip',   color: '#facc15', bg: 'linear-gradient(160deg, #1f1800 0%, #100c00 100%)' },
  other:     { emoji: '✨', label: 'Hangout',    color: '#F0EBE3', bg: 'linear-gradient(160deg, #111 0%, #080808 100%)' },
}

const WHEN_DISPLAY: Record<WhenLabel, string> = {
  today:        'TODAY',
  tonight:      'TONIGHT',
  this_weekend: 'THIS WEEKEND',
  this_week:    'THIS WEEK',
}

export const HangCard = forwardRef<HangCardHandle, HangCardProps>(function HangCard(
  { hang, onSwipeLeft, onSwipeRight, onTap, isTop, isMine, isJoined, onCreatorTap, sharedX },
  ref
) {
  const internalX = useMotionValue(0)
  const x = sharedX ?? internalX
  const controls = useAnimation()
  // Framer's onTap can still fire after a real drag, since the card follows the
  // finger and the pointer is technically still "over" it at release. Track
  // actual drag distance ourselves and swallow the tap when it wasn't a tap.
  const draggedRef = useRef(false)

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
  const inOpacity = useTransform(x, [0, 20, 150], [0, 0.3, 1])
  const behindScale = useTransform(x, [-200, 0, 200], [1.0, 0.97, 1.0])
  const behindY = useTransform(x, [-200, 0, 200], [0, 10, 0])
  const greenOverlay = useTransform(x, [0, 50, 200], [0, 0.06, 0.18])
  const redOverlay = useTransform(x, [0, -50, -200], [0, 0.06, 0.18])

  async function handleDragEnd(_: unknown, info: PanInfo) {
    draggedRef.current = Math.abs(info.offset.x) > 5
    const shouldRight = info.offset.x > 120 || info.velocity.x > 500
    const shouldLeft = info.offset.x < -120 || info.velocity.x < -500
    if (shouldRight) {
      await controls.start({ x: 700, opacity: 0, rotate: 20, transition: { duration: 0.3, ease: 'easeOut' } })
      onSwipeRight()
    } else if (shouldLeft) {
      await controls.start({ x: -700, opacity: 0, rotate: -20, transition: { duration: 0.3, ease: 'easeOut' } })
      onSwipeLeft()
    } else {
      controls.start({ x: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } })
    }
  }

  const cfg = ACTIVITY_CONFIG[hang.activity_type] ?? ACTIVITY_CONFIG.other
  const spotsLeft = hang.max_people - hang.member_count
  const otherMembers = (hang.members ?? []).filter(m => m.user_id !== hang.creator_id)

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
      onTap={isTop ? (_e: MouseEvent | TouchEvent | PointerEvent, _info: TapInfo) => {
        if (draggedRef.current) { draggedRef.current = false; return }
        haptic(8); onTap()
      } : undefined}
    >
      {isTop && (
        <>
          <motion.div className="absolute inset-0 z-[5] pointer-events-none" style={{ backgroundColor: '#4ade80', opacity: greenOverlay }} />
          <motion.div className="absolute inset-0 z-[5] pointer-events-none" style={{ backgroundColor: '#FF453A', opacity: redOverlay }} />
          <motion.div
            className="absolute top-7 left-5 z-20 border-2 border-red-400 rounded-xl px-4 py-1.5 rotate-[-15deg]"
            style={{ opacity: passOpacity }}
          >
            <span className="text-red-400 font-black text-xl tracking-widest">SKIP</span>
          </motion.div>
          <motion.div
            className="absolute top-7 right-5 z-20 border-2 rounded-xl px-4 py-1.5 rotate-[15deg]"
            style={{ opacity: inOpacity, borderColor: cfg.color }}
          >
            <span className="font-black text-xl tracking-widest" style={{ color: cfg.color }}>I'M IN</span>
          </motion.div>
        </>
      )}

      {/* Card body */}
      <div className="relative w-full h-full rounded-[22px] overflow-hidden select-none" style={{ background: cfg.bg }}>
        {/* Photo if provided */}
        {hang.photo_url && (
          <>
            <img src={resizedImage(hang.photo_url, 800, 75)} alt={hang.title} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 35%, rgba(0,0,0,0.75) 65%, rgba(0,0,0,0.97) 100%)' }} />
          </>
        )}

        {!hang.photo_url && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 120, opacity: 0.07 }}>
            {cfg.emoji}
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-5 left-5 right-5 z-10 flex items-center justify-between">
          {/* Activity pill */}
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 13 }}>{cfg.emoji}</span>
            <span className="text-xs font-semibold" style={{ color: '#F0EBE3' }}>{cfg.label}</span>
          </div>

          {/* Mine / joined badge */}
          {isMine ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.3)' }}>
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em' }}>YOURS</span>
            </div>
          ) : isJoined ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-green-500/90">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-white text-xs font-semibold">You're In</span>
            </div>
          ) : null}
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {/* Time label — the hero */}
          <div className="mb-2">
            <span
              className="text-xs font-black tracking-[0.18em]"
              style={{ color: 'rgba(240,235,227,0.55)' }}
            >
              {WHEN_DISPLAY[hang.when_label]}
            </span>
          </div>

          {/* Title */}
          <h2
            className="text-white font-extrabold leading-tight mb-2 tracking-tight"
            style={{ fontSize: 'clamp(22px, 6vw, 32px)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {hang.title}
          </h2>

          {/* Location */}
          <div className="flex items-center gap-1.5 mb-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.5)"/>
            </svg>
            <span className="text-white/50 text-sm">{hang.location_name}</span>
          </div>

          {/* Creator row + spots */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Creator avatar — display only, tap to profile available inside detail modal */}
              {hang.creator?.profile_photo ? (
                <img src={resizedAvatar(hang.creator.profile_photo, 100)} alt={hang.creator.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {hang.creator?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              {/* Other member avatars */}
              {otherMembers.slice(0, 2).map((m, i) => (
                m.user?.profile_photo ? (
                  <img
                    key={m.user_id}
                    src={resizedAvatar(m.user.profile_photo, 100)}
                    alt={m.user.name}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
                    style={{ marginLeft: -8, zIndex: i }}
                  />
                ) : (
                  <div
                    key={m.user_id}
                    className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white/20"
                    style={{ marginLeft: -8, zIndex: i }}
                  >
                    {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )
              ))}
              <span className="text-white/50 text-sm ml-1">{hang.creator?.name}</span>
            </div>

            {/* Spots left */}
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="text-white/50 text-xs font-medium">
                {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft > 1 ? 's' : ''} left` : 'Full'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
})
