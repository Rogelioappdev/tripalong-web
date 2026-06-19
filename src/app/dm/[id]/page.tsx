'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { MessageActionSheet } from '@/components/MessageActionSheet'
import { ReportMessageSheet } from '@/components/ReportMessageSheet'
import { PublicProfileModal } from '@/components/PublicProfileModal'
import { BlockReportSheet } from '@/components/BlockReportSheet'
import { supabase } from '@/lib/supabase'
import {
  getDMMessages,
  getOlderDMMessages,
  sendDMMessage,
  deleteDMMessage,
  uploadDMImage,
  getDMConversations,
  markDMRead,
  toggleReaction,
  searchDMMessages,
  getDMOtherLastRead,
  isUserBlocked,
  unblockUser,
} from '@/lib/queries'
import { initPresence, useOnlineUsers, formatLastSeen } from '@/lib/presence'
import type { DMMessage, TripMessage } from '@/lib/types'
import { isNativeApp } from '@/lib/native-app'

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

  // Typing
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Action sheet
  const [actionMsg, setActionMsg] = useState<DMMessage | null>(null)
  const [reportMsg, setReportMsg] = useState<DMMessage | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)

  // Image
  const [uploadingImage, setUploadingImage] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null)
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

  // Safety notice (dismissed per conversation in localStorage)
  const safetyKey = `dm_safety_dismissed_${conversationId}`
  const [safetyDismissed, setSafetyDismissed] = useState(true) // start hidden, set in effect

  // Scroll
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const userIdRef = useRef<string | null>(null)

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
  })

  // ── Search query ──────────────────────────────────────────────────────────
  const { data: searchResults = [], isFetching: searchFetching } = useQuery({
    queryKey: ['dmSearch', conversationId, debouncedQuery],
    queryFn: () => searchDMMessages(conversationId, debouncedQuery),
    enabled: searchOpen && debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (typingDebounce.current) clearTimeout(typingDebounce.current)
    typingDebounce.current = setTimeout(broadcastTyping, 300)
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
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return }

    setUploadingImage(true)
    const localUrl = URL.createObjectURL(file)
    const optimisticId = `optimistic-img-${Date.now()}`
    const optimistic: DMMessage = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: userId,
      content: localUrl,
      type: 'image',
      reply_to_id: null,
      created_at: new Date().toISOString(),
      sender: { id: userId, name: userName, profile_photo: null },
      reply_to: null,
      reactions: [],
    }
    queryClient.setQueryData<DMMessage[]>(['dmMessages', conversationId], old => [...(old ?? []), optimistic])

    try {
      const publicUrl = await uploadDMImage(conversationId, file)
      await sendDMMessage(conversationId, userId, publicUrl, null, 'image')
      await queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
      URL.revokeObjectURL(localUrl)
    } catch {
      queryClient.setQueryData<DMMessage[]>(['dmMessages', conversationId], old =>
        (old ?? []).filter(m => m.id !== optimisticId)
      )
      URL.revokeObjectURL(localUrl)
    } finally {
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

  // Last message I sent — for read receipt
  const myMessages = allMessages.filter(m => m.sender_id === userId)
  const lastMyMsg = myMessages[myMessages.length - 1]
  const lastMyMsgIsRead = !!(lastMyMsg && otherLastRead && otherLastRead >= lastMyMsg.created_at)

  return (
    <>
      <NavBar />
      <main className="md:pt-14 bg-black flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0 px-4">

          {/* Header */}
          <div className="py-3 border-b border-white/8 flex items-center gap-3 shrink-0">
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
                      ? <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover" />
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-y-contain py-4 flex flex-col gap-1.5" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

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

            {isLoading && <ChatSkeleton />}

            {displayMessages.map((msg: DMMessage, idx: number) => {
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
                          ? <img src={msg.sender.profile_photo} alt="" className="w-full h-full object-cover" />
                          : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      <button
                        type="button"
                        onPointerDown={() => handlePointerDown(msg)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={() => { if (!holdFired.current) setViewingImage(msg.content) }}
                        className="rounded-2xl overflow-hidden active:opacity-80 transition-opacity"
                        style={{ width: 200, height: 200 }}
                      >
                        <img src={msg.content} alt="" className="w-full h-full object-cover" />
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
                      <span className="text-white/20 text-xs px-1">{formatTime(msg.created_at)}</span>
                      {isMe && isLastMyMsg && (
                        <span className="text-xs px-1" style={{ color: lastMyMsgIsRead ? '#30D158' : 'rgba(255,255,255,0.25)' }}>
                          {lastMyMsgIsRead ? 'Read' : 'Sent'}
                        </span>
                      )}
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
                          ? <img src={msg.sender.profile_photo} alt="" className="w-full h-full object-cover" />
                          : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      {isOtherOnline && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: '#30D158', border: '1.5px solid #000' }} />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Reply quote */}
                    {msg.reply_to && (
                      <div
                        className={`px-3 py-1.5 rounded-xl text-xs mb-0.5 max-w-full ${isMe ? 'text-right' : 'text-left'}`}
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderLeft: isMe ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRight: isMe ? '2px solid rgba(255,255,255,0.2)' : 'none' }}
                      >
                        <p className="text-white/50 font-semibold truncate">{msg.reply_to.sender?.name ?? 'Unknown'}</p>
                        <p className="text-white/35 truncate">{msg.reply_to.content?.startsWith('https://') ? '📷 Photo' : msg.reply_to.content}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onPointerDown={() => handlePointerDown(msg)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={() => { /* tap does nothing for text */ }}
                      className={`px-4 py-2.5 rounded-2xl text-sm text-left transition-opacity active:opacity-75 ${isMe ? 'bg-[#E0DEDA] text-black rounded-br-sm' : 'bg-[#141414] text-white rounded-bl-sm'}`}
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
                    <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-white/20 text-xs">{formatTime(msg.created_at)}</span>
                      {isMe && isLastMyMsg && (
                        <span className="text-xs" style={{ color: lastMyMsgIsRead ? '#30D158' : 'rgba(255,255,255,0.25)' }}>
                          {lastMyMsgIsRead ? 'Read' : 'Sent'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Typing indicator */}
            {otherTyping && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs shrink-0">
                  {otherUser?.profile_photo
                    ? <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover" />
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
                  {replyTo.sender_id === userId ? 'You' : (replyTo.sender?.name ?? 'Unknown')}
                </p>
                <p className="text-white/30 text-xs truncate">
                  {replyTo.type === 'image' ? '📷 Photo' : replyTo.content}
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
            onSubmit={handleSend}
            className="shrink-0 pt-3 border-t border-white/8 flex items-center gap-2.5 md:pb-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 82px)' } as React.CSSProperties}
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

            <input
              value={input}
              onChange={handleInputChange}
              disabled={isBlockedByMe}
              placeholder={isBlockedByMe ? 'You blocked this person' : 'Message…'}
              className="flex-1 bg-white/8 border border-white/12 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-white/25 disabled:opacity-40"
              style={{ fontSize: 16 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || isBlockedByMe}
              className="shrink-0 bg-white text-black font-semibold px-5 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-30"
              style={{ height: 44 }}
            >
              Send
            </button>
          </form>
        </div>
      </main>

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
