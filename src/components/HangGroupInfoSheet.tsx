'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { leaveHangalongFromChat, getTripChatMuted, setTripChatMuted } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { PublicProfileModal } from './PublicProfileModal'
import type { HangalongWithDetails, ActivityType, WhenLabel } from '@/lib/types'

const ACTIVITY_CONFIG: Record<ActivityType, { emoji: string; label: string; bg: string }> = {
  hike:      { emoji: '🥾', label: 'Hike',      bg: 'linear-gradient(160deg, #0f2218 0%, #0a140d 100%)' },
  road_trip: { emoji: '🚗', label: 'Road Trip',  bg: 'linear-gradient(160deg, #2a1500 0%, #1a0d00 100%)' },
  beach:     { emoji: '🏖️', label: 'Beach',      bg: 'linear-gradient(160deg, #001f2e 0%, #000d14 100%)' },
  climbing:  { emoji: '🧗', label: 'Climbing',   bg: 'linear-gradient(160deg, #1a0a2e 0%, #0d0518 100%)' },
  urban:     { emoji: '🌆', label: 'Urban',      bg: 'linear-gradient(160deg, #111827 0%, #060810 100%)' },
  day_trip:  { emoji: '🚌', label: 'Day Trip',   bg: 'linear-gradient(160deg, #1f1800 0%, #100c00 100%)' },
  other:     { emoji: '✨', label: 'Hangout',    bg: 'linear-gradient(160deg, #111 0%, #080808 100%)' },
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
  const [muted, setMuted] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)

  const cfg = ACTIVITY_CONFIG[hangInfo.activity_type] ?? ACTIVITY_CONFIG.other
  const memberCount = hangInfo.member_count
  const spotsLeft = hangInfo.max_people - memberCount
  const hasDescription = !!hangInfo.description?.trim()
  const descLong = (hangInfo.description?.length ?? 0) > 120
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/hang/${hangInfo.id}` : ''
  const inviteText = `Join me for "${hangInfo.title}" on TripAlong! 🤙`

  useEffect(() => {
    getTripChatMuted(chatId).then(setMuted)
  }, [chatId])

  const allMembers = [...(hangInfo.members ?? [])].sort((a, b) => {
    if (a.user_id === userId) return -1
    if (b.user_id === userId) return 1
    if (a.user_id === hangInfo.creator_id) return -1
    if (b.user_id === hangInfo.creator_id) return 1
    return (a.user?.name ?? '').localeCompare(b.user?.name ?? '')
  })

  const handleToggleMute = async () => {
    const next = !muted
    haptic(8)
    setMuted(next)
    await setTripChatMuted(chatId, next)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${inviteText}\n${inviteUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  const handleNativeShare = async () => {
    haptic(8)
    try {
      if (navigator.share) {
        await navigator.share({ title: hangInfo.title, text: inviteText, url: inviteUrl })
      } else {
        await handleCopyLink()
      }
    } catch {
      await handleCopyLink()
    }
  }

  const handleWhatsApp = () => {
    haptic(8)
    const msg = encodeURIComponent(`${inviteText}\n${inviteUrl}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

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
                <img src={hangInfo.photo_url} alt={hangInfo.title} className="absolute inset-0 w-full h-full object-cover min-w-0 min-h-0" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 35%, rgba(0,0,0,0.88) 100%)' }} />
              </>
            ) : (
              <span style={{ fontSize: 100, opacity: 0.1, userSelect: 'none' }}>{cfg.emoji}</span>
            )}
            <div className="absolute bottom-0 left-0 px-5 pb-5 w-full">
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                <span className="text-xs font-semibold" style={{ color: '#F0EBE3', opacity: 0.7 }}>{cfg.label}</span>
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

          {/* Actions: Invite + Mute */}
          <div className="px-5 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            {/* Invite row */}
            <button
              type="button"
              onClick={() => { haptic(8); setShowInvite(true) }}
              className="w-full flex items-center gap-4 py-3 active:opacity-70 transition-opacity"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(240,235,227,0.1)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 6 12 2 8 6" stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="2" x2="12" y2="15" stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-semibold">Invite to Hangout</p>
                <p className="text-white/35 text-xs mt-0.5">Share a link to add someone</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Mute row */}
            <button
              type="button"
              onClick={handleToggleMute}
              className="w-full flex items-center gap-4 py-3 active:opacity-70 transition-opacity"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  {muted ? (
                    <>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L2 22" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
                    </>
                  ) : (
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  )}
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-semibold">Mute Notifications</p>
                <p className="text-white/35 text-xs mt-0.5">{muted ? 'Notifications are off' : 'Get notified for new messages'}</p>
              </div>
              {/* Toggle pill */}
              <div
                className="relative shrink-0 transition-colors duration-200"
                style={{
                  width: 44, height: 26,
                  borderRadius: 13,
                  backgroundColor: muted ? 'rgba(255,255,255,0.12)' : '#30D158',
                }}
              >
                <div
                  className="absolute top-1 transition-all duration-200"
                  style={{
                    width: 18, height: 18,
                    borderRadius: 9,
                    backgroundColor: '#fff',
                    left: muted ? 4 : 22,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </div>
            </button>
          </div>

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
                      <img src={u.profile_photo} alt="" className="w-full h-full object-cover min-w-0 min-h-0" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white text-sm font-semibold truncate">{isMe ? 'You' : u.name}</p>
                    {isCreator && (
                      <p className="text-xs mt-0.5" style={{ color: '#F0EBE3', opacity: 0.5 }}>Organizer</p>
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

      {/* Invite sub-sheet */}
      <AnimatePresence>
        {showInvite && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70]"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowInvite(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="fixed left-0 right-0 bottom-0 z-[71] rounded-t-3xl flex flex-col"
              style={{ backgroundColor: '#111', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div className="px-5 pt-3 pb-2">
                <p className="text-white font-bold text-lg mb-1">Invite to Hangout</p>
                <p className="text-white/40 text-sm">Share this link to add someone new</p>
              </div>

              {/* Link display */}
              <div className="mx-5 mt-3 mb-4 rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-white/50 text-sm flex-1 truncate">{inviteUrl}</p>
              </div>

              {/* Share button */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="mx-5 mb-3 h-13 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 active:opacity-80 transition-opacity"
                style={{ height: 52, backgroundColor: '#FFFFFF', color: '#000' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 6 12 2 8 6" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="2" x2="12" y2="15" stroke="black" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
                Share Link
              </button>

              {/* Copy link */}
              <button
                type="button"
                onClick={() => { haptic(6); handleCopyLink() }}
                className="mx-5 mb-3 h-13 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
                style={{ height: 48, backgroundColor: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', color: copied ? '#30D158' : 'rgba(255,255,255,0.7)' }}
              >
                {copied ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Copied!</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> Copy Link</>
                )}
              </button>

              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleWhatsApp}
                className="mx-5 h-13 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2.5 active:opacity-70 transition-opacity"
                style={{ height: 48, backgroundColor: 'rgba(37,211,102,0.1)', border: '0.5px solid rgba(37,211,102,0.25)', color: '#25D166' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D166"/>
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.655 1.435 5.16L2 22l4.955-1.414A9.954 9.954 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#25D166" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Send on WhatsApp
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {selectedMemberId && (
        <PublicProfileModal userId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />
      )}
    </>
  )
}
