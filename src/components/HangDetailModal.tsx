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
  const [justJoined, setJustJoined] = useState(false)

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
          haptic([10, 30, 10, 30, 60])
          setJustJoined(true)
          if (newChatId) setChatId(newChatId)
          setTimeout(() => setJustJoined(false), 1800)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
  <>
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop — same as TripDetailModal */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={() => { haptic(6); onClose() }}
      />

      {/* Sheet — clip-path zoom, identical spring to TripDetailModal */}
      <motion.div
        initial={{ clipPath: 'inset(6% 3% 32% 3% round 22px)', opacity: 0.92 }}
        animate={{ clipPath: 'inset(0% 0% 0% 0% round 28px 28px 0 0)', opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 1.0 }}
        className="relative w-full sm:max-w-lg flex flex-col"
        style={{ backgroundColor: '#0a0a0a', borderRadius: '28px 28px 0 0', height: '92dvh' }}
      >
      {/* Hero — overflow-hidden scoped here for rounded corner image clip */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ height: 260, borderRadius: '28px 28px 0 0' }}
      >
        {hang.photo_url ? (
          <img src={hang.photo_url} alt={hang.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 100%)' }}>
            <span style={{ fontSize: 90, opacity: 0.12 }}>{cfg.emoji}</span>
          </div>
        )}

        {/* Scrim */}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.28)' }} />

        {/* Bottom gradient bleeds into sheet background */}
        <div className="absolute bottom-0 left-0 right-0 h-28" style={{ background: 'linear-gradient(to bottom, transparent, #0a0a0a)' }} />

        {/* Close button */}
        <button
          onClick={() => { haptic(6); onClose() }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Activity + time badges */}
        <div className="absolute bottom-5 left-5 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ backgroundColor: 'rgba(240,235,227,0.1)', border: '0.5px solid rgba(240,235,227,0.22)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
            <span className="text-xs font-semibold" style={{ color: '#F0EBE3' }}>{cfg.label}</span>
          </div>
          <div
            className="flex items-center rounded-full px-3 py-1"
            style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.12)', backdropFilter: 'blur(12px)' }}
          >
            <span className="text-xs font-black tracking-wider" style={{ color: 'rgba(240,235,227,0.5)' }}>{WHEN_DISPLAY[hang.when_label]}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ marginTop: -8 }}>

        <h1 className="text-white font-extrabold leading-tight mb-1.5" style={{ fontSize: 'clamp(22px, 6vw, 28px)' }}>
          {hang.title}
        </h1>

        <div className="flex items-center gap-1.5 mb-5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(255,255,255,0.35)"/>
          </svg>
          <span className="text-white/40 text-sm">{hang.location_name}</span>
        </div>

        {hang.description && (
          <p className="text-white/60 text-sm leading-relaxed mb-5">{hang.description}</p>
        )}

        {/* Stats — unified card with dividers */}
        <div
          className="flex items-stretch rounded-2xl mb-6 overflow-hidden"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex-1 py-4 text-center">
            <p className="text-white font-bold text-xl">{hang.member_count}</p>
            <p className="text-white/35 text-xs mt-0.5">Going</p>
          </div>
          <div className="w-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <div className="flex-1 py-4 text-center">
            <p className="font-bold text-xl" style={{ color: spotsLeft > 0 ? '#F0EBE3' : '#ff453a' }}>{spotsLeft}</p>
            <p className="text-white/35 text-xs mt-0.5">Spots Left</p>
          </div>
          <div className="w-px my-3" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <div className="flex-1 py-4 text-center">
            <p className="text-white font-bold text-xl">{hang.max_people}</p>
            <p className="text-white/35 text-xs mt-0.5">Max</p>
          </div>
        </div>

        {/* Who's Going */}
        <div>
          <p className="text-white/30 text-xs font-semibold tracking-widest uppercase mb-3">Who's Going</p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}
          >
            {/* Creator */}
            <button
              type="button"
              className="flex items-center gap-3 w-full text-left px-4 py-3.5 active:bg-white/5 transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); haptic(8); if (hang.creator_id) setProfileUserId(hang.creator_id) }}
            >
              {hang.creator?.profile_photo ? (
                <img src={hang.creator.profile_photo} alt={hang.creator.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {hang.creator?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{hang.creator?.name}</p>
                <p className="text-white/30 text-xs">Organizer</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {otherMembers.map((m, i) => (
              <div key={m.user_id}>
                <div className="h-px mx-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                <button
                  type="button"
                  className="flex items-center gap-3 w-full text-left px-4 py-3.5 active:bg-white/5 transition-colors"
                  onPointerDown={(e) => { e.stopPropagation(); haptic(8); if (m.user_id !== userId) setProfileUserId(m.user_id) }}
                >
                  {m.user?.profile_photo ? (
                    <img src={m.user.profile_photo} alt={m.user.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <p className="text-white font-semibold text-sm flex-1 min-w-0 truncate">{m.user?.name ?? 'Traveler'}</p>
                  {m.user_id !== userId && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pt-3 shrink-0 flex flex-col gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        {spotsLeft <= 0 && !isJoined ? (
          <div className="w-full h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <span className="text-white/30 font-semibold text-sm">This hangout is full</span>
          </div>
        ) : justJoined ? (
          <motion.div
            key="success"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-2.5"
            style={{ backgroundColor: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.35)' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.08 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
            <span className="font-bold text-base" style={{ color: '#30D158' }}>You're in!</span>
          </motion.div>
        ) : isJoined ? (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                haptic(10)
                const id = chatId ?? await getHangalongChatId(hang.id)
                if (id) { setChatId(id); onClose(); router.push(`/chat/${id}`) }
              }}
              disabled={loading}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-40"
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
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              Leave hangout
            </button>
          </>
        ) : (
          <motion.button
            key="join"
            whileTap={{ scale: 0.97 }}
            onClick={handleJoin}
            disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center transition-all disabled:opacity-50"
            style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
          >
            {loading ? 'Joining...' : 'Join Hangout'}
          </motion.button>
        )}
      </div>
      </motion.div>
    </div>

    {profileUserId && (
      <PublicProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    )}
  </>
  )
}
