'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getUserTripChats, getDMConversations, getProfileViewers, getProfile } from '@/lib/queries'
import { getPushState, registerPush } from '@/lib/push'
import { hasPlus } from '@/lib/trial'
import { initPresence, useOnlineUsers, formatLastSeen } from '@/lib/presence'
import { haptic } from '@/lib/haptics'
import { ProfileViewsSheet } from '@/components/ProfileViewsSheet'
import { isNativeApp } from '@/lib/native-app'

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
      <main className="md:pt-14 min-h-screen bg-black" style={{ paddingBottom: isNativeApp ? 16 : 'calc(env(safe-area-inset-bottom) + 82px)' }}>
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
  const [userId, setUserId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pushState, setPushState] = useState<'unsupported' | 'granted' | 'denied' | 'default' | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string | null>>({})
  const [showViews, setShowViews] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [isPlus, setIsPlus] = useState(false)
  const onlineUsers = useOnlineUsers()

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
      getProfileViewers(50).then(v => setViewerCount(v.length))
      getProfile(session.user.id).then(p => setIsPlus(hasPlus(p)))
    })
  }, [router])

  const { data: tripChats = [], isError: chatsError, refetch: refetchChats } = useQuery({
    queryKey: ['tripChats', userId],
    queryFn: () => getUserTripChats(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  })

  const { data: dms = [], isError: dmsError, refetch: refetchDms } = useQuery({
    queryKey: ['dms', userId],
    queryFn: () => getDMConversations(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  })

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

  if (pageLoading) return <MessagesSkeleton />

  return (
    <>
      <NavBar />
      <AnimatePresence>
        {showViews && (
          <ProfileViewsSheet onClose={() => { setShowViews(false) }} isPlus={isPlus} />
        )}
      </AnimatePresence>
      <main className="md:pt-14 min-h-screen bg-black" style={{ paddingBottom: isNativeApp ? 16 : 'calc(env(safe-area-inset-bottom) + 82px)' }}>
        <div className="max-w-2xl mx-auto">
          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between px-5 pt-6 pb-4">
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
            <h2 className="px-5 py-3 text-white/40 text-xs font-semibold uppercase tracking-widest border-b border-white/6">
              Trip Chats
            </h2>
            {chatsError ? (
              <div className="px-5 py-6 flex flex-col items-center gap-3">
                <p className="text-white/25 text-sm text-center">Couldn't load chats</p>
                <button onClick={() => refetchChats()} className="text-white/50 text-xs font-semibold px-4 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>Try again</button>
              </div>
            ) : tripChats.length === 0 ? (
              <div className="px-5 py-8 text-white/20 text-sm text-center">
                Join a trip to start chatting
              </div>
            ) : (
              tripChats.map((item: any) => {
                const chat = item.trip_chat
                const trip = chat?.trip
                if (!chat || !trip) return null
                const hasUnread = item.unread_count > 0 && !item.is_muted
                return (
                  <button
                    key={chat.id}
                    onClick={() => { haptic(8); router.push(`/chat/${chat.id}`) }}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 active:bg-white/4 active:scale-[0.98] transition-all border-b border-white/6"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/8 overflow-hidden shrink-0">
                      {trip.cover_image ? (
                        <img src={trip.cover_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🌍</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-white/70 font-medium'}`}>
                        {trip.destination}{trip.country ? `, ${trip.country}` : ''}
                      </p>
                      <p className={`text-xs mt-0.5 truncate ${hasUnread ? 'text-white/60' : 'text-white/30'}`}>
                        {item.last_message?.startsWith('https://') ? '📷 Photo' : (item.last_message ?? 'Group chat')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
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
                return (
                  <button
                    key={dm.id}
                    onClick={() => { haptic(8); router.push(`/dm/${dm.id}`) }}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 active:bg-white/4 active:scale-[0.98] transition-all border-b border-white/6"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-white/8 overflow-hidden">
                        {other?.profile_photo ? (
                          <img src={other.profile_photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white/50">
                            {other?.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full" style={{ backgroundColor: '#30D158', border: '2.5px solid #000' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-white/70 font-medium'}`}>
                        {other?.name ?? 'Unknown'}
                      </p>
                      {/* Presence line — always shown when available; falls back to last message */}
                      {presenceText ? (
                        <p className="text-xs mt-0.5 truncate" style={{ color: isOnline ? '#30D158' : 'rgba(255,255,255,0.28)' }}>
                          {presenceText}
                        </p>
                      ) : dm.last_message ? (
                        <p className={`text-xs mt-0.5 truncate ${hasUnread ? 'text-white/60' : 'text-white/30'}`}>
                          {dm.last_message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {dm.last_message_at && (
                        <span className={`text-xs ${hasUnread ? 'text-white/50' : 'text-white/20'}`}>
                          {timeAgo(dm.last_message_at)}
                        </span>
                      )}
                      <UnreadBadge count={dm.unread_count} />
                    </div>
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
