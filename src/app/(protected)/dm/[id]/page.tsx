'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { MessageActionSheet } from '@/components/MessageActionSheet'
import { MessageInfoSheet, type MessageReceipt } from '@/components/MessageInfoSheet'
import { ReportMessageSheet } from '@/components/ReportMessageSheet'
import { PublicProfileModal } from '@/components/PublicProfileModal'
import { BlockReportSheet } from '@/components/BlockReportSheet'
import { supabase } from '@/lib/supabase'
import { sendDMPushNotification } from '@/lib/push'
import { remindNotifications } from '@/lib/notifReminder'
import {
  getDMMessages,
  getOlderDMMessages,
  sendDMMessage,
  deleteDMMessage,
  uploadDMMedia,
  getDMConversations,
  markDMRead,
  toggleReaction,
  searchDMMessages,
  getDMOtherLastRead,
  isUserBlocked,
  unblockUser,
  getDMMuted,
  setDMMuted,
} from '@/lib/queries'
import { initPresence, useOnlineUsers, formatLastSeen } from '@/lib/presence'
import { displayName } from '@/lib/displayName'
import { haptic } from '@/lib/haptics'
import { useSwipeBack } from '@/lib/useSwipeBack'
import type { DMMessage, TripMessage } from '@/lib/types'
import { isNativeApp } from '@/lib/native-app'
import { resizedAvatar } from '@/lib/imageUrl'
import { mediaPreviewLabel } from '@/lib/messagePreview'
import { ImageViewer } from '@/components/ImageViewer'

// ── Helpers ────────────────────────────────────────────────────────────────
function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ backgroundColor: 'rgba(240,235,227,0.3)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
          : part
      )}
    </>
  )
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function CheckTick({ seen }: { seen: boolean }) {
  const c = seen ? '#53bdeb' : 'rgba(255,255,255,0.55)'
  return (
    <svg width="19" height="12" viewBox="0 0 16 10" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 5.5L3.5 8L8 1.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L7.5 8L12 1.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function groupReactions(reactions: DMMessage['reactions']) {
  const map: Record<string, string[]> = {}
  for (const r of reactions ?? []) {
    if (!map[r.emoji]) map[r.emoji] = []
    map[r.emoji].push(r.user_id)
  }
  return Object.entries(map).map(([emoji, users]) => ({ emoji, count: users.length, users }))
}

// ── Chat skeleton ──────────────────────────────────────────────────────────
const SKELETON_ROWS: { isMe: boolean; w: string }[] = [
  { isMe: false, w: '52%' }, { isMe: false, w: '35%' },
  { isMe: true, w: '45%' },  { isMe: true, w: '60%' },
  { isMe: false, w: '68%' }, { isMe: false, w: '40%' },
  { isMe: true, w: '32%' },  { isMe: false, w: '55%' },
]

function ChatSkeleton() {
  return (
    <div className="flex-1 overflow-hidden py-4 px-4 flex flex-col gap-3">
      {SKELETON_ROWS.map((r, i) => (
        <div key={i} className={`flex items-end gap-2 ${r.isMe ? 'flex-row-reverse' : ''}`}>
          {!r.isMe && <div className="w-7 h-7 rounded-full animate-pulse shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />}
          <div
            className="h-9 rounded-2xl animate-pulse"
            style={{ width: r.w, backgroundColor: r.isMe ? 'rgba(224,222,218,0.10)' : 'rgba(255,255,255,0.06)' }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DMPage() {
  const { id: conversationId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; profile_photo: string | null; last_seen_at?: string | null } | null>(null)

  // Messages + pagination
  const [olderMessages, setOlderMessages] = useState<DMMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Input + reply
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<DMMessage | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const composerFormRef = useRef<HTMLFormElement>(null)

  // Auto-grow the composer as the message wraps to more lines, capped so it
  // doesn't swallow the whole screen on a very long message.
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Typing
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Action sheet
  const [actionMsg, setActionMsg] = useState<DMMessage | null>(null)
  const [infoMsg, setInfoMsg] = useState<DMMessage | null>(null)
  const [reportMsg, setReportMsg] = useState<DMMessage | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)

  // Image
  const [uploadingImage, setUploadingImage] = useState(false)
  // Single combined "sending N photos" placeholder shown while a multi-photo
  // batch uploads, instead of one bubble per photo popping in individually.
  const [uploadingBatch, setUploadingBatch] = useState<{ count: number; preview: string } | null>(null)
  const [viewingImage, setViewingImage] = useState<{ images: string[]; index: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Read receipts
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null)

  // Profile sheet
  const [showUserInfo, setShowUserInfo] = useState(false)

  // Block / report
  const [showBlockReport, setShowBlockReport] = useState(false)
  const [isBlockedByMe, setIsBlockedByMe] = useState(false)

  // Mute (silences this DM's push notifications)
  const [muted, setMuted] = useState(false)
  useEffect(() => { getDMMuted(conversationId).then(setMuted).catch(() => {}) }, [conversationId])
  const toggleMute = async () => {
    const next = !muted
    haptic(8)
    setMuted(next)
    try { await setDMMuted(conversationId, next) } catch { setMuted(!next) }
  }

  // Safety notice (dismissed per conversation in localStorage)
  const safetyKey = `dm_safety_dismissed_${conversationId}`
  const [safetyDismissed, setSafetyDismissed] = useState(true) // start hidden, set in effect

  // Scroll
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const userIdRef = useRef<string | null>(null)
  const keyboardOpenRef = useRef(false)

  const onlineUsers = useOnlineUsers()

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      userIdRef.current = uid
      if (uid) {
        initPresence(uid)
        supabase.from('users').select('name').eq('id', uid).single()
          .then(({ data: u }) => { if (u) setUserName((u as any).name ?? '') })
        getDMConversations(uid).then(convs => {
          const conv = convs.find((c: any) => c.id === conversationId)
          if (conv?.other_user) {
            const ou = conv.other_user
            setOtherUser({ id: ou.id, name: ou.name, profile_photo: ou.profile_photo })
            supabase.from('users').select('last_seen_at').eq('id', ou.id).single()
              .then(({ data: u }) => {
                if (u) setOtherUser(prev => prev ? { ...prev, last_seen_at: (u as any).last_seen_at } : null)
              })
          }
        })
        markDMRead(conversationId)
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
        queryClient.invalidateQueries({ queryKey: ['dms'] })
        getDMOtherLastRead(conversationId, uid).then(setOtherLastRead)
      }
    })
    // Safety banner — show once per conversation
    if (typeof localStorage !== 'undefined') {
      setSafetyDismissed(!!localStorage.getItem(safetyKey))
    }
  }, [conversationId, queryClient, safetyKey])

  // Check block status when otherUser loads
  useEffect(() => {
    if (otherUser?.id) {
      isUserBlocked(otherUser.id).then(setIsBlockedByMe)
    }
  }, [otherUser?.id])

  // ── Keyboard detection (prevents smooth scroll fighting OS keyboard animation) ──
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => { keyboardOpenRef.current = vv.height < window.innerHeight - 80 }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── Messages query ────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dmMessages', conversationId],
    queryFn: async () => {
      const msgs = await getDMMessages(conversationId)
      setHasMore(msgs.length === 50)
      return msgs
    },
    enabled: !!conversationId,
    staleTime: 30_000,
    refetchInterval: 3000,
  })

  // ── Search query ──────────────────────────────────────────────────────────
  const { data: searchResults = [], isFetching: searchFetching } = useQuery({
    queryKey: ['dmSearch', conversationId, debouncedQuery],
    queryFn: () => searchDMMessages(conversationId, debouncedQuery),
    enabled: searchOpen && debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  // Same fix as the group chat page: the first scroll on opening a
  // conversation must be instant (plus a delayed re-snap to catch images
  // loading late), or a long history can animate-scroll to a position short
  // of the true bottom. Later updates keep the keyboard-aware smooth/instant
  // behavior.
  const initialScrollDoneRef = useRef(false)
  useEffect(() => { initialScrollDoneRef.current = false }, [conversationId])
  useEffect(() => {
    if (searchOpen || messages.length === 0) return
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true
      bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
      const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior }), 300)
      return () => clearTimeout(t)
    }
    bottomRef.current?.scrollIntoView({
      behavior: keyboardOpenRef.current ? 'instant' : 'smooth',
    } as ScrollIntoViewOptions)
  }, [messages, searchOpen])

  // ── Realtime channel ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
        if (userIdRef.current) {
          markDMRead(conversationId)
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
          queryClient.invalidateQueries({ queryKey: ['dms'] })
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_members',
        filter: `conversation_id=eq.${conversationId}`,
      }, ({ new: row }: any) => {
        if (row.user_id !== userIdRef.current) {
          setOtherLastRead(row.last_read_at)
        }
      })
      .on('broadcast', { event: 'typing' }, () => {
        setOtherTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setOtherTyping(false), 3000)
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [conversationId, queryClient])

  // ── Typing broadcast ──────────────────────────────────────────────────────
  const broadcastTyping = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: {} })
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (typingDebounce.current) clearTimeout(typingDebounce.current)
    typingDebounce.current = setTimeout(broadcastTyping, 300)
  }

  // Enter sends, Shift+Enter inserts a newline — matches iMessage behavior.
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      composerFormRef.current?.requestSubmit()
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !userId || sending) return
    setSending(true)
    const content = input.trim()
    const replyId = replyTo?.id ?? null
    const currentReplyTo = replyTo

    const optimistic: DMMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: userId,
      content,
      type: 'text',
      reply_to_id: replyId,
      created_at: new Date().toISOString(),
      sender: { id: userId, name: userName, profile_photo: null },
      reply_to: currentReplyTo ? { id: currentReplyTo.id, content: currentReplyTo.content, sender: currentReplyTo.sender } : null,
      reactions: [],
    }
    setInput('')
    setReplyTo(null)
    queryClient.setQueryData<DMMessage[]>(['dmMessages', conversationId], old => [...(old ?? []), optimistic])

    try {
      await sendDMMessage(conversationId, userId, content, replyId)
      queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
      // Sending a message means you've seen the thread — advance last_read_at
      // and clear the unread badge / Messages-tab dot immediately.
      markDMRead(conversationId)
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      queryClient.invalidateQueries({ queryKey: ['dms'] })
      sendDMPushNotification({ conversationId, senderId: userId, senderName: userName, content, type: 'text', url: `/dm/${conversationId}` })
      remindNotifications('message')
    } catch {
      queryClient.setQueryData<DMMessage[]>(['dmMessages', conversationId], old =>
        (old ?? []).filter(m => m.id !== optimistic.id)
      )
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────────
  // Multiple photos upload in parallel behind a single "sending N photos"
  // placeholder, then reveal together — instead of one bubble per photo
  // popping in individually as each upload finishes in turn, which read as
  // slow/janky next to WhatsApp/Instagram's combined send-in-progress tile.
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length === 0 || !userId) return
    e.target.value = ''

    const files = picked.filter(file => {
      const isVideo = file.type.startsWith('video/')
      const limit = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > limit) {
        alert(`"${file.name}" is over ${isVideo ? '50 MB' : '10 MB'} and was skipped`)
        return false
      }
      return true
    })
    if (files.length === 0) return

    // Videos can't render as an <img> preview blob — fall back to a generic
    // icon placeholder for the batch preview when the first file is a video.
    const firstIsVideo = files[0].type.startsWith('video/')
    const preview = firstIsVideo ? '' : URL.createObjectURL(files[0])
    setUploadingBatch({ count: files.length, preview })
    setUploadingImage(true)

    try {
      // Upload is the slow, bandwidth-bound part — run it in parallel so a
      // batch takes as long as the slowest single upload, not the sum of all.
      const uploaded = await Promise.allSettled(files.map(file => uploadDMMedia(conversationId, file)))

      // Sending is a lightweight DB insert — do it in order so the messages
      // land in the sequence the user picked them.
      let sentCount = 0
      for (let i = 0; i < uploaded.length; i++) {
        const result = uploaded[i]
        if (result.status !== 'fulfilled') continue
        const mediaType = files[i].type.startsWith('video/') ? 'video' : 'image'
        try {
          await sendDMMessage(conversationId, userId, result.value, null, mediaType)
          sentCount++
          sendDMPushNotification({ conversationId, senderId: userId, senderName: userName, content: result.value, type: mediaType, url: `/dm/${conversationId}` })
        } catch (err) {
          console.error('Failed to send message', err)
        }
      }

      const failedCount = uploaded.length - sentCount
      if (failedCount > 0) alert(`${failedCount} item${failedCount > 1 ? 's' : ''} failed to send`)

      if (sentCount > 0) {
        haptic(10)
        await queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
        // Sending a photo also counts as seeing the thread — clear unread state.
        markDMRead(conversationId)
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
        queryClient.invalidateQueries({ queryKey: ['dms'] })
        remindNotifications('message')
      }
    } finally {
      URL.revokeObjectURL(preview)
      setUploadingBatch(null)
      setUploadingImage(false)
    }
  }

  // ── Load more ─────────────────────────────────────────────────────────────
  const handleLoadMore = async () => {
    const allMsgs = [...olderMessages, ...messages]
    if (!allMsgs.length || loadingMore) return
    setLoadingMore(true)
    const oldest = allMsgs[0].created_at
    try {
      const older = await getOlderDMMessages(conversationId, oldest, 30)
      setOlderMessages(prev => [...older, ...prev])
      if (older.length < 30) setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Long press ────────────────────────────────────────────────────────────
  const handlePointerDown = (msg: DMMessage) => {
    holdFired.current = false
    holdTimer.current = setTimeout(() => {
      holdFired.current = true
      setActionMsg(msg)
    }, 450)
  }
  const handlePointerUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
  }

  // ── Search helpers ────────────────────────────────────────────────────────
  const handleOpenSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }
  const handleCloseSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isOtherOnline = otherUser ? onlineUsers.has(otherUser.id) : false
  const presenceText = otherUser ? formatLastSeen(otherUser.last_seen_at, isOtherOnline) : ''
  const allMessages = [...olderMessages, ...messages]
  const displayMessages = searchOpen && debouncedQuery.length >= 2 ? searchResults : allMessages
  // Reply-quote fallback: reply_to embed returns empty on refetch — resolve the
  // quoted message from the already-loaded list by reply_to_id.
  const messagesById = new Map(allMessages.map(m => [m.id, m]))

  // Last message I sent — for read receipt
  const myMessages = allMessages.filter(m => m.sender_id === userId)
  const lastMyMsg = myMessages[myMessages.length - 1]
  const lastMyMsgIsRead = !!(lastMyMsg && otherLastRead && otherLastRead >= lastMyMsg.created_at)

  // Only one other person in a DM, so the "Info" sheet just reports their
  // single read state relative to the selected message.
  const infoReceipts: MessageReceipt[] = infoMsg && otherUser
    ? [{
        id: otherUser.id,
        name: otherUser.name,
        photo: otherUser.profile_photo,
        seenAt: otherLastRead && otherLastRead >= infoMsg.created_at ? otherLastRead : null,
      }]
    : []

  // ── Swipe-back ────────────────────────────────────────────────────────────
  // Disabled while any sheet/overlay is on top so the gesture doesn't
  // navigate the whole screen away underneath it.
  useSwipeBack(
    () => router.back(),
    !searchOpen && !actionMsg && !infoMsg && !reportMsg && !showUserInfo && !showBlockReport && !viewingImage
  )

  return (
    <>
      <NavBar />
      <motion.main
        className="md:pt-14 bg-black flex flex-col overflow-hidden"
        style={{ height: '100dvh' }}
        initial={{ x: 32, opacity: 0.88 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0 px-4">

          {/* Header */}
          <div
            className="pb-3 border-b border-white/8 flex items-center gap-3 shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 11px)' }}
          >
            <button
              onClick={() => router.back()}
              className="text-white/40 hover:text-white transition-colors shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {searchOpen ? (
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages…"
                className="flex-1 bg-white/8 border border-white/12 rounded-2xl px-4 py-2 text-white placeholder-white/30 outline-none focus:border-white/25"
                style={{ fontSize: 16 }}
              />
            ) : otherUser ? (
              <button
                type="button"
                onClick={() => setShowUserInfo(true)}
                className="flex flex-1 items-center gap-3 min-w-0 text-left active:opacity-70 transition-opacity"
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden">
                    {otherUser.profile_photo
                      ? <img src={resizedAvatar(otherUser.profile_photo, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50">{otherUser.name?.[0]?.toUpperCase()}</div>
                    }
                  </div>
                  {isOtherOnline && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#30D158', border: '2px solid #000' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{otherUser.name}</p>
                  <p className="text-xs truncate" style={{ color: otherTyping ? '#30D158' : isOtherOnline ? '#30D158' : 'rgba(255,255,255,0.35)' }}>
                    {otherTyping ? 'typing…' : presenceText || ''}
                  </p>
                </div>
              </button>
            ) : (
              <div className="flex-1 h-8 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )}

            {/* Search / close + more button */}
            {searchOpen ? (
              searchQuery ? (
                <button type="button" onClick={() => setSearchQuery('')} className="shrink-0 text-white/40 hover:text-white transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              ) : (
                <button type="button" onClick={handleCloseSearch} className="shrink-0 text-white/40 hover:text-white text-sm font-medium transition-colors">
                  Cancel
                </button>
              )
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {/* Mute toggle — bell (on) / bell-off (muted) */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="transition-colors p-1"
                  style={{ color: muted ? '#F0BE7A' : 'rgba(255,255,255,0.4)' }}
                  aria-label={muted ? 'Unmute conversation' : 'Mute conversation'}
                >
                  {muted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 8a6 6 0 0 0-9.33-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M2 2l20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
                <button type="button" onClick={handleOpenSearch} className="text-white/40 hover:text-white transition-colors p-1">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                {otherUser && (
                  <button type="button" onClick={() => setShowBlockReport(true)} className="text-white/40 hover:text-white transition-colors p-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                      <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 flex flex-col gap-1.5" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

            {/* Safety notice — shown once per conversation until dismissed */}
            {!searchOpen && !safetyDismissed && otherUser && (
              <div
                className="mx-1 mb-2 rounded-2xl px-4 py-3 flex items-start gap-3 shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              >
                <span className="text-base shrink-0 mt-0.5">🔒</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-xs mb-0.5">Stay safe on TripAlong</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Only share personal info you're comfortable with. Never send money to someone you haven't met in person.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowBlockReport(true)}
                    className="text-xs mt-1.5 font-medium"
                    style={{ color: 'rgba(240,235,227,0.5)' }}
                  >
                    Block or report {otherUser.name} →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof localStorage !== 'undefined') localStorage.setItem(safetyKey, '1')
                    setSafetyDismissed(true)
                  }}
                  className="shrink-0 text-white/20 hover:text-white/50 transition-colors mt-0.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Search count */}
            {searchOpen && (
              <div className="text-center text-white/30 text-xs py-1 shrink-0">
                {searchFetching ? 'Searching…' : debouncedQuery.length >= 2 ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}` : 'Type to search'}
              </div>
            )}

            {/* Load more */}
            {!searchOpen && hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="mx-auto text-white/30 text-xs py-2 px-4 rounded-full hover:text-white/50 transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                {loadingMore ? 'Loading…' : 'Load older messages'}
              </button>
            )}

            {(isLoading || !userId) && <ChatSkeleton />}

            {!isLoading && !!userId && displayMessages.map((msg: DMMessage, idx: number) => {
              const isMe = msg.sender_id === userId
              const reacted = groupReactions(msg.reactions)
              const myReactionEmojis = (msg.reactions ?? []).filter(r => r.user_id === userId).map(r => r.emoji)
              const isLastMyMsg = msg.id === lastMyMsg?.id

              if (msg.type === 'image') {
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs shrink-0">
                        {msg.sender?.profile_photo
                          // Plain center-crop, matching the Group Info member rows — .ta-avatar's
                          // top-biased crop is too tight on the face at this tiny 28px size.
                          ? <img src={resizedAvatar(msg.sender.profile_photo, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0" />
                          : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      <button
                        type="button"
                        onPointerDown={() => handlePointerDown(msg)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={() => {
                          if (holdFired.current) return
                          const imgs = displayMessages.filter((m: DMMessage) => m.type === 'image').map((m: DMMessage) => m.content)
                          setViewingImage({ images: imgs, index: Math.max(0, imgs.indexOf(msg.content)) })
                        }}
                        className="rounded-2xl overflow-hidden active:opacity-80 transition-opacity block"
                        style={{ maxWidth: 220 }}
                      >
                        <img src={msg.content} alt="" className="w-full h-auto block" style={{ maxHeight: 280, objectFit: 'contain' }} />
                      </button>
                      {reacted.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5 px-1">
                          {reacted.map(({ emoji, count, users }) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => userId && toggleReaction(msg.id, emoji).then(() => queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] }))}
                              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
                              style={{
                                backgroundColor: users.includes(userId ?? '') ? 'rgba(240,235,227,0.18)' : 'rgba(255,255,255,0.07)',
                                border: `0.5px solid ${users.includes(userId ?? '') ? 'rgba(240,235,227,0.35)' : 'rgba(255,255,255,0.1)'}`,
                              }}
                            >
                              {emoji} {count > 1 && <span className="text-white/60">{count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-white/45 text-xs">{formatTime(msg.created_at)}</span>
                        {isMe && <CheckTick seen={!!otherLastRead && otherLastRead >= msg.created_at} />}
                      </div>
                    </div>
                  </div>
                )
              }

              if (msg.type === 'video') {
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs shrink-0">
                        {msg.sender?.profile_photo
                          ? <img src={resizedAvatar(msg.sender.profile_photo, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0" />
                          : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      <video
                        src={msg.content}
                        controls
                        playsInline
                        preload="metadata"
                        className={`overflow-hidden rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={{ maxWidth: 220, maxHeight: 280, display: 'block', backgroundColor: '#000' }}
                      />
                      {reacted.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5 px-1">
                          {reacted.map(({ emoji, count, users }) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => userId && toggleReaction(msg.id, emoji).then(() => queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] }))}
                              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
                              style={{
                                backgroundColor: users.includes(userId ?? '') ? 'rgba(240,235,227,0.18)' : 'rgba(255,255,255,0.07)',
                                border: `0.5px solid ${users.includes(userId ?? '') ? 'rgba(240,235,227,0.35)' : 'rgba(255,255,255,0.1)'}`,
                              }}
                            >
                              {emoji} {count > 1 && <span className="text-white/60">{count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-white/45 text-xs">{formatTime(msg.created_at)}</span>
                        {isMe && <CheckTick seen={!!otherLastRead && otherLastRead >= msg.created_at} />}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs">
                        {msg.sender?.profile_photo
                          // Plain center-crop, matching the Group Info member rows — .ta-avatar's
                          // top-biased crop is too tight on the face at this tiny 28px size.
                          ? <img src={resizedAvatar(msg.sender.profile_photo, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0" />
                          : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      {isOtherOnline && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: '#30D158', border: '1.5px solid #000' }} />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[70%] min-w-0 flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Reply quote */}
                    {(() => {
                      const src = msg.reply_to?.content ? msg.reply_to : (msg.reply_to_id ? messagesById.get(msg.reply_to_id) : null)
                      const rc = src?.content
                      if (!rc) return null
                      const rn = displayName((src as any)?.sender?.name)
                      return (
                        <div
                          className={`px-3 py-1.5 rounded-xl text-xs mb-0.5 max-w-full ${isMe ? 'text-right' : 'text-left'}`}
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderLeft: isMe ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRight: isMe ? '2px solid rgba(255,255,255,0.2)' : 'none' }}
                        >
                          {rn && <p className="text-white/50 font-semibold truncate">{rn}</p>}
                          <p className="text-white/35 truncate">{mediaPreviewLabel(rc) ?? rc}</p>
                        </div>
                      )
                    })()}
                    <button
                      type="button"
                      onPointerDown={() => handlePointerDown(msg)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={() => { /* tap does nothing for text */ }}
                      className={`px-4 py-2.5 rounded-2xl text-sm text-left max-w-full transition-opacity active:opacity-75 ${isMe ? 'bg-[#E0DEDA] text-black rounded-br-sm' : 'bg-[#141414] text-white rounded-bl-sm'}`}
                      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                    >
                      {searchOpen && debouncedQuery.length >= 2 ? highlightText(msg.content, debouncedQuery) : msg.content}
                    </button>
                    {/* Reactions */}
                    {reacted.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5 px-1">
                        {reacted.map(({ emoji, count, users }) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => userId && toggleReaction(msg.id, emoji).then(() => queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] }))}
                            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: users.includes(userId ?? '') ? 'rgba(240,235,227,0.18)' : 'rgba(255,255,255,0.07)',
                              border: `0.5px solid ${users.includes(userId ?? '') ? 'rgba(240,235,227,0.35)' : 'rgba(255,255,255,0.1)'}`,
                            }}
                          >
                            {emoji} {count > 1 && <span className="text-white/60">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-white/45 text-xs">{formatTime(msg.created_at)}</span>
                      {isMe && <CheckTick seen={!!otherLastRead && otherLastRead >= msg.created_at} />}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Sending-multiple-photos placeholder — one combined tile
                instead of a bubble per photo, matching WhatsApp/Instagram's
                single in-flight indicator. Swaps out for the real bubbles,
                all at once, as soon as the whole batch lands. */}
            <AnimatePresence>
              {uploadingBatch && (
                <motion.div
                  key="upload-batch"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-end justify-end"
                >
                  <div className="relative overflow-hidden rounded-2xl rounded-br-sm shrink-0" style={{ width: 120, height: 120, backgroundColor: '#1a1a1a' }}>
                    {uploadingBatch.preview ? (
                      <img src={uploadingBatch.preview} alt="" className="w-full h-full object-cover" style={{ opacity: 0.45 }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.45 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M23 7l-7 5 7 5V7z" fill="white"/><rect x="1" y="5" width="15" height="14" rx="2" fill="white"/></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {uploadingBatch.count > 1 && (
                        <span className="text-white font-bold text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                          {uploadingBatch.count} items
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Typing indicator */}
            {otherTyping && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs shrink-0">
                  {otherUser?.profile_photo
                    ? <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                    : otherUser?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[#141414] flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-white/40"
                      style={{ animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Reply strip */}
          {replyTo && (
            <div
              className="shrink-0 flex items-center gap-3 px-4 py-2.5"
              style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' }}
            >
              <div className="w-0.5 self-stretch rounded-full" style={{ backgroundColor: '#F0EBE3', opacity: 0.4 }} />
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs font-semibold truncate">
                  {replyTo.sender_id === userId ? 'You' : displayName(replyTo.sender?.name)}
                </p>
                <p className="text-white/30 text-xs truncate">
                  {replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'video' ? '🎥 Video' : replyTo.content}
                </p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white/60 shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Blocked banner */}
          {isBlockedByMe && otherUser && (
            <div
              className="shrink-0 mx-1 mb-2 rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: 'rgba(255,59,48,0.08)', border: '0.5px solid rgba(255,59,48,0.2)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <circle cx="12" cy="12" r="9" stroke="#FF3B30" strokeWidth="2"/>
                <path d="M5.636 5.636l12.728 12.728" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="flex-1 text-xs" style={{ color: 'rgba(255,59,48,0.8)' }}>
                You've blocked {otherUser.name}.
              </p>
              <button
                type="button"
                onClick={async () => { await unblockUser(otherUser.id); setIsBlockedByMe(false) }}
                className="text-xs font-semibold shrink-0"
                style={{ color: '#FF3B30' }}
              >
                Unblock
              </button>
            </div>
          )}

          {/* Input */}
          <form
            ref={composerFormRef}
            onSubmit={handleSend}
            className="shrink-0 pt-3 border-t border-white/8 flex gap-2 items-end md:pb-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' } as React.CSSProperties}
          >
            {/* Photo button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              {uploadingImage ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(255,255,255,0.5)"/>
                  <path d="M21 15l-5-5L5 21" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={handleImagePick} />

            <textarea
              ref={composerRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleComposerKeyDown}
              disabled={isBlockedByMe}
              placeholder={isBlockedByMe ? 'You blocked this person' : 'Message…'}
              className="flex-1 bg-white/8 border border-white/12 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-white/25 disabled:opacity-40 resize-none overflow-y-auto"
              style={{ fontSize: 16, maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || isBlockedByMe}
              className="bg-white text-black font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-30"
            >
              Send
            </button>
          </form>
        </div>
      </motion.main>

      {/* Action sheet */}
      <AnimatePresence>
        {actionMsg && (
          <MessageActionSheet
            msg={{ ...actionMsg, trip_chat_id: conversationId, is_edited: false, reactions: actionMsg.reactions ?? [] } as TripMessage}
            isMe={actionMsg.sender_id === userId}
            myReactions={(actionMsg.reactions ?? []).filter(r => r.user_id === userId).map(r => r.emoji)}
            onClose={() => setActionMsg(null)}
            onReact={emoji => {
              if (userId) toggleReaction(actionMsg.id, emoji).then(() => queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] }))
              setActionMsg(null)
            }}
            onReply={() => { setReplyTo(actionMsg); setActionMsg(null) }}
            onCopy={() => { navigator.clipboard.writeText(actionMsg.content); setActionMsg(null) }}
            onDelete={async () => {
              setActionMsg(null)
              queryClient.setQueryData<DMMessage[]>(['dmMessages', conversationId], old => (old ?? []).filter(m => m.id !== actionMsg.id))
              await deleteDMMessage(actionMsg.id)
              queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
            }}
            onReport={() => {
              setActionMsg(null)
              if (actionMsg.sender_id !== userId) setReportMsg(actionMsg)
            }}
            onInfo={() => { setInfoMsg(actionMsg); setActionMsg(null) }}
          />
        )}
      </AnimatePresence>

      {/* Message info (read receipt) */}
      <AnimatePresence>
        {infoMsg && (
          <MessageInfoSheet
            key="info"
            content={infoMsg.content}
            isImage={infoMsg.type === 'image'}
            isVideo={infoMsg.type === 'video'}
            sentAt={infoMsg.created_at}
            receipts={infoReceipts}
            onClose={() => setInfoMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Block / Report sheet */}
      <AnimatePresence>
        {showBlockReport && otherUser && (
          <BlockReportSheet
            userId={otherUser.id}
            userName={otherUser.name}
            userPhoto={otherUser.profile_photo}
            onClose={() => setShowBlockReport(false)}
            onBlocked={() => { setIsBlockedByMe(true); setShowBlockReport(false) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportMsg && reportMsg.sender_id !== userId && otherUser && (
          <ReportMessageSheet
            senderId={reportMsg.sender_id}
            senderName={otherUser.name}
            messageContent={reportMsg.content}
            onClose={() => setReportMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Full-screen image viewer (swipe through the conversation's photos) */}
      {viewingImage && (
        <ImageViewer
          images={viewingImage.images}
          startIndex={viewingImage.index}
          onClose={() => setViewingImage(null)}
        />
      )}

      {showUserInfo && otherUser && (
        <PublicProfileModal userId={otherUser.id} onClose={() => setShowUserInfo(false)} />
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  )
}
