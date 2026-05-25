'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { joinTrip, getTripMembership, getTrip, joinTripChat, saveTrip } from '@/lib/queries'
import { PublicProfileModal } from './PublicProfileModal'
import type { TripWithDetails } from '@/lib/types'

interface TripDetailModalProps {
  trip: TripWithDetails
  onClose: () => void
}

const VIBE_EMOJI: Record<string, string> = {
  adventure: '🏕️', cultural: '🏛️', foodie: '🍜', luxury: '✨',
  backpacking: '🎒', relaxed: '🌴', budget: '💸', party: '🎉',
  chill: '😊', nature: '🌿', beach: '🏖️', spiritual: '🙏',
  'road trip': '🚗',
}

function formatDates(start: string | null, end: string | null, flexible: boolean): string {
  if (flexible) return 'Flexible dates'
  if (!start) return 'TBD'
  const s = new Date(start)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (!end) return s.toLocaleDateString('en-US', opts)
  const e = new Date(end)
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

export function TripDetailModal({ trip, onClose }: TripDetailModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

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
    if (!userId) return
    try {
      // Auto-save the trip and join the chat (SECURITY DEFINER bypasses RLS)
      await Promise.all([
        saveTrip(trip.id, userId).catch(() => {}),
        joinTripChat(trip.id).then(chatId => {
          router.push(`/chat/${chatId}`)
        }),
      ])
    } catch (e) {
      console.error('openChat error', e)
    }
  }

  const displayTrip = tripDetail ?? trip
  const memberCount = displayTrip.members?.length ?? 0
  const spotsLeft = displayTrip.max_group_size - memberCount
  const dates = formatDates(displayTrip.start_date, displayTrip.end_date, displayTrip.is_flexible_dates)

  const members = (displayTrip.members ?? []).map(m => ({
    id: m.user_id,
    name: (m.user as any)?.name ?? 'Traveler',
    photo: (m.user as any)?.profile_photo ?? null,
    isCreator: m.user_id === (displayTrip as any).creator_id,
  }))

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#000',
          borderRadius: '28px 28px 0 0',
          height: '92dvh',
        }}
      >
        {/* ── Hero ── */}
        <div className="relative shrink-0" style={{ height: '44dvh' }}>
          {displayTrip.cover_image ? (
            <img
              src={displayTrip.cover_image}
              alt={displayTrip.destination}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full" style={{ backgroundColor: '#111' }} />
          )}

          {/* Gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, rgba(0,0,0,0.92) 100%)' }}
          />

          {/* Chevron-down close */}
          <button
            onClick={onClose}
            className="absolute flex items-center justify-center"
            style={{
              top: 16, left: 16,
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: '0.5px solid rgba(255,255,255,0.15)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Destination */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pointer-events-none">
            <div className="flex items-center gap-1 mb-1">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#F0EBE3" strokeWidth="2"/>
                <circle cx="12" cy="10" r="3" stroke="#F0EBE3" strokeWidth="2"/>
              </svg>
              <span style={{ color: '#F0EBE3', fontSize: 13 }}>{displayTrip.country}</span>
            </div>
            <h1
              className="text-white font-extrabold"
              style={{ fontSize: 38, letterSpacing: '-1.2px', lineHeight: '42px' }}
            >
              {displayTrip.destination}
            </h1>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Info pills */}
          <div className="flex gap-2 px-4 pt-5">
            {[
              { label: 'Dates', value: dates },
              { label: 'Budget', value: displayTrip.budget_level ?? '—' },
              { label: 'Group', value: `Up to ${displayTrip.max_group_size}` },
            ].map(item => (
              <div
                key={item.label}
                className="flex-1 rounded-2xl"
                style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)', padding: 14 }}
              >
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginBottom: 5 }}>{item.label}</p>
                <p className="text-white font-semibold" style={{ fontSize: 13 }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="px-4 pt-6 pb-6 flex flex-col gap-7">

            {/* Trip Vibes */}
            {displayTrip.vibes && displayTrip.vibes.length > 0 && (
              <div>
                <p className="text-white font-bold" style={{ fontSize: 17 }}>Trip Vibes</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {displayTrip.vibes.map(vibe => (
                    <span
                      key={vibe}
                      className="font-semibold"
                      style={{
                        backgroundColor: 'rgba(240,235,227,0.08)',
                        border: '0.5px solid rgba(240,235,227,0.22)',
                        color: '#F0EBE3',
                        fontSize: 14,
                        padding: '8px 14px',
                        borderRadius: 22,
                        display: 'inline-block',
                      }}
                    >
                      {VIBE_EMOJI[vibe] ?? ''} {vibe}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* About This Trip */}
            {displayTrip.description && (
              <div>
                <p className="text-white font-bold" style={{ fontSize: 17 }}>About This Trip</p>
                <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 15, lineHeight: '24px', marginTop: 10 }}>
                  {displayTrip.description}
                </p>
              </div>
            )}

            {/* Who's Going */}
            {members.length > 0 && (
              <div>
                <p className="text-white font-bold" style={{ fontSize: 17 }}>Who's Going</p>
                <div className="flex gap-3 overflow-x-auto mt-3 pb-1">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setProfileUserId(m.id)}
                      className="flex flex-col items-center gap-1.5 shrink-0 active:opacity-75 transition-opacity"
                    >
                      <div
                        className="overflow-hidden"
                        style={{
                          width: 56, height: 56, borderRadius: 28,
                          border: m.isCreator ? '1.5px solid #F0EBE3' : '1.5px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        {m.photo ? (
                          <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-sm font-semibold"
                            style={{ backgroundColor: '#222', color: 'rgba(255,255,255,0.6)' }}
                          >
                            {m.name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-center truncate"
                        style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, maxWidth: 60 }}
                      >
                        {m.name.split(' ')[0]}
                      </span>
                      {m.isCreator && (
                        <span style={{ color: '#F0EBE3', fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: -4, fontWeight: 600 }}>
                          Creator
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky action button ── */}
        <div
          className="px-4 pt-3 shrink-0"
          style={{
            borderTop: '0.5px solid rgba(255,255,255,0.07)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          }}
        >
          {isJoined ? (
            <button
              onClick={openChat}
              className="w-full font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#000', padding: '16px' }}
            >
              Open Group Chat
            </button>
          ) : (
            <button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending || spotsLeft <= 0}
              className="w-full font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#000', padding: '16px' }}
            >
              {joinMutation.isPending ? 'Joining...' : spotsLeft <= 0 ? 'Trip Full' : 'Join Trip'}
            </button>
          )}
          {joinMutation.isError && (
            <p className="text-red-400 text-xs text-center mt-2">Something went wrong. Try again.</p>
          )}
        </div>
      </div>
    </div>

    {profileUserId && (
      <PublicProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    )}
  )
}
