'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { TripGroupInfoSheet } from '@/components/TripGroupInfoSheet'
import { supabase } from '@/lib/supabase'
import { getChatMessages, sendMessage, markTripChatRead, getTripInfoByChatId } from '@/lib/queries'
import type { TripMessage, TripWithDetails } from '@/lib/types'

export default function ChatPage() {
  const { id: chatId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [tripInfo, setTripInfo] = useState<TripWithDetails | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (chatId && userId) getTripInfoByChatId(chatId).then(setTripInfo)
  }, [chatId, userId])

  useEffect(() => {
    if (userId && chatId) {
      markTripChatRead(chatId)
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      queryClient.invalidateQueries({ queryKey: ['tripChats'] })
    }
  }, [userId, chatId, queryClient])

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => getChatMessages(chatId),
    enabled: !!chatId,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        markTripChatRead(chatId)
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId, queryClient])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !userId || sending) return
    setSending(true)
    try {
      await sendMessage(chatId, userId, input.trim())
      setInput('')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <NavBar />
      <main className="md:pt-14 bg-black flex flex-col" style={{ height: '100dvh' }}>
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0 px-4">

          {/* Chat header */}
          <div className="py-2.5 border-b border-white/8 flex items-center gap-3 shrink-0">
            <button
              onClick={() => router.back()}
              className="text-white/40 hover:text-white transition-colors shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {tripInfo ? (
              <button
                type="button"
                onClick={() => setShowGroupInfo(true)}
                className="flex-1 flex items-center gap-3 min-w-0"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                  {tripInfo.cover_image ? (
                    <img src={tripInfo.cover_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">🌍</div>
                  )}
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
          <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
            {isLoading && (
              <div className="text-white/30 text-sm text-center py-8">Loading messages...</div>
            )}
            {messages.map((msg: TripMessage) => {
              const isMe = msg.sender_id === userId
              const isSystem = msg.type === 'system'

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center text-white/30 text-xs py-1">
                    {msg.content}
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-white/10 shrink-0 overflow-hidden flex items-center justify-center text-xs">
                      {msg.sender?.profile_photo ? (
                        <img src={msg.sender.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        msg.sender?.name?.[0]?.toUpperCase() ?? '?'
                      )}
                    </div>
                  )}
                  <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {!isMe && (
                      <span className="text-white/30 text-xs px-1">{msg.sender?.name}</span>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-[#E0DEDA] text-black rounded-br-sm'
                        : 'bg-[#141414] text-white rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-white/20 text-xs px-1">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="shrink-0 pt-3 border-t border-white/8 flex gap-3 md:pb-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 82px)' } as React.CSSProperties}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message..."
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
    </>
  )
}
