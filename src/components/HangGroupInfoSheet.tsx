'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { leaveHangalongFromChat } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { PublicProfileModal } from './PublicProfileModal'
import type { HangalongWithDetails, ActivityType, WhenLabel } from '@/lib/types'

const ACTIVITY_CONFIG: Record<ActivityType, { emoji: string; label: string; color: string; bg: string }> = {
  hike:      { emoji: '🥾', label: 'Hike',      color: '#4ade80', bg: 'linear-gradient(160deg, #0f2218 0%, #0a140d 100%)' },
  road_trip: { emoji: '🚗', label: 'Road Trip',  color: '#fb923c', bg: 'linear-gradient(160deg, #2a1500 0%, #1a0d00 100%)' },
  beach:     { emoji: '🏖️', label: 'Beach',      color: '#38bdf8', bg: 'linear-gradient(160deg, #001f2e 0%, #000d14 100%)' },
  climbing:  { emoji: '🧗', label: 'Climbing',   color: '#c084fc', bg: 'linear-gradient(160deg, #1a0a2e 0%, #0d0518 100%)' },
  urban:     { emoji: '🌆', label: 'Urban',      color: '#94a3b8', bg: 'linear-gradient(160deg, #111827 0%, #060810 100%)' },
  day_trip:  { emoji: '🚌', label: 'Day Trip',   color: '#facc15', bg: 'linear-gradient(160deg, #1f1800 0%, #100c00 100%)' },
  other:     { emoji: '✨', label: 'Hangout',    color: '#F0EBE3', bg: 'linear-gradient(160deg, #111 0%, #080808 100%)' },
}

const WHEN_DISPLAY: Record<WhenLabel, string> = {
  today:        'TODAY',
  tonight:      'TONIGHT',
  this_weekend: 'THIS WEEKEND',
  this_week:    'THIS WEEK',
}

interface HangGroupInfoSheetProps {
  chatId: string
  hangInfo: HangalongWithDetails
  userId: string
  onClose: () => void
  onLeft: () => void
}

export function HangGroupInfoSheet({ chatId, hangInfo, userId, onClose, onLeft }: HangGroupInfoSheetProps) {
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)

  const cfg = ACTIVITY_CONFIG[hangInfo.activity_type] ?? ACTIVITY_CONFIG.other
  const memberCount = hangInfo.member_count
  const spotsLeft = hangInfo.max_people - memberCount
  const hasDescription = !!hangInfo.description?.trim()
  const descLong = (hangInfo.description?.length ?? 0) > 120

  const allMembers = [...(hangInfo.members ?? [])].sort((a, b) => {
    if (a.user_id === userId) return -1
    if (b.user_id === userId) return 1
    if (a.user_id === hangInfo.creator_id) return -1
    if (b.user_id === hangInfo.creator_id) return 1
    return (a.user?.name ?? '').localeCompare(b.user?.name ?? '')
  })

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await leaveHangalongFromChat(hangInfo.id, chatId)
      onLeft()
    } catch (e) {
      console.error('Leave hangout error', e)
      setLeaving(false)
      setConfirmLeave(false)
    }
  }

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
            onClick={() => { haptic(8); onClose() }}
            className="flex items-center gap-1.5 text-white/40 hover:text-white active:scale-90 transition-all shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base">Group Info</p>
            <p className="text-white/40 text-xs truncate">
              {hangInfo.title} · {memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Hero */}
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{ height: 220, background: cfg.bg }}
          >
            {hangInfo.photo_url ? (
              <>
                <img src={hangInfo.photo_url} alt={hangInfo.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 35%, rgba(0,0,0,0.88) 100%)' }} />
              </>
            ) : (
              <span style={{ fontSize: 100, opacity: 0.1, userSelect: 'none' }}>{cfg.emoji}</span>
            )}
            <div className="absolute bottom-0 left-0 px-5 pb-5 w-full">
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                <span className="text-xs font-bold tracking-wide" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <p className="text-white font-bold leading-tight" style={{ fontSize: 22, letterSpacing: -0.4 }}>{hangInfo.title}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.5)"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{hangInfo.location_name}</span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div
            className="grid grid-cols-2 gap-2.5 px-5 py-4"
            style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
          >
            <div className="rounded-2xl p-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/35 text-xs mb-1">When</p>
              <p className="text-white/80 text-sm font-semibold">⏰ {WHEN_DISPLAY[hangInfo.when_label]}</p>
            </div>
            <div className="rounded-2xl p-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/35 text-xs mb-1">Spots</p>
              <p className="text-white/80 text-sm font-semibold">
                👥 {spotsLeft > 0 ? `${spotsLeft} left of ${hangInfo.max_people}` : `Full (${hangInfo.max_people})`}
              </p>
            </div>
          </div>

          {/* Description */}
          {hasDescription && (
            <div className="px-5 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-2">About</p>
              <p
                className="text-white/70 text-sm leading-relaxed"
                style={!descExpanded ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties : undefined}
              >
                {hangInfo.description}
              </p>
              {descLong && (
                <button
                  type="button"
                  onClick={() => setDescExpanded(p => !p)}
                  className="text-xs mt-1.5 font-semibold transition-opacity hover:opacity-70"
                  style={{ color: '#F0EBE3', opacity: 0.5 }}
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Members header */}
          <div className="px-5 pt-5 pb-1">
            <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">
              Members · {memberCount}
            </p>
          </div>

          {/* Members list */}
          <div className="px-4 pb-4">
            {allMembers.map((member) => {
              const u = member.user
              if (!u) return null
              const isCreator = member.user_id === hangInfo.creator_id
              const isMe = member.user_id === userId
              return (
                <button
                  key={member.user_id}
                  type="button"
                  onClick={() => { if (!isMe) { haptic(8); setSelectedMemberId(member.user_id) } }}
                  className="w-full flex items-center gap-4 py-3.5"
                  style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)', cursor: isMe ? 'default' : 'pointer' }}
                >
                  <div className="w-11 h-11 rounded-full bg-white/10 overflow-hidden shrink-0">
                    {u.profile_photo ? (
                      <img src={u.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white text-sm font-semibold truncate">{isMe ? 'You' : u.name}</p>
                    {isCreator && (
                      <p className="text-xs mt-0.5" style={{ color: '#F0EBE3', opacity: 0.5 }}>Creator</p>
                    )}
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

          {/* Leave Hangout */}
          <div className="px-5 pt-2 pb-10">
            {confirmLeave ? (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0F0F0F', border: '1px solid rgba(255,69,58,0.3)' }}>
                <p className="text-white text-sm font-semibold text-center mb-3">Leave this hangout?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { haptic(8); setConfirmLeave(false) }}
                    className="flex-1 font-semibold text-sm rounded-xl py-2.5 active:scale-95 transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { haptic(18); handleLeave() }}
                    disabled={leaving}
                    className="flex-1 font-semibold text-sm rounded-xl py-2.5 disabled:opacity-50"
                    style={{ backgroundColor: '#FF453A', color: '#fff' }}
                  >
                    {leaving ? 'Leaving...' : 'Leave Hangout'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { haptic(8); setConfirmLeave(true) }}
                className="w-full font-semibold text-sm rounded-2xl py-3.5 active:scale-[0.98] transition-all hover:opacity-75"
                style={{ color: '#FF453A', border: '1px solid rgba(255,69,58,0.3)' }}
              >
                Leave Hangout
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {selectedMemberId && (
        <PublicProfileModal userId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />
      )}
    </>
  )
}
