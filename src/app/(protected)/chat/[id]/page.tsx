'use client'

import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { TripGroupInfoSheet } from '@/components/TripGroupInfoSheet'
import { HangGroupInfoSheet } from '@/components/HangGroupInfoSheet'
import { MessageActionSheet } from '@/components/MessageActionSheet'
import { MessageInfoSheet, type MessageReceipt } from '@/components/MessageInfoSheet'
import { ReportMessageSheet } from '@/components/ReportMessageSheet'
import { JoinCelebration } from '@/components/JoinCelebration'
import { PublicProfileModal } from '@/components/PublicProfileModal'
import { supabase } from '@/lib/supabase'
import { registerPush, sendPushNotification } from '@/lib/push'
import { remindNotifications } from '@/lib/notifReminder'
import { ImageViewer } from '@/components/ImageViewer'
import { VideoViewer } from '@/components/VideoViewer'
import { initPresence, useOnlineUsers } from '@/lib/presence'
import { haptic } from '@/lib/haptics'
import { displayName } from '@/lib/displayName'
import { useSwipeBack } from '@/lib/useSwipeBack'
import {
  getChatMessages,
  getUsersByIds,
  getProfile,
  getOlderChatMessages,
  sendMessage,
  uploadChatMedia,
  deleteMessage,
  toggleReaction,
  markTripChatRead,
  getTripInfoByChatId,
  getHangInfoByChatId,
  getTripMembership,
  joinTrip,
  getChatMemberReadPositions,
  searchChatMessages,
} from '@/lib/queries'
import type { TripMessage, TripWithDetails, HangalongWithDetails } from '@/lib/types'
import { isNativeApp } from '@/lib/native-app'
import { resizedImage, resizedAvatar } from '@/lib/imageUrl'
import { mediaPreviewLabel } from '@/lib/messagePreview'
import { getVideoDuration } from '@/lib/videoDuration'

const HANG_ACTIVITY_EMOJI: Record<string, string> = {
  hike: '🥾', road_trip: '🚗', beach: '🏖️', climbing: '🧗',
  urban: '🌆', day_trip: '🚌', other: '✨',
}

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

// Day label for chat date separators: Today / Yesterday / weekday+date, with the
// year appended once the message is from a prior year.
function formatDateSeparator(d: string): string {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === today.getFullYear()
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', opts)
}

// True when two ISO timestamps fall on different calendar days.
function isNewDay(cur: string, prev: string | null): boolean {
  if (!prev) return true
  return new Date(cur).toDateString() !== new Date(prev).toDateString()
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

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

function groupReactions(reactions: TripMessage['reactions']) {
  const map: Record<string, string[]> = {}
  for (const r of reactions ?? []) {
    if (!map[r.emoji]) map[r.emoji] = []
    map[r.emoji].push(r.user_id)
  }
  return Object.entries(map).map(([emoji, users]) => ({ emoji, count: users.length, users }))
}

// ── Chat skeleton ──────────────────────────────────────────────────────────
const SKELETON_ROWS: { isMe: boolean; w: string }[] = [
  { isMe: false, w: '55%' }, { isMe: false, w: '38%' },
  { isMe: true, w: '48%' },  { isMe: true, w: '62%' },
  { isMe: false, w: '70%' }, { isMe: false, w: '42%' },
  { isMe: true, w: '35%' },  { isMe: false, w: '58%' },
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
export default function ChatPage() {
  const { id: chatId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [tripInfo, setTripInfo] = useState<TripWithDetails | null>(null)
  const [hangInfo, setHangInfo] = useState<HangalongWithDetails | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  // Messages + pagination
  const [olderMessages, setOlderMessages] = useState<TripMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Input + reply
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<TripMessage | null>(null)

  // Auto-grow the composer as the message wraps to more lines, capped so it
  // doesn't swallow the whole screen on a very long message.
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Long-press / action sheet
  const [actionMsg, setActionMsg] = useState<TripMessage | null>(null)
  const [infoMsg, setInfoMsg] = useState<TripMessage | null>(null)
  const [reportMsg, setReportMsg] = useState<TripMessage | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)

  // Image
  const [uploadingImage, setUploadingImage] = useState(false)
  // Single combined "sending N photos" placeholder shown while a multi-photo
  // batch uploads, instead of one bubble per photo popping in individually.
  const [uploadingBatch, setUploadingBatch] = useState<{ count: number; preview: string } | null>(null)
  const [viewingImage, setViewingImage] = useState<{ images: string[]; index: number } | null>(null)
  const [viewingVideo, setViewingVideo] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const composerFormRef = useRef<HTMLFormElement>(null)

  // Sender profile (tap avatar/name to view)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  // Join from chat
  const [showCelebration, setShowCelebration] = useState(false)
  const [joinBannerDismissed, setJoinBannerDismissed] = useState(false)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Scroll
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const userIdRef = useRef<string | null>(null)

  // ── Presence ──────────────────────────────────────────────────────────────
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
      }
    })
  }, [])

  // ── Trip / hang info ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId || !userId) return
    getTripInfoByChatId(chatId).then(trip => {
      if (trip) {
        setTripInfo(trip)
      } else {
        getHangInfoByChatId(chatId).then(hang => {
          if (hang) setHangInfo(hang)
        })
      }
    })
  }, [chatId, userId])

  // ── Membership status ─────────────────────────────────────────────────────
  const { data: membership, refetch: refetchMembership, isFetched: membershipFetched } = useQuery({
    queryKey: ['membership', tripInfo?.id, userId],
    queryFn: () => getTripMembership(tripInfo!.id, userId!),
    enabled: !!tripInfo?.id && !!userId,
  })

  const isFullMember = membership?.status === 'in'
  const showJoinBanner = membershipFetched && !isFullMember && !joinBannerDismissed && !!tripInfo && !showCelebration

  const joinMutation = useMutation({
    mutationFn: () => joinTrip(tripInfo!.id, userId!),
    onSuccess: () => {
      haptic([15, 30, 15, 30, 60])
      refetchMembership()
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      setShowCelebration(true)
    },
  })

  // ── Mark read ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (userId && chatId) {
      markTripChatRead(chatId)
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      queryClient.invalidateQueries({ queryKey: ['tripChats'] })
      // Refresh read receipts on open so your own view status (and everyone
      // else's latest) reflects immediately rather than on the next poll.
      queryClient.invalidateQueries({ queryKey: ['chatReadPositions', chatId] })
    }
  }, [userId, chatId, queryClient])

  // ── Search helpers ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const handleOpenSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const handleCloseSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  // ── Messages query ────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      const msgs = await getChatMessages(chatId, 50)
      setHasMore(msgs.length === 50)
      return msgs
    },
    enabled: !!chatId,
    staleTime: 30_000,
    refetchInterval: 3000,
  })

  // ── Read positions ────────────────────────────────────────────────────────
  const { data: readPositions = [] } = useQuery({
    queryKey: ['chatReadPositions', chatId],
    queryFn: () => getChatMemberReadPositions(chatId),
    enabled: !!chatId && !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  // ── Search results query ──────────────────────────────────────────────────
  const { data: searchResults = [], isFetching: searchFetching } = useQuery({
    queryKey: ['chatSearch', chatId, debouncedQuery],
    queryFn: () => searchChatMessages(chatId, debouncedQuery),
    enabled: searchOpen && debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  // The very first scroll (on opening the chat) must be instant, not smooth —
  // an animated scroll from the top over a long history, combined with
  // images still loading and pushing the content taller mid-animation, was
  // landing partway up instead of at the bottom. A second instant snap
  // shortly after catches any late image-driven layout shift. Only later
  // updates (new incoming messages) get the smooth animation.
  const initialScrollDoneRef = useRef(false)
  useEffect(() => { initialScrollDoneRef.current = false }, [chatId])
  useEffect(() => {
    if (searchOpen || messages.length === 0) return
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true
      bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
      const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior }), 300)
      return () => clearTimeout(t)
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, searchOpen])

  // ── Realtime channel ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_messages',
        filter: `trip_chat_id=eq.${chatId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
        if (userIdRef.current) {
          markTripChatRead(chatId)
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
          queryClient.invalidateQueries({ queryKey: ['chatReadPositions', chatId] })
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'trip_messages',
        filter: `trip_chat_id=eq.${chatId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trip_chat_members',
        filter: `trip_chat_id=eq.${chatId}`,
      }, () => {
        // Another member advanced their last_read_at (opened/viewed the chat) —
        // refresh read receipts immediately so "seen by" / the Info sheet update
        // in realtime instead of waiting on the 30s poll.
        queryClient.invalidateQueries({ queryKey: ['chatReadPositions', chatId] })
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId: typerId, name: typerName } = payload as { userId: string; name: string }
        if (typerId === userIdRef.current) return
        setTypingUsers(prev => ({ ...prev, [typerId]: typerName }))
        clearTimeout(typingTimers.current[typerId])
        typingTimers.current[typerId] = setTimeout(() => {
          setTypingUsers(prev => { const n = { ...prev }; delete n[typerId]; return n })
        }, 3000)
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [chatId, queryClient])

  // ── Typing broadcast ──────────────────────────────────────────────────────
  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || !userIdRef.current || !userName) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: userIdRef.current, name: userName },
    })
  }, [userName])

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

    // Optimistic update — message appears instantly
    const optimistic: TripMessage = {
      id: `optimistic-${Date.now()}`,
      trip_chat_id: chatId,
      sender_id: userId,
      content,
      type: 'text',
      reply_to_id: replyId,
      is_edited: false,
      created_at: new Date().toISOString(),
      sender: { id: userId, name: userName, profile_photo: null },
      reply_to: currentReplyTo
        ? { id: currentReplyTo.id, content: currentReplyTo.content, sender: currentReplyTo.sender }
        : null,
      reactions: [],
    }
    setInput('')
    setReplyTo(null)
    queryClient.setQueryData<TripMessage[]>(['messages', chatId], old => [...(old ?? []), optimistic])

    try {
      await sendMessage(chatId, userId, content, replyId)
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
      // Sending a message means you've seen the thread — advance last_read_at
      // past it and clear the unread badge / Messages-tab dot immediately,
      // rather than waiting on the realtime round-trip or the next poll.
      markTripChatRead(chatId)
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      queryClient.invalidateQueries({ queryKey: ['tripChats'] })
      sendPushNotification({ chatId, senderId: userId, senderName: userName, content, type: 'text', url: `/chat/${chatId}` })
      remindNotifications('message')
    } catch {
      // Roll back optimistic on failure and restore input
      queryClient.setQueryData<TripMessage[]>(['messages', chatId], old =>
        (old ?? []).filter(m => m.id !== optimistic.id)
      )
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  // ── Image pick & upload ───────────────────────────────────────────────────
  // Multiple photos upload in parallel behind a single "sending N photos"
  // placeholder, then reveal together — instead of one bubble per photo
  // popping in individually as each upload finishes in turn, which read as
  // slow/janky next to WhatsApp/Instagram's combined send-in-progress tile.
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length === 0 || !userId) return
    e.target.value = ''

    const files: File[] = []
    for (const file of picked) {
      const isVideo = file.type.startsWith('video/')
      const limit = isVideo ? 20 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > limit) {
        alert(`"${file.name}" is over ${isVideo ? '20 MB' : '10 MB'} and was skipped`)
        continue
      }
      if (isVideo) {
        try {
          const duration = await getVideoDuration(file)
          if (duration > 60) {
            alert(`"${file.name}" is longer than 60 seconds and was skipped`)
            continue
          }
        } catch {
          alert(`"${file.name}" couldn't be read and was skipped`)
          continue
        }
      }
      files.push(file)
    }
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
      const uploaded = await Promise.allSettled(files.map(file => uploadChatMedia(chatId, file)))

      // Sending is a lightweight DB insert — do it in order so the messages
      // land in the sequence the user picked them.
      let sentCount = 0
      for (let i = 0; i < uploaded.length; i++) {
        const result = uploaded[i]
        if (result.status !== 'fulfilled') continue
        const mediaType = files[i].type.startsWith('video/') ? 'video' : 'image'
        try {
          await sendMessage(chatId, userId, result.value, null, mediaType)
          sentCount++
          sendPushNotification({ chatId, senderId: userId, senderName: userName, content: result.value, type: mediaType, url: `/chat/${chatId}` })
        } catch (err) {
          console.error('Failed to send message', err)
        }
      }

      const failedCount = uploaded.length - sentCount
      if (failedCount > 0) alert(`${failedCount} item${failedCount > 1 ? 's' : ''} failed to send`)

      if (sentCount > 0) {
        haptic(10)
        await queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
        // Sending a photo also counts as seeing the thread — clear unread state.
        markTripChatRead(chatId)
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
        queryClient.invalidateQueries({ queryKey: ['tripChats'] })
        remindNotifications('message')
      }
    } finally {
      URL.revokeObjectURL(preview)
      setUploadingBatch(null)
      setUploadingImage(false)
    }
  }

  // ── Load older ────────────────────────────────────────────────────────────
  const handleLoadMore = async () => {
    const allMsgs = [...olderMessages, ...messages]
    if (!allMsgs.length || loadingMore) return
    setLoadingMore(true)
    const oldest = allMsgs[0].created_at
    try {
      const older = await getOlderChatMessages(chatId, oldest, 30)
      setOlderMessages(prev => [...older, ...prev])
      setHasMore(older.length === 30)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Long press ────────────────────────────────────────────────────────────
  const handlePointerDown = (msg: TripMessage) => {
    if (msg.type === 'system') return
    holdFired.current = false
    holdTimer.current = setTimeout(() => {
      holdFired.current = true
      setActionMsg(msg)
    }, 420)
  }

  const handlePointerUp = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  const handlePointerMove = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleReact = async (msg: TripMessage, emoji: string) => {
    await toggleReaction(msg.id, emoji)
    queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
  }

  const handleDelete = async (msg: TripMessage) => {
    // Optimistically drop it from the local list so it disappears instantly
    // for the sender (matches the DM page). Other participants pick it up via
    // the realtime DELETE subscription (REPLICA IDENTITY FULL) and the 3s poll.
    queryClient.setQueryData<TripMessage[]>(['messages', chatId], old =>
      (old ?? []).filter(m => m.id !== msg.id)
    )
    try {
      await deleteMessage(msg.id)
    } catch {
      // Server delete failed — refetch to restore the message rather than
      // leaving a phantom local deletion.
    }
    queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
  }

  const handleCopy = (msg: TripMessage) => {
    navigator.clipboard.writeText(msg.content).catch(() => {})
  }

  const handleReport = (msg: TripMessage) => {
    setReportMsg(msg)
  }

  // ── Read receipt helpers ──────────────────────────────────────────────────
  const allMessages = [...olderMessages, ...messages]
  const otherReadPositions = readPositions.filter(r => r.user_id !== userId)

  // Full per-member breakdown for the "Info" sheet — everyone else in the
  // chat, split into read (with when) vs delivered-but-not-read-yet.
  const infoReceipts: MessageReceipt[] = infoMsg
    ? otherReadPositions.map(r => ({
        id: r.user_id,
        name: r.user?.name ?? 'Someone',
        photo: r.user?.profile_photo ?? null,
        seenAt: r.last_read_at && new Date(r.last_read_at) >= new Date(infoMsg.created_at) ? r.last_read_at : null,
      }))
    : []

  // For each message I sent, find who has seen it
  const getSeenBy = (msg: TripMessage) => {
    if (msg.sender_id !== userId) return []
    return otherReadPositions.filter(r =>
      r.last_read_at && new Date(r.last_read_at) >= new Date(msg.created_at)
    )
  }

  // Only show "Seen" under my most recent sent message that has been seen
  const myLastSeenMsgId = (() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i]
      if (m.sender_id === userId && getSeenBy(m).length > 0) return m.id
    }
    return null
  })()

  const typingNames = Object.values(typingUsers)
  const isSearchMode = searchOpen && debouncedQuery.length >= 2
  const displayMessages = isSearchMode ? searchResults : allMessages
  // Reply-quote fallback: the reply_to embed comes back empty on refetch/realtime,
  // so resolve the quoted message from the already-loaded list by reply_to_id.
  const messagesById = useMemo(() => new Map(allMessages.map(m => [m.id, m])), [allMessages])

  // Every user id referenced in the chat — message senders and reply-quote
  // senders alike. Embedded `sender:users(...)` joins come back empty on the
  // client, so we resolve names via a direct batched read instead.
  const referencedUserIds = useMemo(() => {
    const ids = new Set<string>()
    allMessages.forEach((m: any) => {
      if (m.sender_id) ids.add(m.sender_id)
      if (m.reply_to?.sender_id) ids.add(m.reply_to.sender_id)
    })
    return Array.from(ids).sort()
  }, [allMessages])
  const referencedUserIdsKey = referencedUserIds.join(',')

  const { data: fetchedProfiles = [], isFetching: profilesFetching } = useQuery({
    queryKey: ['chatSenderProfiles', chatId, referencedUserIdsKey],
    queryFn: () => getUsersByIds(referencedUserIds),
    enabled: referencedUserIds.length > 0,
    staleTime: 60_000,
    // Older pages loading / realtime inserts add new ids, which changes the
    // key above and would otherwise reset `data` to [] mid-fetch — flashing
    // previously-resolved names off. Keep last-known data until the refetch
    // for the new id set lands.
    placeholderData: keepPreviousData,
  })

  // Per-id fallback for any sender the batched read above still misses (e.g.
  // a transient error on that request). Not the common path — getUsersByIds
  // is the source of truth — but this guarantees no sender is ever stuck
  // unresolved.
  const [fallbackProfiles, setFallbackProfiles] = useState<Map<string, { name: string | null; profile_photo: string | null }>>(new Map())
  const pendingFallbackIds = useRef<Set<string>>(new Set())

  // Authoritative sender lookup. Direct profile reads (fetchedProfiles) are the
  // reliable source — the same mechanism the public profile modal uses — with
  // the trip/hangout roster and the per-id fallback fetch as secondary sources.
  // Resolving by sender_id here avoids depending on the flaky per-message
  // `sender` embed, so names never fall back to "Unknown"/"Traveler" when the
  // name is actually known.
  const senderById = useMemo(() => {
    const map = new Map<string, { name: string | null; profile_photo: string | null }>()
    const add = (u: any) => {
      if (u?.id && !map.has(u.id)) map.set(u.id, { name: u.name ?? null, profile_photo: u.profile_photo ?? null })
    }
    fetchedProfiles.forEach((u: any) => add(u))
    tripInfo?.members?.forEach((m: any) => add(m.user))
    if (tripInfo?.creator) add(tripInfo.creator)
    hangInfo?.members?.forEach((m: any) => add(m.user))
    if (hangInfo?.creator) add(hangInfo.creator)
    fallbackProfiles.forEach((v, id) => { if (!map.has(id)) map.set(id, v) })
    return map
  }, [fetchedProfiles, tripInfo, hangInfo, fallbackProfiles])

  useEffect(() => {
    // Wait for the batched read to settle before falling back — otherwise
    // this fires for every referenced id on first render (before
    // fetchedProfiles has data), turning one batched request into N
    // redundant individual ones.
    if (profilesFetching) return
    const missing = referencedUserIds.filter(id => !senderById.has(id) && !pendingFallbackIds.current.has(id))
    if (missing.length === 0) return
    missing.forEach(id => pendingFallbackIds.current.add(id))
    let cancelled = false
    Promise.all(missing.map(id => getProfile(id))).then(results => {
      missing.forEach(id => pendingFallbackIds.current.delete(id))
      if (cancelled) return
      setFallbackProfiles(prev => {
        let changed = false
        const next = new Map(prev)
        results.forEach(p => {
          if (p?.id && !next.has(p.id)) {
            next.set(p.id, { name: p.name ?? null, profile_photo: p.profile_photo ?? null })
            changed = true
          }
        })
        return changed ? next : prev
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referencedUserIdsKey, senderById, profilesFetching])

  // ── Swipe-back ────────────────────────────────────────────────────────────
  // Mirrors the entrance slide (see motion.main below) so leaving the chat
  // feels like the same motion in reverse instead of an instant cut — the
  // actual navigation waits for onAnimationComplete to fire.
  const handleBack = () => {
    if (isExiting) return
    haptic(6)
    setIsExiting(true)
  }

  // Disabled while any sheet/overlay is on top so the gesture doesn't
  // navigate the whole screen away underneath it.
  useSwipeBack(
    handleBack,
    !searchOpen && !showGroupInfo && !actionMsg && !infoMsg && !reportMsg && !viewingImage && !viewingVideo && !showCelebration && !profileUserId && !isExiting
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <NavBar />
      <motion.main
        className="md:pt-14 bg-black flex flex-col overflow-hidden"
        style={{ height: '100dvh' }}
        initial={{ x: 32, opacity: 0.88 }}
        animate={isExiting ? { x: 60, opacity: 0.85 } : { x: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        onAnimationComplete={() => { if (isExiting) router.back() }}
      >
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0 px-4">

          {/* Chat header */}
          <div
            className="pb-2.5 border-b border-white/8 flex items-center gap-3 shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
          >
            <button
              onClick={searchOpen ? handleCloseSearch : handleBack}
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
            ) : tripInfo ? (
              <button type="button" onClick={() => setShowGroupInfo(true)} className="flex-1 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                  {tripInfo.cover_image
                    ? <img src={resizedAvatar(tripInfo.cover_image, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                    : <div className="w-full h-full flex items-center justify-center text-sm">🌍</div>}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white font-semibold text-sm truncate">
                    {tripInfo.destination}{tripInfo.country ? `, ${tripInfo.country}` : ''}
                  </p>
                  {(() => {
                    const memberIds = (tripInfo.members ?? []).map((m: any) => m.user?.id).filter(Boolean) as string[]
                    const othersOnline = memberIds.filter(id => id !== userId && onlineUsers.has(id)).length
                    const total = Math.max(tripInfo.members?.length ?? 0, tripInfo.member_count ?? 0)
                    return (
                      <p className="text-white/40 text-xs">
                        {othersOnline > 0 ? (
                          <><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#30D158] mr-1 mb-px" />{othersOnline} online{total > 0 ? ` · ${total} members` : ''}</>
                        ) : total > 0 ? (
                          `${total} members`
                        ) : null}
                      </p>
                    )
                  })()}
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/30">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            ) : hangInfo ? (
              <button type="button" onClick={() => setShowGroupInfo(true)} className="flex-1 flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  {hangInfo.photo_url
                    ? <img src={resizedAvatar(hangInfo.photo_url, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                    : <span style={{ fontSize: 18 }}>{HANG_ACTIVITY_EMOJI[hangInfo.activity_type] ?? '✨'}</span>}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white font-semibold text-sm truncate">{hangInfo.title}</p>
                  <p className="text-white/40 text-xs">
                    {hangInfo.member_count} member{hangInfo.member_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/30">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            ) : (
              <div className="flex-1 h-8 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )}

            {searchOpen ? (
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 text-white/40 hover:text-white transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              ) : <div className="w-[18px] shrink-0" />
            ) : (
              <button
                type="button"
                onClick={handleOpenSearch}
                className="shrink-0 text-white/40 hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-4 flex flex-col gap-1.5" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

            {/* Search results count */}
            {searchOpen && (
              <div className="text-center text-white/30 text-xs py-1 shrink-0">
                {debouncedQuery.length < 2
                  ? 'Type at least 2 characters…'
                  : searchFetching
                  ? 'Searching…'
                  : searchResults.length === 0
                  ? `No results for "${debouncedQuery}"`
                  : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${debouncedQuery}"`}
              </div>
            )}

            {/* Trip info banner */}
            {!searchOpen && tripInfo && (() => {
              const dateStr = formatDates(tripInfo.start_date, tripInfo.end_date)
              const subtitle = [dateStr, tripInfo.member_count > 0 ? `${tripInfo.member_count} members` : ''].filter(Boolean).join(' · ')
              return (
                <button
                  type="button"
                  onClick={() => setShowGroupInfo(true)}
                  className="w-full rounded-2xl overflow-hidden mb-3 text-left relative shrink-0"
                  style={{ height: 110 }}
                >
                  {tripInfo.cover_image
                    ? <img src={resizedImage(tripInfo.cover_image, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: '#111' }}>🌍</div>}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.88) 100%)' }} />
                  <div className="absolute bottom-0 left-0 px-4 pb-3">
                    <p className="text-white font-bold text-sm leading-tight">
                      {tripInfo.destination}{tripInfo.country ? `, ${tripInfo.country}` : ''}
                    </p>
                    {subtitle && <p className="text-white/45 text-xs mt-0.5">{subtitle}</p>}
                  </div>
                </button>
              )
            })()}

            {/* Hangout info banner */}
            {!searchOpen && hangInfo && (
              <button
                type="button"
                onClick={() => setShowGroupInfo(true)}
                className="w-full rounded-2xl overflow-hidden mb-3 text-left relative shrink-0"
                style={{ height: 110, backgroundColor: '#111' }}
              >
                {hangInfo.photo_url
                  ? <img src={hangInfo.photo_url} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                  : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 60, opacity: 0.1 }}>
                      {HANG_ACTIVITY_EMOJI[hangInfo.activity_type] ?? '✨'}
                    </div>}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.88) 100%)' }} />
                <div className="absolute bottom-0 left-0 px-4 pb-3">
                  <p className="text-white font-bold text-sm leading-tight">{hangInfo.title}</p>
                  <p className="text-white/45 text-xs mt-0.5">
                    {hangInfo.location_name} · {hangInfo.member_count} member{hangInfo.member_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            )}

            {/* Load more */}
            {!searchOpen && hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="self-center text-xs font-medium px-4 py-1.5 rounded-full mb-2 transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                {loadingMore ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}

            {(isLoading || !userId) && <ChatSkeleton />}

            {!isLoading && !!userId && displayMessages.map((msg, idx) => {
              const isMe = msg.sender_id === userId
              const isSystem = msg.type === 'system'
              const rosterSender = senderById.get(msg.sender_id)
              const senderName = displayName(rosterSender?.name ?? msg.sender?.name)
              const senderPhoto = rosterSender?.profile_photo ?? msg.sender?.profile_photo ?? null
              // The name label is only rendered when a REAL name resolved — no
              // placeholder ("Traveler") and no empty box for senders we couldn't resolve.
              const resolvedName = (rosterSender?.name ?? msg.sender?.name ?? '').trim()
              const hasRealName = resolvedName !== '' && resolvedName.toLowerCase() !== 'unknown'
              const reactionGroups = groupReactions(msg.reactions)
              // System messages ("X joined the trip") carry that user's sender_id, so a
              // plain sender_id comparison would treat them as part of the same run —
              // suppressing the name label/avatar on the next real message from that
              // sender. Exclude system messages from the run so grouping always
              // reflects visible chat bubbles only.
              const isLastInGroup = idx === displayMessages.length - 1
                || displayMessages[idx + 1].type === 'system'
                || displayMessages[idx + 1].sender_id !== msg.sender_id
              const isFirstInGroup = idx === 0
                || displayMessages[idx - 1].type === 'system'
                || displayMessages[idx - 1].sender_id !== msg.sender_id
              const seenBy = msg.id === myLastSeenMsgId ? getSeenBy(msg) : []

              // Day separator when this message starts a new calendar day.
              const prevMsg = idx > 0 ? displayMessages[idx - 1] : null
              const dateSep = isNewDay(msg.created_at, prevMsg?.created_at ?? null) ? (
                <div className="flex justify-center py-2">
                  <span
                    className="text-[11px] font-semibold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              ) : null

              if (isSystem) {
                return (
                  <Fragment key={msg.id}>
                    {dateSep}
                    <div className="text-center text-white/30 text-xs py-1">{msg.content}</div>
                  </Fragment>
                )
              }

              return (
                <Fragment key={msg.id}>
                {dateSep}
                <div
                  className={`flex items-end gap-2 select-none ${isMe ? 'flex-row-reverse' : ''}`}
                  onPointerDown={() => handlePointerDown(msg)}
                  onPointerUp={handlePointerUp}
                  onPointerMove={handlePointerMove}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={e => { e.preventDefault(); setActionMsg(msg) }}
                >
                  {/* Avatar — tap to view sender's full profile */}
                  {!isMe && isLastInGroup && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); haptic(6); setProfileUserId(msg.sender_id) }}
                      className="w-7 h-7 rounded-full bg-white/10 shrink-0 overflow-hidden flex items-center justify-center text-xs active:opacity-70 transition-opacity"
                    >
                      {senderPhoto
                        // Plain center-crop, not .ta-avatar's top-biased crop — at this tiny
                        // 28px size the top bias crops in too tight on the face, unlike the
                        // Group Info member rows (44px, plain object-cover) it should match.
                        ? <img src={resizedAvatar(senderPhoto, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0" />
                        : senderName[0].toUpperCase()}
                    </button>
                  )}
                  {!isMe && !isLastInGroup && <div className="w-7 shrink-0" />}

                  {/* Bubble column */}
                  <div className={`max-w-[72%] min-w-0 flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && hasRealName && isFirstInGroup && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); haptic(6); setProfileUserId(msg.sender_id) }}
                        className="text-white/50 text-xs font-medium px-1 active:opacity-70 transition-opacity"
                      >
                        {resolvedName}
                      </button>
                    )}
                    {/* Reply-to quote — guard on content, not just object truthiness:
                        the self-referencing reply_to embed can come back as a
                        truthy-but-empty object when reply_to_id is null. */}
                    {(() => {
                      const rc = msg.reply_to?.content ?? (msg.reply_to_id ? messagesById.get(msg.reply_to_id)?.content : null)
                      if (!rc) return null
                      return (
                        <div
                          className={`px-3 py-1.5 rounded-xl text-xs max-w-full ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                          style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderLeft: '2px solid rgba(255,255,255,0.25)' }}
                        >
                          <p className="text-white/35 truncate">{mediaPreviewLabel(rc) ?? rc}</p>
                        </div>
                      )
                    })()}

                    {/* Bubble */}
                    {msg.type === 'image' ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          if (holdFired.current) return
                          const imgs = displayMessages.filter(m => m.type === 'image').map(m => m.content)
                          setViewingImage({ images: imgs, index: Math.max(0, imgs.indexOf(msg.content)) })
                        }}
                        className={`overflow-hidden rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'} active:opacity-80 transition-opacity`}
                        style={{ maxWidth: 220, display: 'block' }}
                      >
                        <img
                          src={msg.content}
                          alt="Image"
                          className="w-full h-auto block"
                          style={{ maxHeight: 280, objectFit: 'contain' }}
                        />
                      </button>
                    ) : msg.type === 'video' ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          if (holdFired.current) return
                          setViewingVideo(msg.content)
                        }}
                        className={`relative overflow-hidden rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'} active:opacity-80 transition-opacity`}
                        style={{ maxWidth: 220, display: 'block' }}
                      >
                        <video
                          src={`${msg.content}#t=0.1`}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full block"
                          style={{ maxHeight: 280, objectFit: 'cover', backgroundColor: '#000' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: 'rgba(0,0,0,0.45)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm max-w-full ${
                          isMe ? 'bg-[#E0DEDA] text-black rounded-br-sm' : 'bg-[#141414] text-white rounded-bl-sm'
                        }`}
                        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                      >
                        {isSearchMode ? highlightText(msg.content, debouncedQuery) : msg.content}
                      </div>
                    )}

                    {/* Reactions */}
                    {reactionGroups.length > 0 && (
                      <div className={`flex flex-wrap gap-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {reactionGroups.map(({ emoji, count, users }) => {
                          const iMine = users.includes(userId ?? '')
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onPointerDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); handleReact(msg, emoji) }}
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-opacity active:opacity-60"
                              style={{
                                backgroundColor: iMine ? 'rgba(240,235,227,0.15)' : 'rgba(255,255,255,0.07)',
                                border: iMine ? '1px solid rgba(240,235,227,0.35)' : '1px solid rgba(255,255,255,0.1)',
                              }}
                            >
                              <span>{emoji}</span>
                              {count > 1 && <span style={{ color: 'rgba(255,255,255,0.6)' }}>{count}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Time + seen */}
                    <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-white/45 text-xs">{formatTime(msg.created_at)}</span>
                      {isMe && <CheckTick seen={otherReadPositions.some(r => r.last_read_at && r.last_read_at >= msg.created_at)} />}
                      {seenBy.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          {seenBy.slice(0, 3).map(r => (
                            <div key={r.user_id} className="w-4 h-4 rounded-full bg-white/20 overflow-hidden">
                              {r.user?.profile_photo
                                ? <img src={resizedAvatar(r.user.profile_photo, 100)} alt="" className="w-full h-full object-cover min-w-0 min-h-0 ta-avatar" />
                                : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                                    {r.user?.name?.[0]?.toUpperCase()}
                                  </div>}
                            </div>
                          ))}
                          {seenBy.length > 3 && (
                            <span className="text-white/30 text-[10px]">+{seenBy.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </Fragment>
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
            {!searchOpen && typingNames.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex gap-1 px-4 py-2.5 rounded-2xl rounded-bl-sm" style={{ backgroundColor: '#141414' }}>
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="block rounded-full"
                      style={{
                        width: 6, height: 6,
                        backgroundColor: 'rgba(255,255,255,0.4)',
                        animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-white/30 text-xs">
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing…`
                    : `${typingNames.slice(0, 2).join(', ')} are typing…`}
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Reply strip */}
          {replyTo && (
            <div
              className="shrink-0 flex items-center gap-3 px-4 py-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex-1 min-w-0" style={{ borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: 10 }}>
                <p className="text-white/50 text-xs font-medium truncate">{displayName(senderById.get(replyTo.sender_id)?.name ?? replyTo.sender?.name)}</p>
                <p className="text-white/35 text-xs truncate">{replyTo.content?.startsWith('https://') ? '📷 Photo' : replyTo.content}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-white/30 hover:text-white/60 transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Join this trip banner — shown only after membership is confirmed non-full */}
          {showJoinBanner && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="shrink-0 flex items-center gap-3 px-3 py-2.5"
              style={{ backgroundColor: 'rgba(240,235,227,0.06)', borderTop: '0.5px solid rgba(240,235,227,0.12)' }}
            >
              <span style={{ fontSize: 20 }}>🎒</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">Want to officially join?</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {membership?.status === 'maybe' ? "You're set to Maybe on this trip" : "You're viewing this trip's chat"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { haptic(10); joinMutation.mutate() }}
                disabled={joinMutation.isPending}
                className="shrink-0 font-bold text-sm rounded-2xl active:scale-[0.97] transition-transform disabled:opacity-40 px-4 py-2"
                style={{ backgroundColor: '#F0EBE3', color: '#000' }}
              >
                {joinMutation.isPending ? 'Joining…' : 'Join Trip'}
              </button>
              <button
                type="button"
                onClick={() => { haptic(4); setJoinBannerDismissed(true) }}
                className="shrink-0 flex items-center justify-center active:scale-90 transition-transform"
                style={{ width: 28, height: 28 }}
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </motion.div>
          )}

          {/* Input */}
          <form
            ref={composerFormRef}
            onSubmit={handleSend}
            className="shrink-0 pt-3 border-t border-white/8 flex gap-2 items-end md:pb-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' } as React.CSSProperties}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              multiple
              className="hidden"
              onChange={handleImagePick}
            />
            {/* Image pick button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl transition-colors disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              {uploadingImage ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(255,255,255,0.5)"/>
                  <path d="M21 15l-5-5L5 21" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <textarea
              ref={composerRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message…"
              className="flex-1 bg-white/8 border border-white/12 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-white/25 resize-none overflow-y-auto"
              style={{ maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="bg-white text-black font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-30"
            >
              Send
            </button>
          </form>
        </div>
      </motion.main>

      {/* Group Info sheet */}
      <AnimatePresence>
        {showGroupInfo && tripInfo && userId && (
          <TripGroupInfoSheet
            key="group-info"
            chatId={chatId}
            tripInfo={tripInfo}
            userId={userId}
            isFullMember={isFullMember}
            onJoinTrip={() => { setShowGroupInfo(false); joinMutation.mutate() }}
            onClose={() => setShowGroupInfo(false)}
            onLeft={() => router.replace('/messages')}
          />
        )}
        {showGroupInfo && hangInfo && userId && (
          <HangGroupInfoSheet
            key="hang-group-info"
            chatId={chatId}
            hangInfo={hangInfo}
            userId={userId}
            onClose={() => setShowGroupInfo(false)}
            onLeft={() => router.replace('/messages')}
          />
        )}
      </AnimatePresence>

      {/* Message action sheet */}
      <AnimatePresence>
        {actionMsg && (
          <MessageActionSheet
            key="action"
            msg={actionMsg}
            isMe={actionMsg.sender_id === userId}
            myReactions={(actionMsg.reactions ?? []).filter(r => r.user_id === userId).map(r => r.emoji)}
            onClose={() => setActionMsg(null)}
            onReact={emoji => handleReact(actionMsg, emoji)}
            onReply={() => { setReplyTo(actionMsg); setActionMsg(null) }}
            onCopy={() => handleCopy(actionMsg)}
            onDelete={() => handleDelete(actionMsg)}
            onReport={() => { setActionMsg(null); handleReport(actionMsg) }}
            onInfo={() => { setInfoMsg(actionMsg); setActionMsg(null) }}
          />
        )}
      </AnimatePresence>

      {/* Message info (read receipts) */}
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

      <AnimatePresence>
        {reportMsg && reportMsg.sender_id && (
          <ReportMessageSheet
            senderId={reportMsg.sender_id}
            senderName={reportMsg.sender?.name ?? 'This user'}
            messageContent={reportMsg.content}
            onClose={() => setReportMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Full-screen image viewer */}
      {viewingImage && (
        <ImageViewer
          images={viewingImage.images}
          startIndex={viewingImage.index}
          onClose={() => setViewingImage(null)}
        />
      )}

      {/* Full-screen video player */}
      {viewingVideo && (
        <VideoViewer src={viewingVideo} onClose={() => setViewingVideo(null)} />
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>

      <AnimatePresence>
        {showCelebration && tripInfo && (
          <JoinCelebration
            trip={tripInfo}
            inChat
            onOpenChat={() => {
              setShowCelebration(false)
              // Refresh trip header so joined user's profile appears
              getTripInfoByChatId(chatId).then(setTripInfo)
              queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
              queryClient.invalidateQueries({ queryKey: ['chatReadPositions', chatId] })
            }}
            onClose={() => setShowCelebration(false)}
          />
        )}
      </AnimatePresence>

      {profileUserId && (
        <PublicProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </>
  )
}
