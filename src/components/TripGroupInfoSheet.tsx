'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { leaveTripFromChat, getTripChatMuted, setTripChatMuted } from '@/lib/queries'
import { useOnlineUsers } from '@/lib/presence'
import { PublicProfileModal } from './PublicProfileModal'
import type { TripWithDetails } from '@/lib/types'

interface TripGroupInfoSheetProps {
  chatId: string
  tripInfo: TripWithDetails
  userId: string
  onClose: () => void
  onLeft: () => void
}

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

export function TripGroupInfoSheet({ chatId, tripInfo, userId, onClose, onLeft }: TripGroupInfoSheetProps) {
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const onlineUsers = useOnlineUsers()

  useEffect(() => {
    getTripChatMuted(chatId).then(setMuted)
  }, [chatId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleToggleMute = async () => {
    const next = !muted
    setMuted(next)
    await setTripChatMuted(chatId, next)
  }

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await leaveTripFromChat(tripInfo.id, chatId)
      onLeft()
    } catch (e) {
      console.error('Leave trip error', e)
      setLeaving(false)
      setConfirmLeave(false)
    }
  }

  // Sort: "You" first, creator second, rest alphabetically
  const rawMembers = tripInfo.members ?? []
  const members = [...rawMembers].sort((a: any, b: any) => {
    const aId = a.user?.id
    const bId = b.user?.id
    if (aId === userId) return -1
    if (bId === userId) return 1
    if (aId === tripInfo.creator_id) return -1
    if (bId === tripInfo.creator_id) return 1
    return (a.user?.name ?? '').localeCompare(b.user?.name ?? '')
  })
  const dateStr = formatDates(tripInfo.start_date, tripInfo.end_date)

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 36, mass: 0.85 }}
        className="fixed inset-0 z-[65] flex flex-col"
        style={{ backgroundColor: '#000' }}
      >
        {/* Top bar */}
        <div
          className="shrink-0 flex items-center gap-3 px-4 border-b border-white/8"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)', paddingBottom: 12 }}
        >
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base">Group Info</p>
            <p className="text-white/40 text-xs truncate">
              {tripInfo.destination}{tripInfo.country ? `, ${tripInfo.country}` : ''}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Hero photo */}
          <div className="relative" style={{ height: 220 }}>
            {tripInfo.cover_image ? (
              <img src={tripInfo.cover_image} alt={tripInfo.destination} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: '#111' }}>🌍</div>
            )}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 35%, rgba(0,0,0,0.88) 100%)' }}
            />
            <div className="absolute bottom-0 left-0 px-5 pb-5">
              <p className="text-white font-bold" style={{ fontSize: 26, letterSpacing: -0.5 }}>{tripInfo.destination}</p>
              {tripInfo.country && (
                <div className="flex items-center gap-1.5 mt-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"/>
                    <circle cx="12" cy="10" r="3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{tripInfo.country}</span>
                </div>
              )}
            </div>
          </div>

          {/* Info pills */}
          {(dateStr || tripInfo.budget_level || tripInfo.max_group_size > 0 || tripInfo.pace) && (
            <div className="flex gap-3 px-5 py-4 overflow-x-auto" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              {dateStr && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{dateStr}</span>
                </div>
              )}
              {tripInfo.pace && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 14 }}>
                    {tripInfo.pace === 'slow' ? '🐢' : tripInfo.pace === 'fast' ? '⚡️' : '⚖️'}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, textTransform: 'capitalize' }}>{tripInfo.pace}</span>
                </div>
              )}
              {tripInfo.budget_level && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 14 }}>💰</span>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, textTransform: 'capitalize' }}>{tripInfo.budget_level}</span>
                </div>
              )}
              {tripInfo.max_group_size > 0 && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="8" r="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"/>
                    <path d="M2 20c0-3.3 3.1-6 7-6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="17" cy="9" r="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"/>
                    <path d="M15 19c0-2.5 2-4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Up to {tripInfo.max_group_size}</span>
                </div>
              )}
            </div>
          )}

          {/* Mute toggle row */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/4 active:bg-white/4 transition-colors"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}
          >
            <span className="text-white text-sm font-medium">Mute Notifications</span>
            <div
              className="relative transition-colors"
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                backgroundColor: muted ? '#30D158' : 'rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}
            >
              <div
                className="absolute top-0.5 transition-transform"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  left: 2,
                  transform: muted ? 'translateX(18px)' : 'translateX(0px)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </button>

          {/* Members header */}
          <div className="px-5 pt-5 pb-1">
            <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">
              Members · {members.length}
            </p>
          </div>

          {/* Members list */}
          <div className="px-4 pb-4">
            {members.map((member: any) => {
              const u = member.user
              if (!u) return null
              const isCreator = u.id === tripInfo.creator_id
              const isMe = u.id === userId
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { if (!isMe) setSelectedMemberId(u.id) }}
                  className="w-full flex items-center gap-4 py-3.5"
                  style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)', cursor: isMe ? 'default' : 'pointer' }}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-white/10 overflow-hidden">
                      {u.profile_photo ? (
                        <img src={u.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                          {u.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    {onlineUsers.has(u.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ backgroundColor: '#30D158', border: '2px solid #000' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white text-sm font-semibold truncate">{isMe ? 'You' : u.name}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5">
                      {isCreator && (
                        <span style={{ color: '#F0EBE3', opacity: 0.5 }}>Creator</span>
                      )}
                      {isCreator && onlineUsers.has(u.id) && (
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                      )}
                      {onlineUsers.has(u.id) && (
                        <span style={{ color: '#30D158' }}>Online</span>
                      )}
                    </p>
                  </div>
                  {!isMe && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leave Trip */}
          <div className="px-5 pt-2 pb-10">
            {confirmLeave ? (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0F0F0F', border: '1px solid rgba(255,69,58,0.3)' }}>
                <p className="text-white text-sm font-semibold text-center mb-3">Leave this trip group?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="flex-1 font-semibold text-sm rounded-xl py-2.5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={leaving}
                    className="flex-1 font-semibold text-sm rounded-xl py-2.5 disabled:opacity-50"
                    style={{ backgroundColor: '#FF453A', color: '#fff' }}
                  >
                    {leaving ? 'Leaving...' : 'Leave Trip'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="w-full font-semibold text-sm rounded-2xl py-3.5 transition-opacity hover:opacity-75"
                style={{ color: '#FF453A', border: '1px solid rgba(255,69,58,0.3)' }}
              >
                Leave Trip
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Member profile — z-[70] from PublicProfileModal's own portal */}
      {selectedMemberId && (
        <PublicProfileModal userId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />
      )}
    </>
  )
}
