'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getHangalong, joinHangalong, getHangalongChatId } from '@/lib/queries'
import type { HangalongWithDetails, ActivityType, WhenLabel } from '@/lib/types'

const ACTIVITY_CONFIG: Record<ActivityType, { emoji: string; label: string }> = {
  hike:      { emoji: '🥾', label: 'Hike'     },
  road_trip: { emoji: '🚗', label: 'Road Trip' },
  beach:     { emoji: '🏖️', label: 'Beach'     },
  climbing:  { emoji: '🧗', label: 'Climbing'  },
  urban:     { emoji: '🌆', label: 'Urban'     },
  day_trip:  { emoji: '🚌', label: 'Day Trip'  },
  other:     { emoji: '✨', label: 'Hangout'   },
}

const WHEN_DISPLAY: Record<WhenLabel, string> = {
  today:        'Today',
  tonight:      'Tonight',
  this_weekend: 'This Weekend',
  this_week:    'This Week',
}

export default function HangLandingClient() {
  const { id: hangId } = useParams<{ id: string }>()
  const router = useRouter()

  const [hang, setHang] = useState<HangalongWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [alreadyJoined, setAlreadyJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    sessionStorage.setItem('postAuthRedirect', `/hang/${hangId}`)

    Promise.all([
      getHangalong(hangId).catch(() => null),
      supabase.auth.getUser().then(({ data }) => data.user?.id ?? null),
    ]).then(([hangData, uid]) => {
      setHang(hangData)
      setUserId(uid)
      setLoading(false)
      if (uid && hangData) {
        sessionStorage.removeItem('postAuthRedirect')
        const isMember = (hangData.members ?? []).some((m: any) => m.user_id === uid)
        setAlreadyJoined(isMember || hangData.creator?.id === uid)
      }
    })
  }, [hangId])

  const handleJoin = async () => {
    if (!userId) {
      sessionStorage.setItem('postAuthRedirect', `/hang/${hangId}`)
      router.push('/')
      return
    }
    setJoining(true)
    setJoinError('')
    try {
      const { ok, chatId } = await joinHangalong(hangId, userId)
      if (!ok) throw new Error('join failed')
      const resolvedChatId = chatId ?? await getHangalongChatId(hangId)
      if (resolvedChatId) router.push(`/chat/${resolvedChatId}`)
      else router.push('/hang')
    } catch {
      setJoinError('Could not join hangout. Please try again.')
      setJoining(false)
    }
  }

  const handleOpenChat = async () => {
    const chatId = await getHangalongChatId(hangId)
    if (chatId) router.push(`/chat/${chatId}`)
    else router.push('/hang')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    )
  }

  if (!hang) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-4xl">🤙</p>
        <p className="text-white font-bold text-lg">Hangout not found</p>
        <p className="text-white/35 text-sm">This invite link may have expired or the hangout is over.</p>
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

  const cfg = ACTIVITY_CONFIG[hang.activity_type] ?? ACTIVITY_CONFIG.other
  const isCreator = !!userId && userId === hang.creator_id
  const spotsLeft = hang.max_people - hang.member_count

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 180px)' }}>

      {/* Hero */}
      <div className="relative shrink-0" style={{ height: 300 }}>
        {hang.photo_url ? (
          <img src={hang.photo_url} alt={hang.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl" style={{ backgroundColor: '#0D0D0D' }}>
            {cfg.emoji}
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 35%, rgba(0,0,0,0.92) 100%)' }}
        />

        <button
          onClick={() => router.back()}
          className="absolute flex items-center justify-center rounded-full"
          style={{
            top: 'calc(env(safe-area-inset-top) + 12px)',
            left: 16,
            width: 36, height: 36,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(10px)',
          } as React.CSSProperties}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div
          className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            top: 'calc(env(safe-area-inset-top) + 12px)',
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(10px)',
          } as React.CSSProperties}
        >
          <span className="text-white font-bold text-xs tracking-wide">TripAlong</span>
        </div>

        <div className="absolute bottom-0 left-0 px-5 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'rgba(240,235,227,0.1)', border: '0.5px solid rgba(240,235,227,0.2)', color: '#F0EBE3' }}
            >
              {cfg.emoji} {cfg.label}
            </span>
            <span className="text-xs font-black tracking-wider" style={{ color: 'rgba(240,235,227,0.5)' }}>
              {WHEN_DISPLAY[hang.when_label]}
            </span>
          </div>
          <h1 className="text-white font-extrabold" style={{ fontSize: 30, letterSpacing: -0.8, lineHeight: 1.1 }}>
            {hang.title}
          </h1>
          <p className="mt-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{hang.location_name}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-5">

        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>👥</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
              {hang.member_count} going · {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
            </span>
          </div>
        </div>

        {hang.creator && (
          <div
            className="flex items-center gap-3 mb-5 p-4 rounded-2xl"
            style={{ backgroundColor: '#0E0E0E', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0">
              {hang.creator.profile_photo ? (
                <img src={hang.creator.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {hang.creator.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Organized by
              </p>
              <p className="text-white font-semibold text-sm truncate mt-0.5">{hang.creator.name}</p>
            </div>
            <div className="ml-auto shrink-0 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(240,235,227,0.07)', border: '0.5px solid rgba(240,235,227,0.12)' }}>
              <span style={{ color: 'rgba(240,235,227,0.55)', fontSize: 11, fontWeight: 600 }}>Organizer</span>
            </div>
          </div>
        )}

        {hang.description?.trim() && (
          <p className="mb-5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
            {hang.description}
          </p>
        )}
      </div>

      {/* CTA */}
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
        {spotsLeft <= 0 && !alreadyJoined ? (
          <div
            className="w-full rounded-2xl flex items-center justify-center font-semibold text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', padding: '16px 0', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            This hangout is full
          </div>
        ) : isCreator || alreadyJoined ? (
          <button
            onClick={handleOpenChat}
            className="w-full rounded-2xl font-bold text-base transition-opacity active:opacity-80"
            style={{ backgroundColor: '#FFFFFF', color: '#000', padding: '16px 0' }}
          >
            Open Group Chat →
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full rounded-2xl font-bold text-base disabled:opacity-55 transition-opacity active:opacity-80"
            style={{ backgroundColor: '#FFFFFF', color: '#000', padding: '16px 0' }}
          >
            {joining ? 'Joining…' : userId ? 'Join Hangout' : 'Sign in to join'}
          </button>
        )}
        {!userId && (
          <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12 }}>
            New to TripAlong?{' '}
            <button
              onClick={() => { sessionStorage.setItem('postAuthRedirect', `/hang/${hangId}`); router.push('/') }}
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
