'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getMyNotifications, markNotificationRead, markAllNotificationsRead, findPendingJoinRequest,
  type AppNotification,
} from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { resizedAvatar } from '@/lib/imageUrl'
import { PublicProfileModal } from './PublicProfileModal'
import { RequestSentToast } from './RequestSentToast'

const TYPE_ICON: Record<AppNotification['type'], string> = {
  trip_joined: '🎒',
  trip_invite: '✈️',
  join_request: '🙋',
  join_accepted: '🎉',
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

interface Props {
  onClose: () => void
  onUnreadChange?: () => void
}

export function NotificationCenterSheet({ onClose, onUnreadChange }: Props) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingJoinRequest, setViewingJoinRequest] = useState<{
    id: string; requesterId: string; requesterName: string
    tripId: string; tripDestination: string; tripCountry: string | null; tripCoverImage: string | null
  } | null>(null)
  const [acceptedMsg, setAcceptedMsg] = useState<string | null>(null)

  useEffect(() => {
    getMyNotifications().then(data => { setNotifications(data); setLoading(false) })
  }, [])

  const handleMarkAllRead = async () => {
    haptic(8)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await markAllNotificationsRead()
    onUnreadChange?.()
  }

  const handleTap = async (n: AppNotification) => {
    haptic(8)
    if (!n.is_read) {
      setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, is_read: true } : p))
      markNotificationRead(n.id)
      onUnreadChange?.()
    }

    if (n.type === 'join_request' && n.actor_id && n.trip_id) {
      const req = await findPendingJoinRequest(n.trip_id, n.actor_id)
      if (req) {
        setViewingJoinRequest({
          id: req.id,
          requesterId: n.actor_id,
          requesterName: n.actor?.name ?? 'Someone',
          tripId: n.trip_id,
          tripDestination: n.trip?.destination ?? 'this trip',
          tripCountry: n.trip?.country ?? null,
          tripCoverImage: n.trip?.cover_image ?? null,
        })
      } else {
        // Already responded to (from elsewhere) — nothing left to review.
        onClose()
        router.push('/messages')
      }
      return
    }

    if ((n.type === 'trip_joined' || n.type === 'join_accepted') && n.chat_id) {
      onClose()
      router.push(`/chat/${n.chat_id}`)
      return
    }

    // trip_invite (and any fallback) — the actionable banner lives on Messages.
    onClose()
    router.push('/messages')
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
          className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
          style={{ backgroundColor: '#000', borderRadius: '20px 20px 0 0', height: '85dvh' }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-bold" style={{ fontSize: 20 }}>Notifications</p>
            <div className="flex items-center gap-4">
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold" style={{ color: 'rgba(240,235,227,0.7)' }}>
                  Mark all read
                </button>
              )}
              <button type="button" onClick={onClose} className="text-white/40 active:opacity-60 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 px-8 text-center">
                <span style={{ fontSize: 32 }}>🔔</span>
                <p className="text-white/30 text-sm">Nothing yet — activity on your trips will show up here</p>
              </div>
            ) : (
              <div className="px-2 py-2">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleTap(n)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left active:bg-white/5 transition-colors"
                    style={{ backgroundColor: n.is_read ? 'transparent' : 'rgba(240,235,227,0.05)' }}
                  >
                    <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                      {n.actor?.profile_photo ? (
                        <img src={resizedAvatar(n.actor.profile_photo, 100)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ fontSize: 18 }}>{TYPE_ICON[n.type]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${n.is_read ? 'text-white/60' : 'text-white font-medium'}`}>{n.body}</p>
                      <p className="text-white/30 text-xs mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, backgroundColor: '#F0EBE3' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {acceptedMsg && <RequestSentToast message={acceptedMsg} />}
      </AnimatePresence>

      {viewingJoinRequest && (
        <PublicProfileModal
          userId={viewingJoinRequest.requesterId}
          onClose={() => setViewingJoinRequest(null)}
          joinRequest={{
            id: viewingJoinRequest.id,
            tripId: viewingJoinRequest.tripId,
            tripDestination: viewingJoinRequest.tripDestination,
            tripCountry: viewingJoinRequest.tripCountry,
            tripCoverImage: viewingJoinRequest.tripCoverImage,
            onResponded: (accepted) => {
              if (accepted) {
                setAcceptedMsg(`${viewingJoinRequest.requesterName} accepted to ${viewingJoinRequest.tripDestination}!`)
                setTimeout(() => setAcceptedMsg(null), 2600)
                onUnreadChange?.()
              }
              setViewingJoinRequest(null)
            },
          }}
        />
      )}
    </>,
    document.body,
  )
}
