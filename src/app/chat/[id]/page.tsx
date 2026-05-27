'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getChatMessages, sendMessage } from '@/lib/queries'
import type { TripMessage } from '@/lib/types'

export default function ChatPage() {
  const { id: chatId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => getChatMessages(chatId),
    enabled: !!chatId,
  })

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
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
          {/* Back button */}
          <div className="py-3 border-b border-white/8">
            <button onClick={() => router.back()} className="text-white/40 text-sm hover:text-white transition-colors">
              ← Back
            </button>
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
                        ? 'bg-white text-black rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm'
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
    </>
  )
}
