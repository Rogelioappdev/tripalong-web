'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTrip, joinTrip, getTripChat } from '@/lib/queries'
import type { TripWithDetails } from '@/lib/types'

const VIBE_ICONS: Record<string, string> = {
  beach: '🏖️', adventure: '🧗', nightlife: '🎉', culture: '🏛️',
  food: '🍜', nature: '🌿', luxury: '✨', backpacker: '🎒',
  party: '🎊', chill: '😌', sports: '⚽', photography: '📸',
  hiking: '🥾', roadtrip: '🚗', festival: '🎵', wellness: '🧘',
  history: '🏺', art: '🎨', shopping: '🛍️', skiing: '⛷️',
  diving: '🤿', surfing: '🏄', camping: '⛺', wildlife: '🦁',
  music: '🎶', spiritual: '🕌', volunteer: '🤝', yoga: '🧘',
}

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

export default function TripLandingPage() {
  const { id: tripId } = useParams<{ id: string }>()
  const router = useRouter()

  const [trip, setTrip] = useState<TripWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    Promise.all([
      getTrip(tripId).catch(() => null),
      supabase.auth.getUser().then(({ data }) => data.user?.id ?? null),
    ]).then(([tripData, uid]) => {
      setTrip(tripData)
      setUserId(uid)
      setLoading(false)
      if (uid && tripData) {
        const isMember = (tripData.members ?? []).some((m: any) => m.user_id === uid || m.user?.id === uid)
        setAlreadyJoined(isMember)
      }
    })
  }, [tripId])

  const handleJoin = async () => {
    if (!userId) {
      // Store destination for post-auth redirect
      sessionStorage.setItem('postAuthRedirect', `/trip/${tripId}`)
      router.push('/')
      return
    }
    setJoining(true)
    setJoinError('')
    try {
      await joinTrip(tripId, userId)
      const chat = await getTripChat(tripId)
      router.push(`/chat/${chat.id}`)
    } catch (e: any) {
      setJoinError('Could not join trip. Please try again.')
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-4xl">🌍</p>
        <p className="text-white font-bold text-lg">Trip not found</p>
        <p className="text-white/35 text-sm">This invite link may have expired or been removed.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-2 px-6 py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          Open TripAlong
        </button>
      </div>
    )
  }

  const dateStr = formatDates(trip.start_date ?? null, trip.end_date ?? null)
  const memberCount = Math.max(trip.members?.length ?? 0, trip.member_count ?? 0)
  const pace = (trip as any).pace as string | undefined
  const budget = (trip as any).budget_level as string | undefined
  const maxSize = (trip as any).max_group_size as number | undefined
  const vibes: string[] = (trip as any).vibes ?? []

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 180px)' }}>

      {/* Hero */}
      <div className="relative shrink-0" style={{ height: 300 }}>
        {trip.cover_image ? (
          <img src={trip.cover_image} alt={trip.destination} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl" style={{ backgroundColor: '#0D0D0D' }}>🌍</div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 35%, rgba(0,0,0,0.92) 100%)' }}
        />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute flex items-center justify-center rounded-full"
          style={{
            top: 'calc(env(safe-area-inset-top) + 12px)',
            left: 16,
            width: 36, height: 36,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          } as React.CSSProperties}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* TripAlong badge */}
        <div
          className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            top: 'calc(env(safe-area-inset-top) + 12px)',
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          } as React.CSSProperties}
        >
          <span className="text-white font-bold text-xs tracking-wide">TripAlong</span>
        </div>

        {/* Trip title */}
        <div className="absolute bottom-0 left-0 px-5 pb-5">
          <h1 className="text-white font-extrabold" style={{ fontSize: 34, letterSpacing: -1, lineHeight: 1.1 }}>
            {trip.destination}
          </h1>
          {trip.country && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginTop: 4 }}>{trip.country}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-5">

        {/* Quick stats */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-5">
          {dateStr && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>📅</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{dateStr}</span>
            </div>
          )}
          {memberCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>👥</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}
          {pace && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>
                {pace === 'slow' ? '🐢' : pace === 'fast' ? '⚡️' : '⚖️'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textTransform: 'capitalize' }}>{pace} pace</span>
            </div>
          )}
          {budget && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>💰</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textTransform: 'capitalize' }}>{budget}</span>
            </div>
          )}
          {maxSize && maxSize > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>🎯</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Up to {maxSize}</span>
            </div>
          )}
        </div>

        {/* Creator card */}
        {trip.creator && (
          <div
            className="flex items-center gap-3 mb-5 p-4 rounded-2xl"
            style={{ backgroundColor: '#0E0E0E', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0">
              {trip.creator.profile_photo ? (
                <img src={trip.creator.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {trip.creator.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Organized by
              </p>
              <p className="text-white font-semibold text-sm truncate mt-0.5">{trip.creator.name}</p>
            </div>
            <div className="ml-auto shrink-0 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(240,235,227,0.07)', border: '0.5px solid rgba(240,235,227,0.12)' }}>
              <span style={{ color: 'rgba(240,235,227,0.55)', fontSize: 11, fontWeight: 600 }}>Creator</span>
            </div>
          </div>
        )}

        {/* Description */}
        {trip.description?.trim() && (
          <p className="mb-5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
            {trip.description}
          </p>
        )}

        {/* Vibes */}
        {vibes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {vibes.map(v => (
              <span
                key={v}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium capitalize"
                style={{
                  fontSize: 13,
                  backgroundColor: 'rgba(240,235,227,0.07)',
                  color: 'rgba(240,235,227,0.65)',
                  border: '0.5px solid rgba(240,235,227,0.13)',
                }}
              >
                {VIBE_ICONS[v.toLowerCase()] ?? '🏷️'} {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CTA — fixed above the tab bar so it's always reachable */}
      <div
        className="fixed left-0 right-0 px-5"
        style={{
          bottom: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 90px)',
          paddingTop: 24,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.88) 28%, #000 60%)',
        }}
      >
        {joinError && (
          <p className="text-center text-sm mb-3" style={{ color: '#FF453A' }}>{joinError}</p>
        )}
        {alreadyJoined ? (
          <button
            onClick={() => getTripChat(tripId).then(c => router.push(`/chat/${c.id}`)).catch(() => router.push('/feed'))}
            className="w-full rounded-2xl font-bold text-base transition-opacity active:opacity-80"
            style={{ backgroundColor: '#30D158', color: '#000', padding: '16px 0' }}
          >
            Open group chat →
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full rounded-2xl font-bold text-base disabled:opacity-55 transition-opacity active:opacity-80"
            style={{ backgroundColor: '#F0EBE3', color: '#000', padding: '16px 0' }}
          >
            {joining ? 'Joining…' : userId ? 'Join this trip' : 'Sign in to join'}
          </button>
        )}
        {!userId && (
          <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12 }}>
            New to TripAlong?{' '}
            <button
              onClick={() => { sessionStorage.setItem('postAuthRedirect', `/trip/${tripId}`); router.push('/') }}
              style={{ color: 'rgba(255,255,255,0.42)', textDecoration: 'underline' }}
            >
              Create a free account
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
