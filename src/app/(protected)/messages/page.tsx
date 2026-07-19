'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import {
  getUserTripChats, getDMConversations, getMyViewerCount, getProfile,
  setTripChatPinned, setDMPinned, setTripChatMuted, setDMMuted,
  leaveTripFromChat, leaveHangalongFromChat, deleteDMConversation,
} from '@/lib/queries'
import { getPushState, registerPush } from '@/lib/push'
import { hasPlus } from '@/lib/trial'
import { initPresence, useOnlineUsers, formatLastSeen } from '@/lib/presence'
import { haptic } from '@/lib/haptics'
import { displayName } from '@/lib/displayName'
import { ProfileViewsSheet } from '@/components/ProfileViewsSheet'
import { ConversationActionSheet } from '@/components/ConversationActionSheet'
import { isNativeApp } from '@/lib/native-app'
import { resizedImage } from '@/lib/imageUrl'

function CheckTick({ seen }: { seen: boolean }) {
  const c = seen ? '#53bdeb' : 'rgba(255,255,255,0.55)'
  return (
    <svg width="19" height="12" viewBox="0 0 16 10" fill="none" style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M1 5.5L3.5 8L8 1.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L7.5 8L12 1.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function Bone({ className }: { className: string }) {
  return <div className={`bg-white/8 rounded-2xl animate-pulse ${className}`} />
}

function MessagesSkeleton() {
  return (
    <>
      <NavBar />
      <main className="md:pt-14 min-h-screen bg-black" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 82px)' }}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <Bone className="w-32 h-7" />
            <Bone className="w-9 h-9 rounded-full" />
          </div>
          {/* Tab bar */}
          <div className="flex gap-2 px-5 pb-4">
            <Bone className="w-28 h-9 rounded-full" />
            <Bone className="w-20 h-9 rounded-full" />
          </div>
          {/* Conversation rows */}
          <div className="px-5 flex flex-col gap-3 pt-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Bone className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Bone className={`h-3.5 ${i % 2 === 0 ? 'w-32' : 'w-24'}`} />
                  <Bone className={`h-3 ${i % 3 === 0 ? 'w-48' : 'w-36'}`} />
                </div>
                <Bone className="w-8 h-3 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
        fill={filled ? '#F0EBE3' : 'none'}
        stroke={filled ? '#F0EBE3' : 'rgba(255,255,255,0.4)'}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SelectCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center transition-colors"
      style={{
        width: 22,
        height: 22,
        backgroundColor: checked ? '#F0EBE3' : 'transparent',
        border: checked ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
      }}
    >
      {checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

function SelectionHeader({
  count, confirming, confirmLabel, onCancel, onMute, onConfirmRequest, onConfirm,
}: {
  count: number
  confirming: boolean
  confirmLabel: string
  onCancel: () => void
  onMute: () => void
  onConfirmRequest: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/6" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <button type="button" onClick={onCancel} className="text-white/60 text-sm font-medium active:opacity-60">
        Cancel
      </button>
      {confirming ? (
        <span className="text-white text-sm font-semibold">Sure? This can't be undone</span>
      ) : (
        <span className="text-white/80 text-sm font-semibold">{count} selected</span>
      )}
      {confirming ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={count === 0}
          className="text-sm font-semibold disabled:opacity-40"
          style={{ color: '#FF453A' }}
        >
          {confirmLabel}
        </button>
      ) : (
        <div className="flex items-center gap-4">
          <button type="button" onClick={onMute} disabled={count === 0} className="text-white/70 text-xs font-semibold disabled:opacity-30 active:opacity-60">
            Mute
          </button>
          <button type="button" onClick={onConfirmRequest} disabled={count === 0} className="text-sm font-semibold disabled:opacity-30 active:opacity-60" style={{ color: '#FF453A' }}>
            {confirmLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full font-bold text-black text-[10px]"
      style={{
        backgroundColor: '#F0EBE3',
        minWidth: count > 9 ? 20 : 18,
        height: 18,
        paddingLeft: count > 9 ? 5 : 0,
        paddingRight: count > 9 ? 5 : 0,
      }}
    >
      {count > 99 ? '99+' : count}
    </div>
  )
}

export default function MessagesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pushState, setPushState] = useState<'unsupported' | 'granted' | 'denied' | 'default' | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string | null>>({})
  const [showViews, setShowViews] = useState(false)
  const [isPlus, setIsPlus] = useState(false)
  const onlineUsers = useOnlineUsers()

  // Long-press → per-row action sheet (mirrors the message-bubble long-press
  // pattern in the chat page: a timer armed on pointerdown, cancelled on any
  // move/up, with holdFired gating the click that follows pointerup so the
  // row doesn't also navigate).
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)
  const [actionSheetChat, setActionSheetChat] = useState<any | null>(null)
  const [actionSheetDM, setActionSheetDM] = useState<any | null>(null)

  // Bulk select mode — scoped to one section at a time (can't mix leaving
  // group chats with deleting DMs in one bulk action).
  const [selectMode, setSelectMode] = useState<'chats' | 'dms' | null>(null)
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set())
  const [selectedDmIds, setSelectedDmIds] = useState<Set<string>>(new Set())
  const [bulkConfirming, setBulkConfirming] = useState(false)

  const exitSelectMode = () => {
    setSelectMode(null)
    setSelectedChatIds(new Set())
    setSelectedDmIds(new Set())
    setBulkConfirming(false)
  }

  const toggleChatSelected = (chatId: string) => {
    haptic(6)
    setSelectedChatIds(prev => {
      const next = new Set(prev)
      if (next.has(chatId)) next.delete(chatId); else next.add(chatId)
      return next
    })
  }

  const toggleDmSelected = (dmId: string) => {
    haptic(6)
    setSelectedDmIds(prev => {
      const next = new Set(prev)
      if (next.has(dmId)) next.delete(dmId); else next.add(dmId)
      return next
    })
  }

  const handleRowPointerDown = (kind: 'chat' | 'dm', item: any) => {
    if (selectMode) return
    holdFired.current = false
    holdTimer.current = setTimeout(() => {
      holdFired.current = true
      haptic(15)
      if (kind === 'chat') setActionSheetChat(item)
      else setActionSheetDM(item)
    }, 420)
  }

  const handleRowPointerCancel = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  useEffect(() => {
    setPushState(getPushState())
  }, [])

  const handleEnableNotifications = async () => {
    if (!userId) return
    setPushLoading(true)
    const ok = await registerPush(userId)
    setPushState(ok ? 'granted' : (Notification.permission as any))
    setPushLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUserId(session.user.id)
      setPageLoading(false)
      initPresence(session.user.id)
      getProfile(session.user.id).then(p => setIsPlus(hasPlus(p)))
    })
  }, [router])

  // Real COUNT(*), not capped at 50 like getProfileViewers, and polled so a
  // new view shows up without needing to reload the tab.
  const { data: viewerCount = 0 } = useQuery({
    queryKey: ['viewerCount', userId],
    queryFn: getMyViewerCount,
    enabled: !!userId,
    refetchInterval: 15_000,
  })

  const { data: tripChats = [], isLoading: chatsLoading, isError: chatsError, refetch: refetchChats } = useQuery({
    queryKey: ['tripChats', userId],
    queryFn: () => getUserTripChats(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 5000,
  })

  const { data: dms = [], isLoading: dmsLoading, isError: dmsError, refetch: refetchDms } = useQuery({
    queryKey: ['dms', userId],
    queryFn: () => getDMConversations(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 5000,
  })

  // Pin/unpin — optimistically re-sort the cached list (pinned first, each
  // group otherwise in its existing order) so the row jumps to the top
  // immediately instead of waiting on a refetch.
  const handleTogglePinChat = (chatId: string, currentlyPinned: boolean) => {
    haptic(8)
    queryClient.setQueryData<any[]>(['tripChats', userId], old => {
      if (!old) return old
      const next = old.map(item =>
        item.trip_chat?.id === chatId ? { ...item, is_pinned: !currentlyPinned } : item
      )
      return [...next].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
    })
    setTripChatPinned(chatId, !currentlyPinned).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['tripChats', userId] })
    })
  }

  const handleTogglePinDM = (dmId: string, currentlyPinned: boolean) => {
    haptic(8)
    queryClient.setQueryData<any[]>(['dms', userId], old => {
      if (!old) return old
      const next = old.map(item =>
        item.id === dmId ? { ...item, is_pinned: !currentlyPinned } : item
      )
      return [...next].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
    })
    setDMPinned(dmId, !currentlyPinned).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['dms', userId] })
    })
  }

  const handleToggleMuteChat = (chatId: string, currentlyMuted: boolean) => {
    haptic(8)
    queryClient.setQueryData<any[]>(['tripChats', userId], old =>
      (old ?? []).map(item => item.trip_chat?.id === chatId ? { ...item, is_muted: !currentlyMuted } : item)
    )
    setTripChatMuted(chatId, !currentlyMuted).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['tripChats', userId] })
    })
  }

  const handleToggleMuteDM = (dmId: string, currentlyMuted: boolean) => {
    haptic(8)
    queryClient.setQueryData<any[]>(['dms', userId], old =>
      (old ?? []).map(item => item.id === dmId ? { ...item, is_muted: !currentlyMuted } : item)
    )
    setDMMuted(dmId, !currentlyMuted).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['dms', userId] })
    })
  }

  // Leave one or more group chats. Optimistically drops them from the cached
  // list, then leaves each on the server — a trip chat vs. a hangalong chat
  // hits a different membership table, so branch per item.
  const handleLeaveChats = async (items: any[]) => {
    const ids = new Set(items.map(i => i.trip_chat?.id).filter(Boolean))
    queryClient.setQueryData<any[]>(['tripChats', userId], old => (old ?? []).filter(i => !ids.has(i.trip_chat?.id)))
    try {
      await Promise.all(items.map(item => {
        const chat = item.trip_chat
        return chat.trip ? leaveTripFromChat(chat.trip.id, chat.id) : leaveHangalongFromChat(chat.hangalong.id, chat.id)
      }))
    } catch (e) {
      console.error('Leave chat(s) failed', e)
      queryClient.invalidateQueries({ queryKey: ['tripChats', userId] })
    }
  }

  // Delete one or more DMs from the current user's own list only.
  const handleDeleteDMs = async (items: any[]) => {
    const ids = new Set(items.map(i => i.id))
    queryClient.setQueryData<any[]>(['dms', userId], old => (old ?? []).filter(i => !ids.has(i.id)))
    try {
      await Promise.all(items.map(item => deleteDMConversation(item.id)))
    } catch (e) {
      console.error('Delete DM(s) failed', e)
      queryClient.invalidateQueries({ queryKey: ['dms', userId] })
    }
  }

  const handleBulkConfirm = async () => {
    if (selectMode === 'chats') {
      const items = (tripChats as any[]).filter(i => selectedChatIds.has(i.trip_chat?.id))
      await handleLeaveChats(items)
    } else if (selectMode === 'dms') {
      const items = (dms as any[]).filter(i => selectedDmIds.has(i.id))
      await handleDeleteDMs(items)
    }
    exitSelectMode()
  }

  const handleBulkMute = async () => {
    haptic(8)
    if (selectMode === 'chats') {
      const items = (tripChats as any[]).filter(i => selectedChatIds.has(i.trip_chat?.id))
      queryClient.setQueryData<any[]>(['tripChats', userId], old =>
        (old ?? []).map(i => selectedChatIds.has(i.trip_chat?.id) ? { ...i, is_muted: true } : i)
      )
      await Promise.all(items.map(i => setTripChatMuted(i.trip_chat.id, true).catch(() => {})))
    } else if (selectMode === 'dms') {
      const items = (dms as any[]).filter(i => selectedDmIds.has(i.id))
      queryClient.setQueryData<any[]>(['dms', userId], old =>
        (old ?? []).map(i => selectedDmIds.has(i.id) ? { ...i, is_muted: true } : i)
      )
      await Promise.all(items.map(i => setDMMuted(i.id, true).catch(() => {})))
    }
    exitSelectMode()
  }

  // Fetch last_seen_at for all DM contacts
  useEffect(() => {
    if (!dms.length) return
    const ids = (dms as any[]).map(dm => dm.other_user?.id).filter(Boolean)
    if (!ids.length) return
    supabase.from('users').select('id, last_seen_at').in('id', ids).then(({ data }) => {
      if (!data) return
      const map: Record<string, string | null> = {}
      ;(data as any[]).forEach(u => { map[u.id] = u.last_seen_at ?? null })
      setLastSeenMap(map)
    })
  }, [dms])

  if (pageLoading || chatsLoading || dmsLoading) return <MessagesSkeleton />

  return (
    <>
      <NavBar />
      <AnimatePresence>
        {showViews && (
          <ProfileViewsSheet
            onClose={() => { setShowViews(false) }}
            isPlus={isPlus}
            userId={userId ?? undefined}
            onUnlocked={() => setIsPlus(true)}
            onWelcomeDone={(confirmedIsPlus) => setIsPlus(confirmedIsPlus)}
          />
        )}
      </AnimatePresence>
      <main className="md:pt-14 min-h-screen bg-black" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 82px)' }}>
        <div className="max-w-2xl mx-auto">
          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between px-5 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
            <h1 className="text-white font-extrabold text-2xl">Messages</h1>
            <button
              onClick={() => { haptic(8); setShowViews(true) }}
              className="relative w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
              </svg>
              {viewerCount > 0 && (
                <div
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center font-bold text-black px-1"
                  style={{ backgroundColor: '#F0EBE3', fontSize: 9 }}
                >
                  {viewerCount > 99 ? '99+' : viewerCount}
                </div>
              )}
            </button>
          </div>

          {/* Push notification banner */}
          {pushState === 'default' && (
            <div className="mx-5 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
              <span className="text-xl shrink-0">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">Enable Notifications</p>
                <p className="text-white/40 text-xs">Get notified when someone messages you</p>
              </div>
              <button
                type="button"
                onClick={() => { haptic(8); handleEnableNotifications() }}
                disabled={pushLoading}
                className="shrink-0 font-semibold text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                style={{ backgroundColor: '#F0EBE3', color: '#000' }}
              >
                {pushLoading ? 'Enabling…' : 'Enable'}
              </button>
            </div>
          )}
          {pushState === 'denied' && (
            <div className="mx-5 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xl shrink-0">🔕</span>
              <p className="text-white/35 text-xs">Notifications blocked — enable in browser settings</p>
            </div>
          )}

          {/* Trip Chats */}
          <section>
            {selectMode === 'chats' ? (
              <SelectionHeader
                count={selectedChatIds.size}
                confirming={bulkConfirming}
                confirmLabel="Leave"
                onCancel={() => { haptic(8); bulkConfirming ? setBulkConfirming(false) : exitSelectMode() }}
                onMute={handleBulkMute}
                onConfirmRequest={() => setBulkConfirming(true)}
                onConfirm={handleBulkConfirm}
              />
            ) : (
              <h2 className="px-5 py-3 text-white/40 text-xs font-semibold uppercase tracking-widest border-b border-white/6">
                Group Chats
              </h2>
            )}
            {chatsError ? (
              <div className="px-5 py-6 flex flex-col items-center gap-3">
                <p className="text-white/25 text-sm text-center">Couldn't load chats</p>
                <button onClick={() => refetchChats()} className="text-white/50 text-xs font-semibold px-4 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>Try again</button>
              </div>
            ) : tripChats.length === 0 ? (
              <div className="px-5 py-8 text-white/20 text-sm text-center">
                Join a trip or hangout to start chatting
              </div>
            ) : (
              tripChats.map((item: any) => {
                const chat = item.trip_chat
                if (!chat) return null
                const trip = chat.trip
                const hang = chat.hangalong
                if (!trip && !hang) return null

                const isHang = !!hang
                const activityEmoji: Record<string, string> = { hike: '🥾', road_trip: '🚗', beach: '🏖️', climbing: '🧗', urban: '🌆', day_trip: '🚌' }
                const hangEmoji = isHang ? (activityEmoji[hang.activity_type] ?? '🎯') : null

                const avatarPhoto = isHang ? hang.photo_url : trip?.cover_image
                const avatarFallback = isHang ? hangEmoji : '🌍'
                const chatName = isHang ? hang.title : `${trip?.destination}${trip?.country ? `, ${trip.country}` : ''}`
                const chatSub = isHang ? hang.location_name : null

                const hasUnread = item.unread_count > 0 && !item.is_muted
                const iMySentLast = item.last_message_sender_id === userId
                const isSelected = selectedChatIds.has(chat.id)
                return (
                  <div
                    key={chat.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={() => handleRowPointerDown('chat', item)}
                    onPointerUp={handleRowPointerCancel}
                    onPointerMove={handleRowPointerCancel}
                    onPointerCancel={handleRowPointerCancel}
                    onContextMenu={e => { e.preventDefault(); setActionSheetChat(item) }}
                    onClick={() => {
                      if (holdFired.current) { holdFired.current = false; return }
                      if (selectMode === 'chats') { toggleChatSelected(chat.id); return }
                      haptic(8); router.push(`/chat/${chat.id}`)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/chat/${chat.id}`) }}
                    className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 active:bg-white/4 active:scale-[0.98] transition-all border-b border-white/6 cursor-pointer select-none ${item.is_pinned ? 'bg-white/[0.03]' : ''}`}
                  >
                    {selectMode === 'chats' && <SelectCheckbox checked={isSelected} />}
                    <div className="w-12 h-12 rounded-2xl bg-white/8 overflow-hidden shrink-0">
                      {avatarPhoto ? (
                        <img src={resizedImage(avatarPhoto, 100)} alt="" className="w-full h-full object-cover ta-avatar" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">{avatarFallback}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-white/70 font-medium'}`}>
                        {chatName}
                      </p>
                      {chatSub && !item.last_message && (
                        <p className="text-white/25 text-xs truncate mt-0.5">{chatSub}</p>
                      )}
                      {(item.last_message || !chatSub) && (
                        <div className={`flex items-center gap-1 mt-0.5 ${hasUnread ? 'text-white/60' : 'text-white/30'}`}>
                          {iMySentLast && <CheckTick seen={item.others_read} />}
                          <p className="text-xs truncate">
                            {item.last_message?.startsWith('https://') ? '📷 Photo' : (item.last_message ?? 'Group chat')}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleTogglePinChat(chat.id, item.is_pinned) }}
                        className="p-1 -m-1 active:opacity-60 transition-opacity"
                        aria-label={item.is_pinned ? 'Unpin chat' : 'Pin chat'}
                      >
                        <PinIcon filled={!!item.is_pinned} />
                      </button>
                      {item.last_message_at && (
                        <span className={`text-xs ${hasUnread && !item.is_muted ? 'text-white/50' : 'text-white/20'}`}>
                          {timeAgo(item.last_message_at)}
                        </span>
                      )}
                      {item.is_muted ? (
                        <span className="text-white/25 text-xs">🔕</span>
                      ) : (
                        <UnreadBadge count={item.unread_count} />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </section>

          {/* DMs */}
          <section>
            {selectMode === 'dms' ? (
              <SelectionHeader
                count={selectedDmIds.size}
                confirming={bulkConfirming}
                confirmLabel="Delete"
                onCancel={() => { haptic(8); bulkConfirming ? setBulkConfirming(false) : exitSelectMode() }}
                onMute={handleBulkMute}
                onConfirmRequest={() => setBulkConfirming(true)}
                onConfirm={handleBulkConfirm}
              />
            ) : (
              <h2 className="px-5 py-3 text-white/40 text-xs font-semibold uppercase tracking-widest border-b border-white/6 mt-4">
                Direct Messages
              </h2>
            )}
            {dmsError ? (
              <div className="px-5 py-6 flex flex-col items-center gap-3">
                <p className="text-white/25 text-sm text-center">Couldn't load messages</p>
                <button onClick={() => refetchDms()} className="text-white/50 text-xs font-semibold px-4 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>Try again</button>
              </div>
            ) : dms.length === 0 ? (
              <div className="px-5 py-8 text-white/20 text-sm text-center">
                No direct messages yet
              </div>
            ) : (
              dms.map((dm: any) => {
                const other = dm.other_user
                const hasUnread = dm.unread_count > 0
                const isOnline = other?.id ? onlineUsers.has(other.id) : false
                const lastSeen = other?.id ? lastSeenMap[other.id] : null
                const presenceText = formatLastSeen(lastSeen, isOnline)
                const iMySentLast = dm.last_message_sender_id === userId
                const dmSeen = iMySentLast && !!dm.other_last_read_at && dm.other_last_read_at >= dm.last_message_at
                const isSelected = selectedDmIds.has(dm.id)
                return (
                  <div
                    key={dm.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={() => handleRowPointerDown('dm', dm)}
                    onPointerUp={handleRowPointerCancel}
                    onPointerMove={handleRowPointerCancel}
                    onPointerCancel={handleRowPointerCancel}
                    onContextMenu={e => { e.preventDefault(); setActionSheetDM(dm) }}
                    onClick={() => {
                      if (holdFired.current) { holdFired.current = false; return }
                      if (selectMode === 'dms') { toggleDmSelected(dm.id); return }
                      haptic(8); router.push(`/dm/${dm.id}`)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/dm/${dm.id}`) }}
                    className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 active:bg-white/4 active:scale-[0.98] transition-all border-b border-white/6 cursor-pointer select-none ${dm.is_pinned ? 'bg-white/[0.03]' : ''}`}
                  >
                    {selectMode === 'dms' && <SelectCheckbox checked={isSelected} />}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-white/8 overflow-hidden">
                        {other?.profile_photo ? (
                          <img src={resizedImage(other.profile_photo, 100)} alt="" className="w-full h-full object-cover ta-avatar" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white/50">
                            {displayName(other?.name)[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full" style={{ backgroundColor: '#30D158', border: '2.5px solid #000' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-white/70 font-medium'}`}>
                        {displayName(other?.name)}
                      </p>
                      {/* Last message + delivery status, matching group chat previews.
                          Presence used to take priority here and hid the message/
                          checkmark entirely for almost every contact (anyone with a
                          last_seen_at at all), which was the bug. */}
                      {dm.last_message ? (
                        <div className={`flex items-center gap-1 mt-0.5 ${hasUnread ? 'text-white/60' : 'text-white/30'}`}>
                          {iMySentLast && <CheckTick seen={dmSeen} />}
                          <p className="text-xs truncate">
                            {dm.last_message.startsWith('https://') ? '📷 Photo' : dm.last_message}
                          </p>
                        </div>
                      ) : presenceText ? (
                        <p className="text-xs mt-0.5 truncate" style={{ color: isOnline ? '#30D158' : 'rgba(255,255,255,0.28)' }}>
                          {presenceText}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleTogglePinDM(dm.id, dm.is_pinned) }}
                        className="p-1 -m-1 active:opacity-60 transition-opacity"
                        aria-label={dm.is_pinned ? 'Unpin chat' : 'Pin chat'}
                      >
                        <PinIcon filled={!!dm.is_pinned} />
                      </button>
                      {dm.last_message_at && (
                        <span className={`text-xs ${hasUnread ? 'text-white/50' : 'text-white/20'}`}>
                          {timeAgo(dm.last_message_at)}
                        </span>
                      )}
                      {dm.is_muted ? (
                        <span className="text-white/25 text-xs">🔕</span>
                      ) : (
                        <UnreadBadge count={dm.unread_count} />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </section>
        </div>
      </main>

      <AnimatePresence>
        {actionSheetChat && (() => {
          const chat = actionSheetChat.trip_chat
          const isHang = !!chat.hangalong
          const title = isHang ? chat.hangalong.title : `${chat.trip?.destination}${chat.trip?.country ? `, ${chat.trip.country}` : ''}`
          const avatarPhoto = isHang ? chat.hangalong.photo_url : chat.trip?.cover_image
          return (
            <ConversationActionSheet
              kind="group"
              title={title}
              subtitle={isHang ? chat.hangalong.location_name : null}
              avatar={avatarPhoto ? <img src={resizedImage(avatarPhoto, 100)} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">🌍</span>}
              isMuted={!!actionSheetChat.is_muted}
              onClose={() => setActionSheetChat(null)}
              onToggleMute={() => handleToggleMuteChat(chat.id, !!actionSheetChat.is_muted)}
              onSelect={() => {
                setSelectMode('chats')
                setSelectedChatIds(new Set([chat.id]))
                setActionSheetChat(null)
              }}
              onConfirm={() => { handleLeaveChats([actionSheetChat]); setActionSheetChat(null) }}
            />
          )
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {actionSheetDM && (
          <ConversationActionSheet
            kind="dm"
            title={displayName(actionSheetDM.other_user?.name)}
            avatar={actionSheetDM.other_user?.profile_photo
              ? <img src={resizedImage(actionSheetDM.other_user.profile_photo, 100)} alt="" className="w-full h-full object-cover" />
              : <span className="text-sm font-bold text-white/50">{displayName(actionSheetDM.other_user?.name)[0].toUpperCase()}</span>}
            isMuted={!!actionSheetDM.is_muted}
            onClose={() => setActionSheetDM(null)}
            onToggleMute={() => handleToggleMuteDM(actionSheetDM.id, !!actionSheetDM.is_muted)}
            onSelect={() => {
              setSelectMode('dms')
              setSelectedDmIds(new Set([actionSheetDM.id]))
              setActionSheetDM(null)
            }}
            onConfirm={() => { handleDeleteDMs([actionSheetDM]); setActionSheetDM(null) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
