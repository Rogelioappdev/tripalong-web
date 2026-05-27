'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { TripGroupInfoSheet } from '@/components/TripGroupInfoSheet'
import { MessageActionSheet } from '@/components/MessageActionSheet'
import { supabase } from '@/lib/supabase'
import {
  getChatMessages,
  getOlderChatMessages,
  sendMessage,
  deleteMessage,
  toggleReaction,
  markTripChatRead,
  getTripInfoByChatId,
  getChatMemberReadPositions,
} from '@/lib/queries'
import type { TripMessage, TripWithDetails } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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

// ── Main component ─────────────────────────────────────────────────────────
export default function ChatPage() {
  const { id: chatId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [tripInfo, setTripInfo] = useState<TripWithDetails | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  // Messages + pagination
  const [olderMessages, setOlderMessages] = useState<TripMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Input + reply
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<TripMessage | null>(null)

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Long-press / action sheet
  const [actionMsg, setActionMsg] = useState<TripMessage | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)

  // Scroll
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const userIdRef = useRef<string | null>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      userIdRef.current = uid
      if (uid) {
        supabase.from('users').select('name').eq('id', uid).single()
          .then(({ data: u }) => { if (u) setUserName((u as any).name ?? '') })
      }
    })
  }, [])

  // ── Trip info ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (chatId && userId) getTripInfoByChatId(chatId).then(setTripInfo)
  }, [chatId, userId])

  // ── Mark read ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (userId && chatId) {
      markTripChatRead(chatId)
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      queryClient.invalidateQueries({ queryKey: ['tripChats'] })
    }
  }, [userId, chatId, queryClient])

  // ── Messages query ────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      const msgs = await getChatMessages(chatId, 50)
      setHasMore(msgs.length === 50)
      return msgs
    },
    enabled: !!chatId,
  })

  // ── Read positions ────────────────────────────────────────────────────────
  const { data: readPositions = [] } = useQuery({
    queryKey: ['chatReadPositions', chatId],
    queryFn: () => getChatMemberReadPositions(chatId),
    enabled: !!chatId && !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      // Replace optimistic with real data from DB
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
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
    await deleteMessage(msg.id)
    queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
  }

  const handleCopy = (msg: TripMessage) => {
    navigator.clipboard.writeText(msg.content).catch(() => {})
  }

  const handleReport = async (msg: TripMessage) => {
    if (!userId) return
    await supabase.from('user_reports').insert({
      reporter_id: userId,
      reported_user_id: msg.sender_id,
      reason: 'Inappropriate message in trip chat',
    })
  }

  // ── Read receipt helpers ──────────────────────────────────────────────────
  const allMessages = [...olderMessages, ...messages]
  const otherReadPositions = readPositions.filter(r => r.user_id !== userId)

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <NavBar />
      <main className="md:pt-14 bg-black flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0 px-4">

          {/* Chat header */}
          <div className="py-2.5 border-b border-white/8 flex items-center gap-3 shrink-0">
            <button onClick={() => router.back()} className="text-white/40 hover:text-white transition-colors shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {tripInfo ? (
              <button type="button" onClick={() => setShowGroupInfo(true)} className="flex-1 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                  {tripInfo.cover_image
                    ? <img src={tripInfo.cover_image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-sm">🌍</div>}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white font-semibold text-sm truncate">
                    {tripInfo.destination}{tripInfo.country ? `, ${tripInfo.country}` : ''}
                  </p>
                  <p className="text-white/40 text-xs">{tripInfo.member_count} members</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/30">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            ) : (
              <div className="flex-1 h-8 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-y-contain py-4 flex flex-col gap-1.5">

            {/* Trip info banner */}
            {tripInfo && (() => {
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
                    ? <img src={tripInfo.cover_image} alt="" className="w-full h-full object-cover" />
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

            {/* Load more */}
            {hasMore && (
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

            {isLoading && <div className="text-white/30 text-sm text-center py-8">Loading messages…</div>}

            {allMessages.map((msg, idx) => {
              const isMe = msg.sender_id === userId
              const isSystem = msg.type === 'system'
              const reactionGroups = groupReactions(msg.reactions)
              const isLastInGroup = idx === allMessages.length - 1 || allMessages[idx + 1].sender_id !== msg.sender_id
              const seenBy = msg.id === myLastSeenMsgId ? getSeenBy(msg) : []

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center text-white/30 text-xs py-1">{msg.content}</div>
                )
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 select-none ${isMe ? 'flex-row-reverse' : ''}`}
                  onPointerDown={() => handlePointerDown(msg)}
                  onPointerUp={handlePointerUp}
                  onPointerMove={handlePointerMove}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={e => { e.preventDefault(); setActionMsg(msg) }}
                >
                  {/* Avatar */}
                  {!isMe && isLastInGroup && (
                    <div className="w-7 h-7 rounded-full bg-white/10 shrink-0 overflow-hidden flex items-center justify-center text-xs">
                      {msg.sender?.profile_photo
                        ? <img src={msg.sender.profile_photo} alt="" className="w-full h-full object-cover" />
                        : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  {!isMe && !isLastInGroup && <div className="w-7 shrink-0" />}

                  {/* Bubble column */}
                  <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && idx > 0 && allMessages[idx - 1].sender_id !== msg.sender_id && (
                      <span className="text-white/30 text-xs px-1">{msg.sender?.name}</span>
                    )}
                    {!isMe && idx === 0 && (
                      <span className="text-white/30 text-xs px-1">{msg.sender?.name}</span>
                    )}

                    {/* Reply-to quote */}
                    {msg.reply_to && (
                      <div
                        className={`px-3 py-1.5 rounded-xl text-xs max-w-full ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderLeft: '2px solid rgba(255,255,255,0.25)' }}
                      >
                        <p className="text-white/50 font-medium truncate">{msg.reply_to.sender?.name ?? 'Unknown'}</p>
                        <p className="text-white/35 truncate">{msg.reply_to.content}</p>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isMe ? 'bg-[#E0DEDA] text-black rounded-br-sm' : 'bg-[#141414] text-white rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>

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
                    <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-white/20 text-xs">{formatTime(msg.created_at)}</span>
                      {seenBy.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          {seenBy.slice(0, 3).map(r => (
                            <div key={r.user_id} className="w-4 h-4 rounded-full bg-white/20 overflow-hidden">
                              {r.user?.profile_photo
                                ? <img src={r.user.profile_photo} alt="" className="w-full h-full object-cover" />
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
              )
            })}

            {/* Typing indicator */}
            {typingNames.length > 0 && (
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
                <p className="text-white/50 text-xs font-medium truncate">{replyTo.sender?.name ?? 'Unknown'}</p>
                <p className="text-white/35 text-xs truncate">{replyTo.content}</p>
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

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="shrink-0 pt-3 border-t border-white/8 flex gap-3 md:pb-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 82px)' } as React.CSSProperties}
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Message…"
              className="flex-1 bg-white/8 border border-white/12 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-white/25"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="bg-white text-black font-semibold px-5 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-30"
            >
              Send
            </button>
          </form>
        </div>
      </main>

      {/* Group Info sheet */}
      <AnimatePresence>
        {showGroupInfo && tripInfo && userId && (
          <TripGroupInfoSheet
            key="group-info"
            chatId={chatId}
            tripInfo={tripInfo}
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
            onReport={() => handleReport(actionMsg)}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  )
}
