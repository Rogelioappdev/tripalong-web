'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getUserTripChats, getLastTripMessage, getDMConversations } from '@/lib/queries'

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function MessagesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUserId(session.user.id)
    })
  }, [router])

  const { data: tripChats = [] } = useQuery({
    queryKey: ['tripChats', userId],
    queryFn: () => getUserTripChats(userId!),
    enabled: !!userId,
  })

  const { data: dms = [] } = useQuery({
    queryKey: ['dms', userId],
    queryFn: () => getDMConversations(userId!),
    enabled: !!userId,
  })

  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-black pb-20 md:pb-8">
        <div className="max-w-2xl mx-auto">
          {/* Mobile header */}
          <div className="md:hidden px-5 pt-6 pb-4">
            <h1 className="text-white font-extrabold text-2xl">Messages</h1>
          </div>

          {/* Trip Chats */}
          <section>
            <h2 className="px-5 py-3 text-white/40 text-xs font-semibold uppercase tracking-widest border-b border-white/6">
              Trip Chats
            </h2>
            {tripChats.length === 0 ? (
              <div className="px-5 py-8 text-white/20 text-sm text-center">
                Join a trip to start chatting
              </div>
            ) : (
              tripChats.map((item: any) => {
                const chat = item.trip_chat
                const trip = chat?.trip
                if (!chat || !trip) return null
                return (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors border-b border-white/6"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/8 overflow-hidden shrink-0">
                      {trip.cover_image ? (
                        <img src={trip.cover_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🌍</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white font-semibold text-sm truncate">
                        {trip.destination}{trip.country ? `, ${trip.country}` : ''}
                      </p>
                      <p className="text-white/30 text-xs mt-0.5">Group chat</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )
              })
            )}
          </section>

          {/* DMs */}
          <section>
            <h2 className="px-5 py-3 text-white/40 text-xs font-semibold uppercase tracking-widest border-b border-white/6 mt-4">
              Direct Messages
            </h2>
            {dms.length === 0 ? (
              <div className="px-5 py-8 text-white/20 text-sm text-center">
                No direct messages yet
              </div>
            ) : (
              dms.map((dm: any) => {
                const other = dm.other_user
                return (
                  <button
                    key={dm.id}
                    onClick={() => router.push(`/dm/${dm.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors border-b border-white/6"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/8 overflow-hidden shrink-0">
                      {other?.profile_photo ? (
                        <img src={other.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white/50">
                          {other?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white font-semibold text-sm truncate">{other?.name ?? 'Unknown'}</p>
                      {dm.last_message && (
                        <p className="text-white/30 text-xs mt-0.5 truncate">{dm.last_message}</p>
                      )}
                    </div>
                    {dm.last_message_at && (
                      <span className="text-white/20 text-xs shrink-0">{timeAgo(dm.last_message_at)}</span>
                    )}
                  </button>
                )
              })
            )}
          </section>
        </div>
      </main>
    </>
  )
}
