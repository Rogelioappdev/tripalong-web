'use client'

import { resizedImage, resizedAvatar } from '@/lib/imageUrl'
import type { TripWithDetails } from '@/lib/types'

interface TripCardProps {
  trip: TripWithDetails
  onClick: () => void
}

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏔️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
}

export function TripCard({ trip, onClick }: TripCardProps) {
  const memberCount = trip.member_count ?? 0
  const spotsLeft = trip.max_group_size - memberCount

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const dateLabel = trip.is_flexible_dates
    ? 'Flexible dates'
    : trip.start_date && trip.end_date
    ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
    : trip.start_date
    ? formatDate(trip.start_date)
    : 'Dates TBD'

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/6 transition-all duration-200"
    >
      {/* Cover image */}
      <div className="aspect-[4/3] bg-white/6 overflow-hidden relative">
        {trip.cover_image ? (
          <img
            src={resizedImage(trip.cover_image, 400, 70)}
            alt={trip.destination}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🌍
          </div>
        )}
        {/* Spots badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white/80">
          {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-1">
            {trip.destination}
            {trip.country ? `, ${trip.country}` : ''}
          </h3>
          {trip.budget_level && (
            <span className="text-white/30 text-xs shrink-0">{trip.budget_level}</span>
          )}
        </div>

        <p className="text-white/40 text-xs mb-3">{dateLabel}</p>

        {trip.vibes && trip.vibes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {trip.vibes.slice(0, 3).map(vibe => (
              <span key={vibe} className="text-xs bg-white/8 rounded-full px-2 py-0.5 text-white/60">
                {VIBE_EMOJI[vibe] ?? ''} {vibe}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {trip.creator.profile_photo ? (
            <img
              src={resizedAvatar(trip.creator.profile_photo, 100)}
              alt={trip.creator.name}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs">
              {trip.creator.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span className="text-white/40 text-xs">{trip.creator.name}</span>
          <span className="text-white/20 text-xs ml-auto">{memberCount} going</span>
        </div>
      </div>
    </div>
  )
}
