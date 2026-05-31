'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getProfileViewers } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { PublicProfileModal } from './PublicProfileModal'

interface Viewer {
  id: string
  name: string
  profile_photo: string | null
  travel_styles: string[]
  country: string | null
  viewed_at: string
}

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

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) return
    const steps = Math.min(target, 36)
    const stepTime = duration / steps
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, stepTime)
    return () => clearInterval(timer)
  }, [target, duration])
  return count
}

export function ProfileViewsSheet({ onClose }: ProfileViewsSheetProps) {
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const displayCount = useCountUp(viewers.length)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    getProfileViewers().then(v => { setViewers(v as Viewer[]); setLoading(false) })
  }, [])

  if (!mounted) return null

  return createPortal(
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 36, mass: 0.85 }}
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ backgroundColor: '#000' }}
      >
        {/* Top bar */}
        <div
          className="shrink-0 flex items-center gap-3 px-4 border-b"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
            paddingBottom: 12,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={() => { haptic(8); onClose() }}
            className="flex items-center gap-1.5 active:scale-90 transition-transform shrink-0"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-base">Profile Views</h1>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>No views yet</p>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  When someone views your profile,<br />they'll show up here
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Hero count ── */}
              <div className="flex flex-col items-center px-5 pt-10 pb-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24, delay: 0.04 }}
                  className="mb-6"
                >
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="rgba(240,235,227,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="rgba(240,235,227,0.55)" strokeWidth="1.8" />
                  </svg>
                </motion.div>

                {/* Big animated number */}
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 26, delay: 0.1 }}
                  className="font-extrabold tracking-tight"
                  style={{ fontSize: 96, lineHeight: '88px', color: '#F0EBE3', letterSpacing: '-5px' }}
                >
                  {displayCount}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="font-medium mt-4"
                  style={{ color: 'rgba(255,255,255,0.38)', fontSize: 16 }}
                >
                  {viewers.length === 1 ? 'person viewed your profile' : 'people viewed your profile'}
                </motion.p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />

              {/* ── Profile grid ── */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-7 px-5 pt-7 pb-10">
                {viewers.map((viewer, i) => (
                  <motion.button
                    key={viewer.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: 0.14 + i * 0.05 }}
                    onClick={() => { haptic(8); setSelectedUserId(viewer.id) }}
                    className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                  >
                    {/* Avatar */}
                    <div
                      className="rounded-full overflow-hidden"
                      style={{
                        width: 80,
                        height: 80,
                        backgroundColor: '#1a1a1a',
                        boxShadow: '0 0 0 2.5px rgba(255,255,255,0.08)',
                      }}
                    >
                      {viewer.profile_photo ? (
                        <img
                          src={viewer.profile_photo}
                          alt={viewer.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center font-bold text-white/50"
                          style={{ fontSize: 28 }}
                        >
                          {viewer.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <p
                      className="font-semibold text-xs text-center w-full truncate"
                      style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 84, paddingLeft: 2, paddingRight: 2 }}
                    >
                      {viewer.name}
                    </p>

                    {/* Time */}
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)', marginTop: -4 }}>
                      {timeAgo(viewer.viewed_at)}
                    </p>
                  </motion.button>
                ))}
              </div>

              <div style={{ height: 'calc(env(safe-area-inset-bottom) + 24px)' }} />
            </>
          )}
        </div>
      </motion.div>

      {/* PublicProfileModal on top */}
      <AnimatePresence>
        {selectedUserId && (
          <PublicProfileModal
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
          />
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
