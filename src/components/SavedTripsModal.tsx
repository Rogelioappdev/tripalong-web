'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSavedTrips, getMyTrips, unsaveTrip, leaveTrip, joinTrip, saveTrip } from '@/lib/queries'
import type { TripWithDetails } from '@/lib/types'

interface Props {
  userId: string
  onClose: () => void
  onOpenChat: (tripId: string) => void
}

type MainTab = 'saved' | 'mytrips'
type MyTripsSubTab = 'in' | 'maybe'

function formatDates(trip: TripWithDetails) {
  if (trip.is_flexible_dates || !trip.start_date) return 'Flexible dates'
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return trip.end_date ? `${fmt(trip.start_date)} – ${fmt(trip.end_date)}` : fmt(trip.start_date)
}

export function SavedTripsModal({ userId, onClose, onOpenChat }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('saved')
  const [subTab, setSubTab] = useState<MyTripsSubTab>('in')
  const [confirmUnsave, setConfirmUnsave] = useState<TripWithDetails | null>(null)
  const [localJoined, setLocalJoined] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const { data: savedTrips = [], isLoading: savedLoading } = useQuery({
    queryKey: ['saved-trips', userId],
    queryFn: () => getSavedTrips(userId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: myTrips = [], isLoading: myLoading } = useQuery({
    queryKey: ['my-trips', userId],
    queryFn: () => getMyTrips(userId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const tripsIn = myTrips.filter(t =>
    t.members?.find(m => m.user_id === userId)?.status === 'in'
  )
  const tripsMaybe = myTrips.filter(t =>
    t.members?.find(m => m.user_id === userId)?.status === 'maybe'
  )
  const currentMyTrips = subTab === 'in' ? tripsIn : tripsMaybe

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['saved-trips', userId] })
    qc.invalidateQueries({ queryKey: ['my-trips', userId] })
  }, [qc, userId])

  const handleJoin = async (trip: TripWithDetails) => {
    setLocalJoined(s => new Set([...s, trip.id]))
    try {
      await joinTrip(trip.id, userId)
      invalidate()
    } catch {}
  }

  const handleUnsave = async (trip: TripWithDetails) => {
    setConfirmUnsave(null)
    try {
      await unsaveTrip(trip.id, userId)
      invalidate()
    } catch {}
  }

  const handleLeave = async (tripId: string) => {
    try {
      await leaveTrip(tripId, userId)
      invalidate()
    } catch {}
  }

  const isJoined = (trip: TripWithDetails) =>
    localJoined.has(trip.id) ||
    trip.members?.some(m => m.user_id === userId && m.status === 'in')

  // Lock body scroll and block touch events from reaching the swipe feed behind
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const stopEvents = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <>
      {/* Backdrop — absorbs all pointer/touch so nothing reaches SwipeCard */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        onPointerDown={stopEvents}
        onTouchStart={stopEvents}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] overflow-hidden flex flex-col"
        style={{
          backgroundColor: '#0d0d0d',
          maxHeight: '88dvh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          touchAction: 'pan-y',
        }}
        onPointerDown={stopEvents}
        onTouchStart={stopEvents}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div>
            <h2 className="text-white font-extrabold text-xl tracking-tight">
              {mainTab === 'saved' ? 'Saved Trips' : 'My Trips'}
            </h2>
            <p className="text-white/35 text-xs mt-0.5">
              {mainTab === 'saved'
                ? `${savedTrips.length} trip${savedTrips.length !== 1 ? 's' : ''} saved`
                : `${myTrips.length} trip${myTrips.length !== 1 ? 's' : ''} joined`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 px-5 pb-3 shrink-0">
          <button
            onClick={() => setMainTab('saved')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={mainTab === 'saved'
              ? { backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.2)' }
              : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Saved ({savedTrips.length})
          </button>
          <button
            onClick={() => setMainTab('mytrips')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={mainTab === 'mytrips'
              ? { backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.2)' }
              : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            My Trips ({myTrips.length})
          </button>
        </div>

        {/* Sub-tabs for My Trips */}
        {mainTab === 'mytrips' && (
          <div className="flex gap-2 px-5 pb-3 shrink-0">
            <button
              onClick={() => setSubTab('in')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={subTab === 'in'
                ? { backgroundColor: 'rgba(48,209,88,0.15)', color: '#30D158', border: '0.5px solid rgba(48,209,88,0.35)' }
                : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.35)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              ✓ I'm In ({tripsIn.length})
            </button>
            <button
              onClick={() => setSubTab('maybe')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={subTab === 'maybe'
                ? { backgroundColor: 'rgba(255,214,10,0.12)', color: '#FFD60A', border: '0.5px solid rgba(255,214,10,0.3)' }
                : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.35)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              ⏰ Maybe ({tripsMaybe.length})
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-white/6 mx-5 shrink-0" />

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {mainTab === 'saved' && (
            savedLoading ? (
              <LoadingState />
            ) : savedTrips.length === 0 ? (
              <EmptyState icon="bookmark" message="No saved trips yet" sub="Browse trips and tap Save to add them here" />
            ) : (
              savedTrips.map(trip => (
                <SavedTripCard
                  key={trip.id}
                  trip={trip}
                  userId={userId}
                  joined={isJoined(trip)}
                  onJoin={() => handleJoin(trip)}
                  onUnsave={() => setConfirmUnsave(trip)}
                  onOpenChat={() => onOpenChat(trip.id)}
                />
              ))
            )
          )}

          {mainTab === 'mytrips' && (
            myLoading ? (
              <LoadingState />
            ) : currentMyTrips.length === 0 ? (
              <EmptyState
                icon="check"
                message={subTab === 'in' ? "Not in any trips yet" : "No maybe trips"}
                sub={subTab === 'in' ? 'Join trips from the feed to see them here' : 'Mark trips as Maybe to see them here'}
              />
            ) : (
              currentMyTrips.map(trip => (
                <MyTripCard
                  key={trip.id}
                  trip={trip}
                  userId={userId}
                  subTab={subTab}
                  onLeave={() => handleLeave(trip.id)}
                  onOpenChat={() => onOpenChat(trip.id)}
                />
              ))
            )
          )}
        </div>
      </div>

      {/* Unsave confirm sheet */}
      {confirmUnsave && (
        <UnsaveConfirmSheet
          trip={confirmUnsave}
          onConfirm={() => handleUnsave(confirmUnsave)}
          onCancel={() => setConfirmUnsave(null)}
        />
      )}
    </>
  )
}

function SavedTripCard({ trip, userId, joined, onJoin, onUnsave, onOpenChat }: {
  trip: TripWithDetails
  userId: string
  joined: boolean
  onJoin: () => void
  onUnsave: () => void
  onOpenChat: () => void
}) {
  const memberCount = trip.members?.filter(m => m.status === 'in').length ?? 0
  const dates = formatDates(trip)

  return (
    <div
      className="rounded-[22px] overflow-hidden"
      style={{ backgroundColor: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Cover image */}
      <div className="relative h-48">
        {trip.cover_image ? (
          <img src={trip.cover_image} alt={trip.destination} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-5xl">🌍</div>
        )}
        {/* Gradient */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.65) 65%, rgba(0,0,0,0.97) 100%)'
        }} />
        {/* SAVED badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
              stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[#F0EBE3] text-[10px] font-bold tracking-wide">SAVED</span>
        </div>
        {/* Tap to view */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
          <span className="text-white/60 text-[10px]">Tap to view →</span>
        </div>
        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          {trip.country && (
            <div className="flex items-center gap-1 mb-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.5)"/>
              </svg>
              <span className="text-white/50 text-[11px]">{trip.country}</span>
            </div>
          )}
          <h3 className="text-white font-extrabold text-2xl leading-tight tracking-tight">{trip.destination}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            {trip.start_date && (
              <div className="flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-white/45 text-xs">{dates}</span>
              </div>
            )}
            {memberCount > 0 && (
              <div className="flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-white/45 text-xs">{memberCount} going</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-3.5 pt-2 space-y-2.5">
        {/* Pass / Join / Unsave row */}
        <div className="flex items-center justify-evenly">
          {/* Pass */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onUnsave}
              className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: '#2a0e0e', border: '1.5px solid #FF453A' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
            <span className="text-white/40 text-[11px]">Pass</span>
          </div>

          {/* Join / Joined */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={joined ? undefined : onJoin}
              className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={joined
                ? { backgroundColor: '#ffffff' }
                : { backgroundColor: '#1a3d25', border: '2px solid #30D158' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5"
                  stroke={joined ? '#000000' : '#30D158'}
                  strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-[11px]" style={{ color: joined ? '#ffffff' : 'rgba(255,255,255,0.4)' }}>
              {joined ? 'Joined' : 'Join'}
            </span>
          </div>

          {/* Unsave */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onUnsave}
              className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: '#1e1c14', border: '1.5px solid rgba(240,235,227,0.45)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                  stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-white/40 text-[11px]">Unsave</span>
          </div>
        </div>

        {/* Chat button */}
        <button
          onClick={onOpenChat}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white/55 text-sm font-semibold">
            {joined ? 'Open Chat' : 'Join Group Chat to learn more'}
          </span>
        </button>
      </div>
    </div>
  )
}

function MyTripCard({ trip, userId, subTab, onLeave, onOpenChat }: {
  trip: TripWithDetails
  userId: string
  subTab: MyTripsSubTab
  onLeave: () => void
  onOpenChat: () => void
}) {
  const memberCount = trip.members?.filter(m => m.status === 'in').length ?? 0
  const dates = formatDates(trip)

  return (
    <div
      className="rounded-[22px] overflow-hidden"
      style={{ backgroundColor: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Cover image */}
      <div className="relative h-44">
        {trip.cover_image ? (
          <img src={trip.cover_image} alt={trip.destination} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-5xl">🌍</div>
        )}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.97) 100%)'
        }} />
        {/* Status badge */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full"
          style={subTab === 'in'
            ? { backgroundColor: 'rgba(48,209,88,0.2)', border: '0.5px solid rgba(48,209,88,0.4)' }
            : { backgroundColor: 'rgba(255,214,10,0.15)', border: '0.5px solid rgba(255,214,10,0.35)' }}
        >
          <span className="text-[10px] font-bold" style={{ color: subTab === 'in' ? '#30D158' : '#FFD60A' }}>
            {subTab === 'in' ? '✓ I\'m In' : '⏰ Maybe'}
          </span>
        </div>
        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          {trip.country && (
            <span className="text-white/50 text-[11px]">{trip.country}</span>
          )}
          <h3 className="text-white font-extrabold text-2xl leading-tight tracking-tight">{trip.destination}</h3>
          <div className="flex items-center gap-3 mt-1">
            {trip.start_date && <span className="text-white/45 text-xs">{dates}</span>}
            {memberCount > 0 && <span className="text-white/45 text-xs">{memberCount} going</span>}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-3 pb-3.5 pt-2 space-y-2.5">
        {/* Status row */}
        <div className="flex items-center gap-2">
          {/* I'm In */}
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-semibold transition-all"
            style={subTab === 'in'
              ? { backgroundColor: 'rgba(48,209,88,0.15)', color: '#30D158', border: '1px solid rgba(48,209,88,0.4)' }
              : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            ✓ I'm In
          </button>
          {/* Maybe */}
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-semibold transition-all"
            style={subTab === 'maybe'
              ? { backgroundColor: 'rgba(255,214,10,0.12)', color: '#FFD60A', border: '1px solid rgba(255,214,10,0.35)' }
              : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            ⏰ Maybe
          </button>
          {/* Leave */}
          <button
            onClick={onLeave}
            className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform shrink-0"
            style={{ backgroundColor: 'rgba(255,69,58,0.08)', border: '0.5px solid rgba(255,69,58,0.3)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Message Group */}
        <button
          onClick={onOpenChat}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white/55 text-sm font-semibold">Message Group</span>
        </button>
      </div>
    </div>
  )
}

function UnsaveConfirmSheet({ trip, onConfirm, onCancel }: {
  trip: TripWithDetails
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onCancel}
        onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />
      <div
        className="fixed bottom-0 left-0 right-0 z-70 rounded-t-[28px] overflow-hidden"
        style={{
          backgroundColor: '#111',
          paddingBottom: 'env(safe-area-inset-bottom)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          touchAction: 'pan-y',
        }}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {/* Trip thumbnail */}
        <div className="px-5 pt-2 pb-4">
          <div className="relative rounded-2xl overflow-hidden h-32 mb-4">
            {trip.cover_image ? (
              <img src={trip.cover_image} alt={trip.destination} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-4xl">🌍</div>
            )}
            <div className="absolute inset-0 flex items-end p-3"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)' }}>
              <div>
                <p className="text-white/60 text-xs">{trip.country}</p>
                <p className="text-white font-bold text-lg">{trip.destination}</p>
              </div>
            </div>
          </div>
          <p className="text-white/50 text-sm text-center mb-4">Remove this trip from your saved list?</p>
          <button
            onClick={onConfirm}
            className="w-full py-4 rounded-2xl font-bold text-base mb-3 active:opacity-80 transition-opacity"
            style={{ backgroundColor: '#FF453A', color: '#fff' }}
          >
            Remove from Saved
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 rounded-2xl font-semibold text-base active:opacity-70 transition-opacity"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

function LoadingState() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
      <span className="text-4xl">{icon === 'bookmark' ? '🔖' : '✈️'}</span>
      <p className="text-white font-semibold text-base">{message}</p>
      <p className="text-white/35 text-sm">{sub}</p>
    </div>
  )
}
