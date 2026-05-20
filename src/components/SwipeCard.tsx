'use client'

import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from 'framer-motion'
import type { TripWithDetails } from '@/lib/types'

interface SwipeCardProps {
  trip: TripWithDetails
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onTap: () => void
  isTop: boolean
  sharedX?: ReturnType<typeof useMotionValue<number>>
}

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏔️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
  chill: '😌', nature: '🌿', beach: '🌊', spiritual: '🧘',
  'road trip': '🚗',
}

const BUDGET_LABEL: Record<string, string> = {
  budget: '💸 Budget',
  moderate: '💳 Moderate',
  luxury: '✨ Luxury',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SwipeCard({ trip, onSwipeLeft, onSwipeRight, onTap, isTop, sharedX }: SwipeCardProps) {
  const internalX = useMotionValue(0)
  // Top card uses sharedX so SwipeStack can observe its position for behind-card animation
  const x = sharedX ?? internalX
  const controls = useAnimation()

  const rotate = useTransform(x, [-250, 250], [-18, 18])
  const passOpacity = useTransform(x, [-150, -20, 0], [1, 0.3, 0])
  const joinOpacity = useTransform(x, [0, 20, 150], [0, 0.3, 1])

  const behindScale = useTransform(x, [-200, 0, 200], [1.0, 0.92, 1.0])
  const behindY = useTransform(x, [-200, 0, 200], [0, 20, 0])

  const memberCount = trip.members?.[0]?.count ?? 0
  const spotsLeft = trip.max_group_size - memberCount

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

  if (!isTop) {
    return (
      <motion.div
        className="absolute inset-0 rounded-3xl overflow-hidden"
        style={{
          scale: behindScale ?? 0.92,
          y: behindY ?? 20,
          zIndex: 0,
          transformOrigin: 'bottom center',
        }}
      >
        <CardContent trip={trip} memberCount={memberCount} spotsLeft={spotsLeft} dateLabel={dateLabel} />
      </motion.div>
    )
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      animate={controls}
      style={{ x, rotate, touchAction: 'none', zIndex: 10, position: 'absolute', inset: 0 }}
      className="rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
      onDragEnd={handleDragEnd}
      onClick={onTap}
    >
      {/* PASS overlay */}
      <motion.div
        className="absolute top-8 left-6 z-20 border-2 border-red-400 rounded-xl px-4 py-2 rotate-[-15deg]"
        style={{ opacity: passOpacity }}
      >
        <span className="text-red-400 font-black text-2xl tracking-widest">PASS</span>
      </motion.div>

      {/* JOIN overlay */}
      <motion.div
        className="absolute top-8 right-6 z-20 border-2 border-green-400 rounded-xl px-4 py-2 rotate-[15deg]"
        style={{ opacity: joinOpacity }}
      >
        <span className="text-green-400 font-black text-2xl tracking-widest">JOIN</span>
      </motion.div>

      <CardContent trip={trip} memberCount={memberCount} spotsLeft={spotsLeft} dateLabel={dateLabel} />
    </motion.div>
  )
}

function CardContent({ trip, memberCount, spotsLeft, dateLabel }: {
  trip: TripWithDetails
  memberCount: number
  spotsLeft: number
  dateLabel: string
}) {
  return (
    <div className="relative w-full h-full bg-surface rounded-3xl overflow-hidden select-none">
      {/* Cover image — top 55% */}
      <div className="absolute inset-0">
        {trip.cover_image ? (
          <img
            src={trip.cover_image}
            alt={trip.destination}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl bg-surface-input">
            🌍
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.97) 100%)',
        }}
      />

      {/* Spots badge */}
      <div className="absolute top-4 right-4 z-10 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold text-white/80">
        {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
      </div>

      {/* Content — bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        {/* Country */}
        {trip.country && (
          <div className="flex items-center gap-1 mb-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#F0EBE3"/>
            </svg>
            <span className="text-accent text-xs font-semibold tracking-wide uppercase">{trip.country}</span>
          </div>
        )}

        {/* Destination */}
        <h2 className="text-white font-extrabold text-3xl leading-none mb-1 tracking-tight">
          {trip.destination}
        </h2>

        {/* Dates + budget */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white/60 text-sm">{dateLabel}</span>
          {trip.budget_level && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-white/60 text-sm capitalize">{trip.budget_level}</span>
            </>
          )}
        </div>

        {/* Vibes */}
        {trip.vibes && trip.vibes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {trip.vibes.slice(0, 3).map(vibe => (
              <span
                key={vibe}
                className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/70 font-medium"
              >
                {VIBE_EMOJI[vibe] ?? ''} {vibe}
              </span>
            ))}
          </div>
        )}

        {/* Creator row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden shrink-0">
              {trip.creator.profile_photo ? (
                <img src={trip.creator.profile_photo} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/60">
                  {trip.creator.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </div>
            <span className="text-white/50 text-sm">{trip.creator.name}</span>
          </div>
          <span className="text-white/30 text-sm">{memberCount} going</span>
        </div>
      </div>
    </div>
  )
}
