'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { leaveTripFromChat, getTripChatMuted, setTripChatMuted, getChatImages } from '@/lib/queries'
import { useOnlineUsers } from '@/lib/presence'
import { haptic } from '@/lib/haptics'
import { PublicProfileModal } from './PublicProfileModal'
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
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

interface TripGroupInfoSheetProps {
  chatId: string
  tripInfo: TripWithDetails
  userId: string
  isFullMember?: boolean
  onJoinTrip?: () => void
  onClose: () => void
  onLeft: () => void
}

export function TripGroupInfoSheet({ chatId, tripInfo, userId, isFullMember = true, onJoinTrip, onClose, onLeft }: TripGroupInfoSheetProps) {
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [images, setImages] = useState<{ id: string; content: string }[]>([])
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const onlineUsers = useOnlineUsers()

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/trip/${tripInfo.id}` : ''

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch { /* ignore */ }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join our trip to ${tripInfo.destination}!`,
          text: `I'm planning a trip to ${tripInfo.destination}${tripInfo.country ? `, ${tripInfo.country}` : ''} on TripAlong. Join us! 🌍`,
          url: inviteUrl,
        })
      } catch { /* dismissed */ }
    } else {
      handleCopyLink()
    }
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Join our trip to ${tripInfo.destination}${tripInfo.country ? `, ${tripInfo.country}` : ''}! 🌍\n${inviteUrl}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
  }

  useEffect(() => {
    getTripChatMuted(chatId).then(setMuted)
    getChatImages(chatId).then(setImages)
  }, [chatId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingImage) setViewingImage(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, viewingImage])

  const handleToggleMute = async () => {
    const next = !muted
    haptic(8)
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

  // Sort: You first, creator second, then alphabetical
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
  const hasDescription = !!tripInfo.description?.trim()
  const descLong = (tripInfo.description?.length ?? 0) > 120
  const hasVibes = (tripInfo.vibes?.length ?? 0) > 0
  const memberCount = Math.max(members.length, tripInfo.member_count ?? 0)

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
              {tripInfo.destination}{tripInfo.country ? `, ${tripInfo.country}` : ''}{memberCount > 0 ? ` · ${memberCount} members` : ''}
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

          {/* ── About: description + vibes together ─────────────────────────── */}
          {(hasDescription || hasVibes) && (
            <div className="px-5 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-2">About</p>
              {hasDescription && (
                <>
                  <p
                    className="text-white/70 text-sm leading-relaxed"
                    style={!descExpanded ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    } as React.CSSProperties : undefined}
                  >
                    {tripInfo.description}
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
                </>
              )}
              {hasVibes && (
                <div className={`flex flex-wrap gap-2 ${hasDescription ? 'mt-3' : ''}`}>
                  {tripInfo.vibes.map(vibe => (
                    <div
                      key={vibe}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: 'rgba(240,235,227,0.07)',
                        border: '0.5px solid rgba(240,235,227,0.14)',
                        color: 'rgba(240,235,227,0.72)',
                      }}
                    >
                      <span>{VIBE_ICONS[vibe.toLowerCase()] ?? '🏷️'}</span>
                      <span style={{ textTransform: 'capitalize' }}>{vibe}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Info cards (labeled 2×2 grid) ────────────────────────────────── */}
          {(dateStr || tripInfo.pace || tripInfo.budget_level || tripInfo.max_group_size > 0) && (
            <div
              className="grid grid-cols-2 gap-2.5 px-5 py-4"
              style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
            >
              {dateStr && (
                <div className="rounded-2xl p-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-white/35 text-xs mb-1">Dates</p>
                  <p className="text-white/80 text-sm font-semibold">📅 {dateStr}</p>
                </div>
              )}
              {tripInfo.pace && (
                <div className="rounded-2xl p-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-white/35 text-xs mb-1">Pace</p>
                  <p className="text-white/80 text-sm font-semibold capitalize">
                    {tripInfo.pace === 'slow' ? '🐢' : tripInfo.pace === 'fast' ? '⚡️' : '⚖️'} {tripInfo.pace}
                  </p>
                </div>
              )}
              {tripInfo.budget_level && (
                <div className="rounded-2xl p-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-white/35 text-xs mb-1">Budget</p>
                  <p className="text-white/80 text-sm font-semibold capitalize">💰 {tripInfo.budget_level}</p>
                </div>
              )}
              {tripInfo.max_group_size > 0 && (
                <div className="rounded-2xl p-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-white/35 text-xs mb-1">Group size</p>
                  <p className="text-white/80 text-sm font-semibold">👥 Up to {tripInfo.max_group_size}</p>
                </div>
              )}
            </div>
          )}

          {/* Join Trip row — only for non-full members */}
          {!isFullMember && onJoinTrip && (
            <button
              type="button"
              onClick={() => { haptic(10); onJoinTrip() }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/4 active:bg-white/4 transition-colors"
              style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 18 }}>🎒</span>
                <div className="text-left">
                  <p className="text-white text-sm font-semibold">Join This Trip</p>
                  <p className="text-white/40 text-xs mt-0.5">Officially join and confirm your spot</p>
                </div>
              </div>
              <span
                className="shrink-0 font-bold text-xs rounded-xl px-3 py-1.5"
                style={{ backgroundColor: '#F0EBE3', color: '#000' }}
              >
                Join
              </span>
            </button>
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
                width: 44, height: 26, borderRadius: 13,
                backgroundColor: muted ? '#30D158' : 'rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}
            >
              <div
                className="absolute top-0.5 transition-transform"
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  backgroundColor: '#fff', left: 2,
                  transform: muted ? 'translateX(18px)' : 'translateX(0px)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </button>

          {/* ── Shared photos strip ──────────────────────────────────────────── */}
          {images.length > 0 && (
            <div className="py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div className="px-5 mb-3 flex items-center justify-between">
                <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">Photos</p>
                <p className="text-white/25 text-xs">
                  {images.length >= 30 ? '30+' : images.length} {images.length === 1 ? 'photo' : 'photos'}
                </p>
              </div>
              <div
                className="flex gap-2 overflow-x-auto px-5"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                {images.map(img => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setViewingImage(img.content)}
                    className="shrink-0 rounded-2xl overflow-hidden active:opacity-75 transition-opacity"
                    style={{ width: 120, height: 160 }}
                  >
                    <img
                      src={img.content}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Members header */}
          <div className="px-5 pt-5 pb-1">
            <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">
              Members · {memberCount}
            </p>
          </div>

          {/* Invite row */}
          <div className="px-4">
            <button
              type="button"
              onClick={() => { haptic(8); setShowInvite(true) }}
              className="w-full flex items-center gap-4 py-3.5 active:opacity-75 transition-opacity"
              style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.14)' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="rgba(240,235,227,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="rgba(240,235,227,0.8)" strokeWidth="1.8"/>
                  <path d="M19 8v6M22 11h-6" stroke="rgba(240,235,227,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-white/85 text-sm font-semibold">Invite to trip</p>
                <p className="text-white/35 text-xs">Share a link to add someone new</p>
              </div>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Members list */}
          <div className="px-4 pb-4">
            {members.map((member: any) => {
              const u = member.user
              if (!u) return null
              const isCreator = u.id === tripInfo.creator_id
              const isMe = u.id === userId
              const isOnline = onlineUsers.has(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { if (!isMe) { haptic(8); setSelectedMemberId(u.id) } }}
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
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ backgroundColor: '#30D158', border: '2px solid #000' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white text-sm font-semibold truncate">{isMe ? 'You' : u.name}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5">
                      {isCreator && (
                        <span style={{ color: '#F0EBE3', opacity: 0.5 }}>Creator</span>
                      )}
                      {isCreator && isOnline && (
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                      )}
                      {isOnline && (
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
                    {leaving ? 'Leaving...' : 'Leave Trip'}
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
                Leave Trip
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Invite sheet */}
      <AnimatePresence>
        {showInvite && (
          <>
            <motion.div
              className="fixed inset-0 z-[70]"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowInvite(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[71] rounded-t-3xl overflow-hidden"
              style={{ backgroundColor: '#111', paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
              </div>

              {/* Header */}
              <div className="px-5 pt-3 pb-5" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white font-bold" style={{ fontSize: 20 }}>Invite to Trip</p>
                <p className="text-white/40 text-sm mt-0.5">
                  {tripInfo.destination}{tripInfo.country ? `, ${tripInfo.country}` : ''}
                </p>
              </div>

              {/* Link row */}
              <div className="px-5 pt-4 pb-1">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2.5">Trip link</p>
                <div
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
                  style={{ backgroundColor: '#0A0A0A', border: '0.5px solid rgba(255,255,255,0.09)' }}
                >
                  <p className="flex-1 text-white/40 text-sm truncate">{inviteUrl}</p>
                  <button
                    type="button"
                    onClick={() => { haptic(8); handleCopyLink() }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all active:scale-95"
                    style={{
                      backgroundColor: copied ? 'rgba(48,209,88,0.13)' : 'rgba(240,235,227,0.09)',
                      color: copied ? '#30D158' : 'rgba(240,235,227,0.75)',
                      border: `0.5px solid ${copied ? 'rgba(48,209,88,0.28)' : 'rgba(240,235,227,0.12)'}`,
                    }}
                  >
                    {copied ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Share buttons */}
              <div className="px-5 pt-4 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => { haptic(10); handleNativeShare() }}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] active:opacity-75"
                  style={{ backgroundColor: '#F0EBE3', color: '#000', padding: '15px 0' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Share link
                </button>
                <button
                  type="button"
                  onClick={() => { haptic(10); handleWhatsApp() }}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] active:opacity-75"
                  style={{
                    padding: '15px 0',
                    backgroundColor: 'rgba(37,211,102,0.1)',
                    color: '#25D366',
                    border: '0.5px solid rgba(37,211,102,0.22)',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                  Share on WhatsApp
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Member profile modal */}
      {selectedMemberId && (
        <PublicProfileModal userId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />
      )}

      {/* Full-screen image viewer */}
      {viewingImage && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.96)' }}
          onClick={() => setViewingImage(null)}
        >
          <img
            src={viewingImage}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: '100vw', maxHeight: '100dvh', padding: 16 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
