'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getProfileViewers } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { startCheckout } from '@/lib/subscription'
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
const LS_IDS_KEY = 'pv_revealed_ids'

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
function Paywall({ count, viewers, onClose }: { count: number; viewers: Viewer[]; onClose: () => void }) {
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkout = useCallback(async () => {
    haptic(12)
    setLoading(true)
    setError(null)
    try {
      await startCheckout(selected === 'annual' ? 'plus_annual' : 'plus_monthly')
    } catch (err: any) {
      setLoading(false)
      setError(err?.message ?? 'Something went wrong. Try again.')
    }
  }, [selected])

  const previewViewers = viewers.slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto"
      style={{ backgroundColor: '#050505' }}
    >
      {/* Close */}
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

      <div className="flex-1 flex flex-col items-center px-6 pt-4 pb-8 text-center">

        {/* Blurred avatar stack */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.06 }}
          className="flex items-center justify-center mb-6"
        >
          <div className="relative flex">
            {previewViewers.length > 0 ? previewViewers.map((v, i) => (
              <div
                key={v.id}
                className="rounded-full overflow-hidden border-2"
                style={{
                  width: 56, height: 56,
                  borderColor: '#050505',
                  marginLeft: i === 0 ? 0 : -16,
                  zIndex: 10 - i,
                  backgroundColor: '#1a1a1a',
                }}
              >
                {v.profile_photo ? (
                  <img src={v.profile_photo} alt="" className="w-full h-full object-cover"
                    style={{ filter: 'blur(5px) brightness(0.75)', transform: 'scale(1.1)' }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-white/20" style={{ fontSize: 20 }}>
                    {v.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
            )) : [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-full border-2"
                style={{ width: 56, height: 56, borderColor: '#050505', marginLeft: i === 0 ? 0 : -16, zIndex: 10 - i, background: `hsl(${200 + i * 40}, 20%, 18%)` }} />
            ))}
            {/* Lock badge */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#F0EBE3', zIndex: 20 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#000" strokeWidth="2.5"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.12 }}
          className="font-bold tracking-widest mb-3"
          style={{ color: 'rgba(240,235,227,0.4)', fontSize: 10, letterSpacing: '0.14em' }}
        >
          TRIPALONG PLUS
        </motion.p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
          className="font-extrabold tracking-tight mb-2"
          style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-0.7px', color: '#fff' }}
        >
          {count} {count === 1 ? 'traveler checked' : 'travelers checked'} your profile
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.28, delay: 0.22 }}
          className="mb-8"
          style={{ color: 'rgba(255,255,255,0.32)', fontSize: 14, lineHeight: '20px' }}
        >
          They already found you. See who.
        </motion.p>

        {/* Plan cards — selectable */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.26 }}
          className="w-full flex flex-col gap-3 mb-6"
        >
          {/* Annual */}
          <button
            onClick={() => { haptic(4); setSelected('annual') }}
            className="w-full text-left rounded-2xl px-4 py-4 relative transition-all active:scale-[0.98]"
            style={{
              backgroundColor: selected === 'annual' ? 'rgba(240,235,227,0.1)' : 'rgba(255,255,255,0.04)',
              border: selected === 'annual' ? '1.5px solid rgba(240,235,227,0.6)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full font-bold text-white"
              style={{ backgroundColor: '#30D158', fontSize: 10, letterSpacing: '0.04em' }}>
              SAVE 38%
            </span>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold" style={{ fontSize: 15 }}>Annual</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>$59.99/year · cancel anytime</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-white font-extrabold" style={{ fontSize: 22, letterSpacing: '-0.5px' }}>$5</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>/month</p>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: selected === 'annual' ? 'none' : '1.5px solid rgba(255,255,255,0.2)', backgroundColor: selected === 'annual' ? '#F0EBE3' : 'transparent' }}>
                  {selected === 'annual' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Monthly */}
          <button
            onClick={() => { haptic(4); setSelected('monthly') }}
            className="w-full text-left rounded-2xl px-4 py-4 transition-all active:scale-[0.98]"
            style={{
              backgroundColor: selected === 'monthly' ? 'rgba(240,235,227,0.1)' : 'rgba(255,255,255,0.04)',
              border: selected === 'monthly' ? '1.5px solid rgba(240,235,227,0.6)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold" style={{ fontSize: 15 }}>Monthly</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Billed monthly · cancel anytime</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-white font-extrabold" style={{ fontSize: 22, letterSpacing: '-0.5px' }}>$7.99</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>/month</p>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: selected === 'monthly' ? 'none' : '1.5px solid rgba(255,255,255,0.2)', backgroundColor: selected === 'monthly' ? '#F0EBE3' : 'transparent' }}>
                  {selected === 'monthly' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.32 }}
          className="w-full flex flex-col gap-2 mb-8"
        >
          {[
            { label: 'Unlimited swipes', sub: 'Never hit a wall mid-session' },
            { label: 'See who viewed your profile', sub: 'Know who\'s already interested' },
            { label: 'Rewind last swipe', sub: 'Take back a pass in an instant' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 text-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <span className="text-white font-medium" style={{ fontSize: 13 }}>{f.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}> · {f.sub}</span>
              </div>
            </div>
          ))}
        </motion.div>

        {error && (
          <p className="text-center mb-2" style={{ color: '#FF453A', fontSize: 12 }}>{error}</p>
        )}
        <button
          onClick={checkout}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
        >
          {loading
            ? 'Opening checkout…'
            : `Continue with ${selected === 'annual' ? 'Annual · $59.99/yr' : 'Monthly · $7.99/mo'}`}
        </button>
        <button
          onClick={() => { haptic(6); onClose() }}
          className="w-full mt-3 py-2 active:opacity-60 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}
        >
          Maybe later
        </button>
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

  useEffect(() => {
    setMounted(true)
    // One-time migration: wipe data from the old flag-based system so
    // everyone gets their 1 free reveal under the new count-based gate.
    try {
      if (localStorage.getItem('pv_free_reveal_used') !== null) {
        localStorage.removeItem('pv_free_reveal_used')
        localStorage.removeItem(LS_IDS_KEY)
      }
    } catch {}
  }, [])
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
    if (revealedIds.size < 1) {
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
          <Paywall count={viewers.length} viewers={viewers} onClose={() => setShowPaywall(false)} />
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
