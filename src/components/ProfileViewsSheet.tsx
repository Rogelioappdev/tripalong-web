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

// ── localStorage helpers ────────────────────────────────────────────────────
const LS_USED_KEY = 'pv_free_reveal_used'
const LS_IDS_KEY  = 'pv_revealed_ids'

function hasUsedFreeReveal(): boolean {
  try { return localStorage.getItem(LS_USED_KEY) === 'true' } catch { return false }
}
function markFreeRevealUsed(): void {
  try { localStorage.setItem(LS_USED_KEY, 'true') } catch {}
}
function getRevealedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_IDS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
function addRevealedId(id: string): void {
  try {
    const ids = getRevealedIds()
    ids.add(id)
    localStorage.setItem(LS_IDS_KEY, JSON.stringify([...ids]))
  } catch {}
}

// ── Helpers ─────────────────────────────────────────────────────────────────
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
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, stepTime)
    return () => clearInterval(timer)
  }, [target, duration])
  return count
}

// ── Paywall ─────────────────────────────────────────────────────────────────
function Paywall({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto"
      style={{ backgroundColor: '#050505' }}
    >
      <div className="flex justify-end px-5 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <button
          onClick={() => { haptic(6); onClose() }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center py-8">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.08 }}
          className="mb-6 flex items-center justify-center rounded-3xl"
          style={{ width: 72, height: 72, background: 'linear-gradient(145deg, rgba(240,235,227,0.14) 0%, rgba(240,235,227,0.04) 100%)', border: '0.5px solid rgba(240,235,227,0.22)' }}
        >
          <span style={{ fontSize: 34 }}>✦</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.14 }}
          className="font-bold tracking-widest mb-3"
          style={{ color: 'rgba(240,235,227,0.5)', fontSize: 11 }}
        >
          TRIPALONG PLUS
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.18 }}
          className="text-white font-extrabold tracking-tight mb-3"
          style={{ fontSize: 30, lineHeight: '34px', letterSpacing: '-0.8px' }}
        >
          {count} {count === 1 ? 'person wants' : 'people want'} to travel with you
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.24 }}
          className="mb-8"
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: '22px' }}
        >
          Unlock unlimited reveals and see exactly who's interested
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.28 }}
          className="w-full flex flex-col gap-2.5 mb-8"
        >
          {[
            { icon: '👁', text: 'Unlimited profile view reveals' },
            { icon: '💬', text: 'Message anyone who viewed you' },
            { icon: '🔖', text: 'See who saved your trips' },
            { icon: '⚡', text: 'Priority in travel matching' },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 17 }}>{f.icon}</span>
              <span className="text-white font-medium flex-1" style={{ fontSize: 13 }}>{f.text}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="rgba(240,235,227,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.34 }}
          className="w-full"
        >
          <button
            onClick={() => haptic(14)}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            ✦ Upgrade to Plus
          </button>
          <button
            onClick={() => { haptic(6); onClose() }}
            className="w-full mt-4 py-2 text-sm active:opacity-60 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            Maybe later
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}

// ── Main sheet ───────────────────────────────────────────────────────────────
export function ProfileViewsSheet({ onClose }: ProfileViewsSheetProps) {
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [selectedViewer, setSelectedViewer] = useState<{ id: string; locked: boolean } | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const displayCount = useCountUp(viewers.length)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    getProfileViewers().then(v => { setViewers(v as Viewer[]); setLoading(false) })
  }, [])

  const handleViewerTap = (viewer: Viewer) => {
    haptic(8)
    const revealedIds = getRevealedIds()
    setSelectedViewer({ id: viewer.id, locked: !revealedIds.has(viewer.id) })
  }

  const handleRevealRequest = (): boolean => {
    if (!selectedViewer) return false
    const revealedIds = getRevealedIds()
    if (revealedIds.has(selectedViewer.id)) return true
    if (!hasUsedFreeReveal()) {
      markFreeRevealUsed()
      addRevealedId(selectedViewer.id)
      return true
    }
    setShowPaywall(true)
    return false
  }

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
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)', paddingBottom: 12, borderColor: 'rgba(255,255,255,0.08)' }}
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
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
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

              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />

              {/* ── Profile grid ── */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-7 px-5 pt-7 pb-10">
                {viewers.map((viewer, i) => {
                  const isRevealed = getRevealedIds().has(viewer.id)
                  return (
                    <motion.button
                      key={viewer.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: 0.14 + i * 0.05 }}
                      onClick={() => handleViewerTap(viewer)}
                      className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                    >
                      {/* Avatar with subtle blur */}
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
                            style={
                              isRevealed
                                ? undefined
                                : { filter: 'blur(2px) brightness(0.82)', transform: 'scale(1.08)' }
                            }
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center font-bold"
                            style={{
                              fontSize: 28,
                              color: isRevealed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                            }}
                          >
                            {viewer.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </div>

                      <p
                        className="font-semibold text-xs text-center w-full truncate"
                        style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 84, paddingLeft: 2, paddingRight: 2 }}
                      >
                        {viewer.name}
                      </p>

                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)', marginTop: -4 }}>
                        {timeAgo(viewer.viewed_at)}
                      </p>
                    </motion.button>
                  )
                })}
              </div>

              <div style={{ height: 'calc(env(safe-area-inset-bottom) + 24px)' }} />
            </>
          )}
        </div>
      </motion.div>

      {/* PublicProfileModal (locked or revealed) */}
      <AnimatePresence>
        {selectedViewer && (
          <PublicProfileModal
            key={selectedViewer.id}
            userId={selectedViewer.id}
            onClose={() => setSelectedViewer(null)}
            locked={selectedViewer.locked}
            onRevealRequest={handleRevealRequest}
            onSendMessageLocked={() => setShowPaywall(true)}
          />
        )}
      </AnimatePresence>

      {/* Paywall */}
      <AnimatePresence>
        {showPaywall && (
          <Paywall count={viewers.length} onClose={() => setShowPaywall(false)} />
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
