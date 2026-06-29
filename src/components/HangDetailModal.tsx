'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { joinHangalong, leaveHangalong, getHangalongChatId } from '@/lib/queries'
import { PublicProfileModal } from './PublicProfileModal'
import type { HangalongWithDetails, ActivityType, WhenLabel } from '@/lib/types'

interface Props {
  hang: HangalongWithDetails
  userId: string | null
  isJoined: boolean
  onClose: () => void
  onJoinChange: (joined: boolean) => void
  onAuthRequired?: () => void
}

const ACTIVITY_CONFIG: Record<ActivityType, { emoji: string; label: string; color: string }> = {
  hike:      { emoji: '🥾', label: 'Hike',     color: '#4ade80' },
  road_trip: { emoji: '🚗', label: 'Road Trip', color: '#fb923c' },
  beach:     { emoji: '🏖️', label: 'Beach',     color: '#38bdf8' },
  climbing:  { emoji: '🧗', label: 'Climbing',  color: '#c084fc' },
  urban:     { emoji: '🌆', label: 'Urban',     color: '#94a3b8' },
  day_trip:  { emoji: '🚌', label: 'Day Trip',  color: '#facc15' },
  other:     { emoji: '✨', label: 'Hangout',   color: '#F0EBE3' },
}

const WHEN_DISPLAY: Record<WhenLabel, string> = {
  today:        'TODAY',
  tonight:      'TONIGHT',
  this_weekend: 'THIS WEEKEND',
  this_week:    'THIS WEEK',
}

export function HangDetailModal({ hang, userId, isJoined, onClose, onJoinChange, onAuthRequired }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  useEffect(() => {
    if (isJoined) getHangalongChatId(hang.id).then(id => { if (id) setChatId(id) })
  }, [hang.id, isJoined])
  const cfg = ACTIVITY_CONFIG[hang.activity_type] ?? ACTIVITY_CONFIG.other
  const spotsLeft = hang.max_people - hang.member_count
  const otherMembers = (hang.members ?? []).filter(m => m.user_id !== hang.creator_id)

  async function handleJoin() {
    if (!userId) { onAuthRequired?.(); return }
    setLoading(true)
    haptic(14)
    try {
      if (isJoined) {
        await leaveHangalong(hang.id, userId)
        setChatId(null)
        onJoinChange(false)
      } else {
        const { ok, chatId: newChatId } = await joinHangalong(hang.id, userId)
        if (ok) {
          onJoinChange(true)
          haptic(20)
          if (newChatId) setChatId(newChatId)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
  <>
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 36 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* Header */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ height: 200, background: 'linear-gradient(160deg, #111 0%, #080808 100%)', overflow: 'hidden' }}
      >
        {hang.photo_url ? (
          <>
            <img src={hang.photo_url} alt={hang.title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          </>
        ) : (
          <span style={{ fontSize: 80, opacity: 0.15 }}>{cfg.emoji}</span>
        )}

        <button
          onClick={() => { haptic(6); onClose() }}
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', paddingTop: 'env(safe-area-inset-top)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Activity + time badges */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 13 }}>{cfg.emoji}</span>
            <span className="text-xs font-semibold" style={{ color: '#F0EBE3' }}>{cfg.label}</span>
          </div>
          <div
            className="flex items-center rounded-full px-3 py-1"
            style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.12)', backdropFilter: 'blur(12px)' }}
          >
            <span className="text-xs font-black tracking-wider" style={{ color: 'rgba(240,235,227,0.55)' }}>{WHEN_DISPLAY[hang.when_label]}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
        <h1 className="text-white font-extrabold text-2xl leading-tight mb-2">{hang.title}</h1>

        <div className="flex items-center gap-1.5 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.4)"/>
          </svg>
          <span className="text-white/50 text-sm">{hang.location_name}</span>
        </div>

        {hang.description && (
          <p className="text-white/70 text-sm leading-relaxed mb-5">{hang.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-bold text-lg">{hang.member_count}</p>
            <p className="text-white/40 text-xs">Going</p>
          </div>
          <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-bold text-lg" style={{ color: spotsLeft > 0 ? '#F0EBE3' : '#ff453a' }}>{spotsLeft > 0 ? spotsLeft : '0'}</p>
            <p className="text-white/40 text-xs">Spots left</p>
          </div>
          <div className="flex-1 rounded-xl px-4 py-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-bold text-lg">{hang.max_people}</p>
            <p className="text-white/40 text-xs">Max</p>
          </div>
        </div>

        {/* Who's Going */}
        <div>
          <p className="text-white/40 text-xs font-semibold tracking-wide uppercase mb-3">Who's Going</p>
          <div className="flex flex-col gap-3">
            {/* Creator */}
            <button
              type="button"
              className="flex items-center gap-3 w-full text-left active:opacity-70 transition-opacity"
              onPointerDown={(e) => { e.stopPropagation(); haptic(8); if (hang.creator_id) setProfileUserId(hang.creator_id) }}
            >
              {hang.creator?.profile_photo ? (
                <img src={hang.creator.profile_photo} alt={hang.creator.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                  {hang.creator?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{hang.creator?.name}</p>
                <p className="text-white/35 text-xs">Organizer</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {otherMembers.map(m => (
              <button
                key={m.user_id}
                type="button"
                className="flex items-center gap-3 w-full text-left active:opacity-70 transition-opacity"
                onPointerDown={(e) => { e.stopPropagation(); haptic(8); if (m.user_id !== userId) setProfileUserId(m.user_id) }}
              >
                {m.user?.profile_photo ? (
                  <img src={m.user.profile_photo} alt={m.user.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                    {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <p className="text-white font-semibold text-sm flex-1 min-w-0 truncate">{m.user?.name ?? 'Traveler'}</p>
                {m.user_id !== userId && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 shrink-0 flex flex-col gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        {spotsLeft <= 0 && !isJoined ? (
          <div className="w-full h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
            <span className="text-white/40 font-semibold">This hangout is full</span>
          </div>
        ) : isJoined ? (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { if (chatId) { haptic(10); onClose(); router.push(`/chat/${chatId}`) } }}
              disabled={!chatId || loading}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Open Group Chat
            </motion.button>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full text-center py-2 text-sm disabled:opacity-30 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.22)' }}
            >
              Leave hangout
            </button>
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleJoin}
            disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
          >
            Join Hangout
          </motion.button>
        )}
      </div>
    </motion.div>

    {profileUserId && (
      <PublicProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    )}
  </>
  )
}
