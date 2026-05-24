'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { joinTrip, getTripMembership, getTrip, getTripChat } from '@/lib/queries'
import type { TripWithDetails } from '@/lib/types'

interface TripDetailModalProps {
  trip: TripWithDetails
  onClose: () => void
}

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏔️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
}

export function TripDetailModal({ trip, onClose }: TripDetailModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const { data: tripDetail } = useQuery({
    queryKey: ['trip', trip.id],
    queryFn: () => getTrip(trip.id),
  })

  const { data: membership } = useQuery({
    queryKey: ['membership', trip.id, userId],
    queryFn: () => getTripMembership(trip.id, userId!),
    enabled: !!userId,
  })

  const isJoined = membership?.status === 'in' || membership?.status === 'maybe'

  const joinMutation = useMutation({
    mutationFn: () => joinTrip(trip.id, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership', trip.id, userId] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })

  const openChat = async () => {
    const chat = await getTripChat(trip.id)
    if (chat) router.push(`/chat/${chat.id}`)
  }

  const displayTrip = tripDetail ?? trip
  const memberCount = displayTrip.members?.length ?? 0
  const spotsLeft = displayTrip.max_group_size - memberCount

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg max-h-[90vh] bg-[#0a0a0a] sm:rounded-3xl rounded-t-3xl border border-white/10 overflow-y-auto">
        {/* Cover */}
        <div className="aspect-[16/9] bg-white/6 overflow-hidden relative">
          {displayTrip.cover_image ? (
            <img src={displayTrip.cover_image} alt={displayTrip.destination} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🌍</div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white mb-1">{displayTrip.destination}{displayTrip.country ? `, ${displayTrip.country}` : ''}</h2>
            {displayTrip.title && displayTrip.title !== displayTrip.destination && (
              <p className="text-white/50 text-sm mb-2">{displayTrip.title}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-white/40">
              <span>
                {displayTrip.is_flexible_dates ? 'Flexible dates' :
                  displayTrip.start_date ? `${formatDate(displayTrip.start_date)}${displayTrip.end_date ? ` – ${formatDate(displayTrip.end_date)}` : ''}` : 'Dates TBD'}
              </span>
              <span>·</span>
              <span>{memberCount}/{displayTrip.max_group_size} going</span>
              {displayTrip.budget_level && <><span>·</span><span>{displayTrip.budget_level}</span></>}
            </div>
          </div>

          {/* Vibes */}
          {displayTrip.vibes && displayTrip.vibes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {displayTrip.vibes.map(vibe => (
                <span key={vibe} className="text-sm bg-white/8 rounded-full px-3 py-1 text-white/60">
                  {VIBE_EMOJI[vibe] ?? ''} {vibe}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {displayTrip.description && (
            <p className="text-white/60 text-sm leading-relaxed mb-4">{displayTrip.description}</p>
          )}

          {/* Creator */}
          <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl bg-white/4">
            {displayTrip.creator.profile_photo ? (
              <img src={displayTrip.creator.profile_photo} alt={displayTrip.creator.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium">
                {displayTrip.creator.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="text-white text-sm font-medium">{displayTrip.creator.name}</p>
              <p className="text-white/40 text-xs">Trip organizer</p>
            </div>
          </div>

          {/* Actions */}
          {isJoined ? (
            <button
              onClick={openChat}
              className="w-full bg-white text-black font-semibold py-4 rounded-2xl text-sm hover:bg-white/90 transition-colors"
            >
              Open Group Chat
            </button>
          ) : (
            <button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending || spotsLeft <= 0}
              className="w-full bg-white text-black font-semibold py-4 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {joinMutation.isPending ? 'Joining...' : spotsLeft <= 0 ? 'Trip Full' : 'Join Trip'}
            </button>
          )}

          {joinMutation.isError && (
            <p className="text-red-400 text-xs text-center mt-2">Something went wrong. Try again.</p>
          )}

          {joinMutation.isSuccess && !isJoined && (
            <p className="text-green-400 text-xs text-center mt-2">You joined! Open the group chat above.</p>
          )}
        </div>
      </div>
    </div>
  )
}
