'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { getProfileViewers, getOrCreateDM } from '@/lib/queries'
import { haptic } from '@/lib/haptics'

interface ProfileViewsSheetProps {
  onClose: () => void
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProfileViewsSheet({ onClose }: ProfileViewsSheetProps) {
  const [viewers, setViewers] = useState<{ id: string; name: string; profile_photo: string | null; viewed_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [dmLoadingId, setDmLoadingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    getProfileViewers().then(v => { setViewers(v); setLoading(false) })
  }, [])

  const handleMessage = async (viewerId: string) => {
    if (dmLoadingId) return
    haptic(8)
    setDmLoadingId(viewerId)
    try {
      const convId = await getOrCreateDM(viewerId)
      onClose()
      router.push(`/dm/${convId}`)
    } catch {
      setDmLoadingId(null)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' } as React.CSSProperties}
        onClick={() => { haptic(6); onClose() }}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="relative w-full max-w-lg rounded-t-[28px] overflow-hidden flex flex-col"
        style={{ backgroundColor: '#0A0A0A', maxHeight: '82dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Profile Views</h2>
            {!loading && (
              <p className="text-white/35 text-xs mt-0.5">
                {viewers.length === 0 ? 'No views yet' : `${viewers.length} ${viewers.length === 1 ? 'person' : 'people'} viewed your profile`}
              </p>
            )}
          </div>
          <button
            onClick={() => { haptic(8); onClose() }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
                </svg>
              </div>
              <div>
                <p className="text-white/60 font-semibold text-base">No views yet</p>
                <p className="text-white/28 text-sm mt-1">When someone views your profile, they'll show up here</p>
              </div>
            </div>
          ) : (
            viewers.map((viewer) => (
              <div
                key={viewer.id}
                className="flex items-center gap-3.5 px-5 py-3.5 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="w-11 h-11 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
                  {viewer.profile_photo ? (
                    <img src={viewer.profile_photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-white/40" style={{ fontSize: 17 }}>
                      {viewer.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{viewer.name}</p>
                  <p className="text-white/35 text-xs mt-0.5">{timeAgo(viewer.viewed_at)}</p>
                </div>
                <button
                  onClick={() => handleMessage(viewer.id)}
                  disabled={!!dmLoadingId}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.12)' }}
                >
                  {dmLoadingId === viewer.id ? '…' : 'Message'}
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
