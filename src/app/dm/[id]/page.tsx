'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getDMMessages, sendDMMessage, getDMConversations, markDMRead } from '@/lib/queries'

export default function DMPage() {
  const { id: conversationId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<{ name: string; profile_photo: string | null } | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) {
        getDMConversations(uid).then(convs => {
          const conv = convs.find((c: any) => c.id === conversationId)
          if (conv?.other_user) setOtherUser(conv.other_user)
        })
        markDMRead(conversationId)
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
        queryClient.invalidateQueries({ queryKey: ['dms'] })
      }
    })
  }, [conversationId, queryClient])

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dmMessages', conversationId],
    queryFn: () => getDMMessages(conversationId),
    enabled: !!conversationId,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        markDMRead(conversationId)
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, queryClient])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !userId || sending) return
    setSending(true)
    const content = input.trim()

    // Optimistic update — message appears instantly
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
      sender: { id: userId, name: '', profile_photo: null },
    }
    setInput('')
    queryClient.setQueryData<any[]>(['dmMessages', conversationId], old => [...(old ?? []), optimistic])

    try {
      await sendDMMessage(conversationId, userId, content)
      queryClient.invalidateQueries({ queryKey: ['dmMessages', conversationId] })
    } catch {
      queryClient.setQueryData<any[]>(['dmMessages', conversationId], old =>
        (old ?? []).filter((m: any) => m.id !== optimistic.id)
      )
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <NavBar />
      <main className="md:pt-14 bg-black flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 min-h-0 px-4">
          <div className="py-3 border-b border-white/8 flex items-center gap-3">
            <button onClick={() => router.back()} className="text-white/40 hover:text-white transition-colors shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {otherUser && (
              <>
                <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden shrink-0">
                  {otherUser.profile_photo
                    ? <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50">{otherUser.name?.[0]?.toUpperCase()}</div>
                  }
                </div>
                <span className="text-white font-semibold text-sm">{otherUser.name}</span>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-y-contain py-4 flex flex-col gap-3">
            {isLoading && <div className="text-white/30 text-sm text-center py-8">Loading...</div>}
            {messages.map((msg: any) => {
              const isMe = msg.sender_id === userId
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-white/10 shrink-0 overflow-hidden flex items-center justify-center text-xs">
                      {msg.sender?.profile_photo
                        ? <img src={msg.sender.profile_photo} alt="" className="w-full h-full object-cover" />
                        : msg.sender?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-[#E0DEDA] text-black rounded-br-sm' : 'bg-[#141414] text-white rounded-bl-sm'}`}>
                      {msg.content}
                    </div>
                    <span className="text-white/20 text-xs px-1">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
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
