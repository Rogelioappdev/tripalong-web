'use client'

// Bottom sheet listing the trips in a globe cluster that share the same spot
// (zoom can't separate them). Tapping a row hands the trip back to open its peek.

import { motion } from 'framer-motion'
import { resizedImage } from '@/lib/imageUrl'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails } from '@/lib/types'

function whenLabel(trip: TripWithDetails): string {
  if (trip.is_flexible_dates || (!trip.start_date && !trip.end_date)) return 'Flexible dates'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = trip.start_date ? new Date(trip.start_date).toLocaleDateString('en-US', opts) : ''
  const e = trip.end_date ? new Date(trip.end_date).toLocaleDateString('en-US', opts) : ''
  if (s && e) return `${s} – ${e}`
  return s || e || 'Flexible dates'
}

export function TripClusterSheet({
  trips,
  onSelect,
  onClose,
}: {
  trips: TripWithDetails[]
  onSelect: (trip: TripWithDetails) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => { if (info.offset.y > 90) onClose() }}
        className="relative w-full max-w-md mx-3 rounded-3xl overflow-hidden flex flex-col"
        style={{ marginBottom: 92, maxHeight: '62vh', background: '#0c0c0c', border: '0.5px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 44px rgba(0,0,0,0.6)' }}
      >
        <div className="px-4 pt-4 pb-2.5 flex items-center justify-between" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h2 className="text-[#F0EBE3] text-base font-semibold">{trips.length} trips here</h2>
            <p className="text-white/45 text-xs mt-0.5">{trips[0]?.destination}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13 }}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          {trips.map((trip) => {
            const going = trip.member_count ?? 0
            const cap = trip.max_group_size
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => { haptic(8); onSelect(trip) }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl active:bg-white/5 transition-colors text-left"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: '#1a1a1a' }}>
                  {trip.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resizedImage(trip.cover_image, 140)} alt="" className="w-full h-full object-cover min-w-0 min-h-0" />
                  ) : (
                    <span className="text-xl">🌍</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#F0EBE3] text-sm font-semibold truncate">{trip.destination}</p>
                  <p className="text-white/50 text-xs mt-0.5 truncate">
                    {whenLabel(trip)} · {going}{cap ? `/${cap}` : ''} going
                  </p>
                </div>
                <span className="text-white/25 text-lg shrink-0">›</span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
