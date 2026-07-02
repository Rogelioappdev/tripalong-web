'use client'

import { forwardRef, useImperativeHandle } from 'react'
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from 'framer-motion'
import type { TripWithDetails } from '@/lib/types'

export interface SwipeCardHandle {
  swipeLeft: () => Promise<void>
  swipeRight: () => Promise<void>
}

interface SwipeCardProps {
  trip: TripWithDetails
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onTap: () => void
  isTop: boolean
  isJoined?: boolean
  isSaved?: boolean
  matchPct?: number
  matchingVibes?: string[]
  isPlus?: boolean
  onCompatibilityTap?: () => void
  onCreatorTap?: (userId: string) => void
  sharedX?: ReturnType<typeof useMotionValue<number>>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(props, ref) {
  const { trip, onSwipeLeft, onSwipeRight, onTap, isTop, isJoined, matchPct, matchingVibes, isPlus, onCompatibilityTap, onCreatorTap, sharedX } = props
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

  const dateLabel = trip.is_flexible_dates
    ? 'Flexible dates'
    : trip.start_date && trip.end_date
    ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
    : trip.start_date
    ? formatDate(trip.start_date)
    : 'Dates TBD'

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

  // Single motion element for both top and behind states — avoids Framer Motion
  // reinitializing drag/controls when isTop flips (same DOM node, just updated props)
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
      onTap={isTop ? onTap : undefined}
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
      <CardContent trip={trip} dateLabel={dateLabel} isJoined={isTop ? isJoined : false} matchPct={matchPct} matchingVibes={matchingVibes} isPlus={isPlus} onCompatibilityTap={isTop ? onCompatibilityTap : undefined} onCreatorTap={isTop ? onCreatorTap : undefined} />
    </motion.div>
  )
})

function CardContent({ trip, dateLabel, isJoined, matchPct, matchingVibes, isPlus, onCompatibilityTap, onCreatorTap }: {
  trip: TripWithDetails
  dateLabel: string
  isJoined?: boolean
  matchPct?: number
  matchingVibes?: string[]
  isPlus?: boolean
  onCompatibilityTap?: () => void
  onCreatorTap?: (userId: string) => void
}) {
  // Creator is also in trip_members — exclude them to avoid double-counting
  const otherMembers = (trip.members ?? []).filter(m => m.user_id !== (trip as any).creator_id)
  const otherCount = otherMembers.length

  return (
    <div className="relative w-full h-full bg-[#111] rounded-[22px] overflow-hidden select-none">
      {/* Cover image */}
      <div className="absolute inset-0">
        {trip.cover_image ? (
          <img src={trip.cover_image} alt={trip.destination} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-6xl">🌍</div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, rgba(0,0,0,0.7) 62%, rgba(0,0,0,0.97) 100%)',
      }} />


      {/* Top-right: Joined badge */}
      {isJoined && (
        <div className="absolute top-4 right-4 z-10 bg-green-500/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white text-xs font-semibold">Joined</span>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        {/* Country */}
        {trip.country && (
          <div className="flex items-center gap-1 mb-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.7)"/>
            </svg>
            <span className="text-[#F0EBE3]/70 text-xs font-medium tracking-wide">{trip.country.toLowerCase()}</span>
          </div>
        )}

        {/* Destination */}
        <h2 className="text-white font-extrabold leading-none mb-2 tracking-tight" style={{ fontSize: 'clamp(28px, 8vw, 40px)' }}>
          {trip.destination}
        </h2>

        {/* Dates · Budget */}
        <div className="flex items-center gap-2 mb-3">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
            <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span className="text-white/50 text-sm">{dateLabel}</span>
          {trip.budget_level && (
            <>
              <span className="text-white/25">·</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="text-white/50 text-sm capitalize">{trip.budget_level}</span>
            </>
          )}
        </div>

        {/* Description */}
        {trip.description && (
          <p className="text-white/50 text-sm leading-snug mb-3 line-clamp-2">{trip.description}</p>
        )}

        {/* Vibe tags */}
        {trip.vibes && trip.vibes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {trip.vibes.slice(0, 3).map(vibe => (
              <span key={vibe} className="text-xs rounded-full px-3 py-1 font-semibold capitalize"
                style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3' }}>
                {vibe}
              </span>
            ))}
          </div>
        )}

        {/* Creator row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Stacked member avatars */}
            <div className="flex -space-x-2">
              {/* Creator always first — tappable to view profile.
                  Uses onPointerDown + nativeEvent.stopImmediatePropagation so the
                  event fires before Framer Motion's setPointerCapture redirects it. */}
              <button
                type="button"
                onPointerDown={e => {
                  e.nativeEvent.stopImmediatePropagation()
                  if (trip.creator?.id) onCreatorTap?.(trip.creator.id)
                }}
                onClick={e => e.stopPropagation()}
                style={{ touchAction: 'manipulation' }}
                className="w-7 h-7 rounded-full overflow-hidden border-2 border-black shrink-0 z-10"
              >
                {trip.creator.profile_photo ? (
                  <img src={trip.creator.profile_photo} alt="" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                    {trip.creator.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </button>
              {/* Up to 2 other members (creator already shown above) */}
              {otherMembers.slice(0, 2).map((m, i) => (
                <div key={m.user_id} className="w-7 h-7 rounded-full overflow-hidden border-2 border-black shrink-0" style={{ zIndex: 9 - i }}>
                  {m.user?.profile_photo ? (
                    <img src={m.user.profile_photo} alt="" className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className="w-full h-full bg-white/15 flex items-center justify-center text-[10px] font-bold text-white">
                      {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span className="text-white/50 text-sm">
              {trip.creator.name}
              {otherCount > 0 ? ` +${otherCount} going` : ' · going'}
            </span>
          </div>
          {/* Save count */}
          {trip.save_count > 0 && (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                  stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-white/35 text-xs">{trip.save_count} saved</span>
            </div>
          )}
        </div>

        {/* ── Compatibility row ─────────────────────────────── */}
        {matchPct !== undefined && (
          <>
            <div style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, marginBottom: 10 }} />
            {isPlus ? (
              <div className="flex items-center gap-2">
                {/* Score dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: matchPct >= 80 ? '#30D158' : matchPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.4)',
                }} />
                <span style={{
                  color: matchPct >= 80 ? '#30D158' : matchPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.55)',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {matchPct}% match
                </span>
                {matchingVibes && matchingVibes.length > 0 && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
                      {matchingVibes.join(' · ')}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onCompatibilityTap?.() }}
                className="flex items-center justify-between w-full active:opacity-70"
              >
                <div className="flex items-center gap-2">
                  {/* Dot reveals quality without revealing the number */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: matchPct !== undefined
                      ? (matchPct >= 80 ? '#30D158' : matchPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.3)')
                      : 'rgba(255,255,255,0.2)',
                  }} />
                  {/* Number blurred — you can almost read it */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ filter: 'blur(3.5px)', userSelect: 'none' }}>
                      {matchPct ?? '??'}%
                    </span>
                    {' '}match
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(240,235,227,0.5)" strokeWidth="2"/>
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(240,235,227,0.5)" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ color: 'rgba(240,235,227,0.5)', fontSize: 12, fontWeight: 600 }}>Unlock</span>
                </div>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
