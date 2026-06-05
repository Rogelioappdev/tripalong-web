'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { joinTrip, getTripMembership, getTrip, joinTripChat, saveTrip, getProfile } from '@/lib/queries'
import { getTripMatchBreakdown, getMatchingVibes, memberCompatibility } from '@/lib/matching'
import { hasPlus } from '@/lib/trial'
import { PublicProfileModal } from './PublicProfileModal'
import { JoinCelebration } from './JoinCelebration'
import { ProfilePhotoNudge } from './ProfilePhotoNudge'
import { FoundingMemberPaywall } from './FoundingMemberPaywall'
import { FoundingMemberScreen } from './FoundingMemberScreen'
import { getTrialStatus } from '@/lib/trial'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails, UserProfile } from '@/lib/types'

interface TripDetailModalProps {
  trip: TripWithDetails
  onClose: () => void
  isGuest?: boolean
  initialProfile?: UserProfile | null
  onAuthRequired?: (destination?: string) => void
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

export function TripDetailModal({ trip, onClose, isGuest, initialProfile, onAuthRequired }: TripDetailModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showPhotoNudge, setShowPhotoNudge] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null)
  const [showCompatPaywall, setShowCompatPaywall] = useState(false)
  const [compatPaywallContext, setCompatPaywallContext] = useState<{ matchPct: number; destination?: string } | undefined>()
  const [showCompatTrialOffer, setShowCompatTrialOffer] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Only fetch if not provided by parent — avoids duplicate network call
  useEffect(() => {
    if (!initialProfile && userId) getProfile(userId).then(p => setUserProfile(p))
  }, [userId, initialProfile])

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
    onSuccess: async () => {
      haptic([15, 30, 15, 30, 60])
      queryClient.invalidateQueries({ queryKey: ['membership', trip.id, userId] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      const profile = userId ? await getProfile(userId) : null
      if (!profile?.profile_photo) {
        setShowPhotoNudge(true)
      } else {
        setShowCelebration(true)
      }
    },
  })

  const handleShare = async () => {
    haptic(8)
    const text = `Check out this ${displayTrip.destination}${displayTrip.country ? `, ${displayTrip.country}` : ''} trip on TripAlong 🌍✈️`
    const url = `${window.location.origin}/trip/${displayTrip.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${displayTrip.destination} — TripAlong`, text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
      }
    } catch {}
  }

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

  const openCompatibilityGate = (score?: number) => {
    haptic(8)
    if (getTrialStatus(userProfile) === 'none') {
      setShowCompatTrialOffer(true)
    } else {
      setCompatPaywallContext(score !== undefined ? { matchPct: score, destination: displayTrip.destination } : undefined)
      setShowCompatPaywall(true)
    }
  }

  const { tripPct, groupPct } = userProfile ? getTripMatchBreakdown(userProfile, displayTrip) : { tripPct: 0, groupPct: null }
  const matchPct = userProfile ? (groupPct ?? tripPct) : undefined
  const matchingVibes = userProfile ? getMatchingVibes(userProfile, displayTrip) : []
  const isPlus = hasPlus(userProfile)
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
    <>
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — no overflow-hidden here so nested scroll containers and portals work on iOS */}
      <div
        className="relative w-full sm:max-w-lg flex flex-col"
        style={{
          backgroundColor: '#000',
          borderRadius: '28px 28px 0 0',
          height: '92dvh',
        }}
      >
        {/* ── Hero — overflow-hidden scoped here for the rounded-corner image clip ── */}
        <div className="relative shrink-0 overflow-hidden" style={{ height: '44dvh', borderRadius: '28px 28px 0 0' }}>
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
            onClick={() => { haptic(8); onClose() }}
            className="absolute flex items-center justify-center active:scale-90 transition-transform"
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

          {/* Share */}
          <button
            onClick={handleShare}
            className="absolute flex items-center justify-center active:scale-90 transition-transform"
            style={{
              top: 16, right: 16,
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: '0.5px solid rgba(255,255,255,0.15)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke="white" strokeWidth="2"/>
              <circle cx="6" cy="12" r="3" stroke="white" strokeWidth="2"/>
              <circle cx="18" cy="19" r="3" stroke="white" strokeWidth="2"/>
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="white" strokeWidth="2" strokeLinecap="round"/>
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
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

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

            {/* Compatibility */}
            {!isGuest && matchPct !== undefined && (
              <div>
                <p className="text-white font-bold" style={{ fontSize: 17, marginBottom: 12 }}>Your Compatibility</p>
                {isPlus ? (
                  <div
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  >
                    {/* Scores row */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {/* Group score — primary */}
                      {groupPct !== null && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Group</p>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                            <span style={{
                              fontSize: 32, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1,
                              color: groupPct >= 80 ? '#30D158' : groupPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.55)',
                            }}>{groupPct}</span>
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 600 }}>%</span>
                          </div>
                          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                            {groupPct >= 80 ? 'You\'ll vibe' : groupPct >= 60 ? 'Good fit' : 'Different styles'}
                          </p>
                        </div>
                      )}
                      {/* Divider */}
                      {groupPct !== null && (
                        <div style={{ width: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
                      )}
                      {/* Trip score — secondary */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trip</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{
                            fontSize: 32, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1,
                            color: tripPct >= 80 ? '#30D158' : tripPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.55)',
                          }}>{tripPct}</span>
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 600 }}>%</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                          {tripPct >= 80 ? 'Perfect fit' : tripPct >= 60 ? 'Good match' : 'Explore anyway'}
                        </p>
                      </div>
                    </div>
                    {/* Matching vibes */}
                    {matchingVibes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                        {matchingVibes.map(v => (
                          <span key={v} style={{
                            padding: '4px 10px', borderRadius: 999,
                            backgroundColor: 'rgba(240,235,227,0.07)',
                            border: '0.5px solid rgba(240,235,227,0.15)',
                            color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500,
                          }}>{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Free: same layout as Plus but numbers blurred — FOMO
                  <div
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  >
                    <div style={{ display: 'flex', gap: 10 }}>
                      {groupPct !== null && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Group</p>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                            <span style={{
                              fontSize: 32, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1,
                              color: groupPct >= 80 ? '#30D158' : groupPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.55)',
                              filter: 'blur(7px)', userSelect: 'none',
                            }}>{groupPct}</span>
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 600, filter: 'blur(5px)' }}>%</span>
                          </div>
                        </div>
                      )}
                      {groupPct !== null && (
                        <div style={{ width: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trip</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{
                            fontSize: 32, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1,
                            color: tripPct >= 80 ? '#30D158' : tripPct >= 60 ? '#FFD60A' : 'rgba(255,255,255,0.55)',
                            filter: 'blur(7px)', userSelect: 'none',
                          }}>{tripPct}</span>
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 600, filter: 'blur(5px)' }}>%</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCompatibilityGate(groupPct ?? tripPct)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:opacity-70"
                      style={{ backgroundColor: 'rgba(240,235,227,0.07)', border: '0.5px solid rgba(240,235,227,0.15)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(240,235,227,0.6)" strokeWidth="2"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="rgba(240,235,227,0.6)" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span style={{ color: 'rgba(240,235,227,0.6)', fontSize: 13, fontWeight: 600 }}>Unlock your scores</span>
                    </button>
                  </div>
                )}
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
                <div className="flex gap-4 overflow-x-auto mt-3 pb-1">
                  {members.map(m => {
                    const rawMember = (displayTrip.members ?? []).find(dm => dm.user_id === m.id)
                    // Compute score for everyone — free users see color hint, Plus sees the number
                    const score = (userProfile && rawMember?.user && m.id !== userId)
                      ? memberCompatibility(userProfile, rawMember.user as any)
                      : null
                    const scoreColor = score === null ? null
                      : score >= 80 ? '#30D158'
                      : score >= 60 ? '#FFD60A'
                      : 'rgba(255,255,255,0.35)'
                    const borderColor = m.isCreator
                      ? '#F0EBE3'
                      : scoreColor ?? 'rgba(255,255,255,0.12)'

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); isPlus ? (haptic(8), setProfileUserId(m.id)) : openCompatibilityGate(score ?? undefined) }}
                        className="flex flex-col items-center shrink-0 active:opacity-75 transition-opacity"
                        style={{ touchAction: 'manipulation', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', gap: 4 } as React.CSSProperties}
                      >
                        <div
                          className="overflow-hidden"
                          style={{
                            width: 56, height: 56, borderRadius: 28,
                            border: `2px solid ${borderColor}`,
                            boxShadow: scoreColor && score !== null && score >= 80
                              ? `0 0 10px ${scoreColor}40`
                              : undefined,
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
                          style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, maxWidth: 64 }}
                        >
                          {m.name.split(' ')[0]}
                        </span>
                        {m.isCreator ? (
                          <span style={{ color: '#F0EBE3', fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: -2, fontWeight: 600 }}>
                            Creator
                          </span>
                        ) : score !== null ? (
                          isPlus ? (
                            <span style={{ color: scoreColor!, fontSize: 11, fontWeight: 700, marginTop: -2 }}>
                              {score}%
                            </span>
                          ) : (
                            // Free: colored '?' — reveals quality, hides the number
                            <span style={{ color: scoreColor!, fontSize: 11, fontWeight: 700, marginTop: -2 }}>
                              ?%
                            </span>
                          )
                        ) : null}
                      </button>
                    )
                  })}
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
              onClick={() => { haptic(10); openChat() }}
              className="w-full font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#000', padding: '16px' }}
            >
              Open Group Chat
            </button>
          ) : (
            <button
              onClick={() => { haptic(10); isGuest ? onAuthRequired?.(displayTrip.destination) : joinMutation.mutate() }}
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
      <PublicProfileModal
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        onAuthRequired={isGuest ? () => { setProfileUserId(null); onAuthRequired?.() } : undefined}
      />
    )}

    <AnimatePresence>
      {showPhotoNudge && userId && (
        <ProfilePhotoNudge
          trip={displayTrip}
          userId={userId}
          onDone={() => { setShowPhotoNudge(false); setShowCelebration(true) }}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showCelebration && (
        <JoinCelebration
          trip={displayTrip}
          onOpenChat={() => { setShowCelebration(false); openChat() }}
          onClose={() => { setShowCelebration(false); onClose() }}
        />
      )}
    </AnimatePresence>

    {showCompatPaywall && (
      <FoundingMemberPaywall
        allowDismiss
        context={compatPaywallContext}
        onClose={() => { setShowCompatPaywall(false); setCompatPaywallContext(undefined) }}
      />
    )}

    {showCompatTrialOffer && userId && userProfile && (
      <FoundingMemberScreen
        userId={userId}
        profile={userProfile}
        onClaimed={(updated) => { setUserProfile(updated) }}
        onDismiss={() => setShowCompatTrialOffer(false)}
      />
    )}
    </>
  )
}
