'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getProfileViewers } from '@/lib/queries'
import { haptic } from '@/lib/haptics'

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

const STYLE_LABELS: Record<string, string> = {
  luxury: 'Luxury traveler',
  backpacking: 'Backpacker',
  relaxed: 'Relaxed traveler',
  cultural: 'Cultural explorer',
  budget: 'Budget traveler',
  adventure: 'Adventure traveler',
  party: 'Party traveler',
  foodie: 'Foodie traveler',
}

function hintText(styles: string[], country: string | null): string {
  const style = styles[0] ? (STYLE_LABELS[styles[0]] ?? 'Traveler') : 'Traveler'
  return country ? `${style} from ${country}` : style
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function BlurredAvatar({ photo, size = 44 }: { photo: string | null; size?: number }) {
  return (
    <div
      className="relative rounded-full overflow-hidden shrink-0"
      style={{ width: size, height: size, backgroundColor: '#1e1e1e' }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(9px)', transform: 'scale(1.3)' }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, #2a2a2a 0%, #161616 100%)' }} />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.38)' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width={size * 0.28} height={size * 0.28} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" fill="rgba(255,255,255,0.45)" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function Paywall({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
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
          style={{
            width: 72, height: 72,
            background: 'linear-gradient(145deg, rgba(240,235,227,0.14) 0%, rgba(240,235,227,0.04) 100%)',
            border: '0.5px solid rgba(240,235,227,0.22)',
          }}
        >
          <span style={{ fontSize: 34 }}>✦</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.14 }}
          className="font-bold tracking-widest mb-3"
          style={{ color: 'rgba(240,235,227,0.5)', fontSize: 11 }}
        >
          TRIPALONG PLUS
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.18 }}
          className="text-white font-extrabold tracking-tight mb-3"
          style={{ fontSize: 30, lineHeight: '34px', letterSpacing: '-0.8px' }}
        >
          {count} {count === 1 ? 'person wants' : 'people want'} to travel with you
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.24 }}
          className="mb-8"
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: '22px' }}
        >
          Unlock to see exactly who's interested in your profile
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.28 }}
          className="w-full flex flex-col gap-2.5 mb-8"
        >
          {[
            { icon: '👁', text: 'See who viewed your profile' },
            { icon: '🔖', text: 'See who saved your trips' },
            { icon: '✈️', text: 'Unlimited trip connections' },
            { icon: '⚡', text: 'Priority in travel matching' },
          ].map((f) => (
            <div
              key={f.text}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}
            >
              <span style={{ fontSize: 17 }}>{f.icon}</span>
              <span className="text-white font-medium flex-1" style={{ fontSize: 13 }}>{f.text}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="rgba(240,235,227,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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

export function ProfileViewsSheet({ onClose }: ProfileViewsSheetProps) {
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    getProfileViewers().then(v => { setViewers(v as Viewer[]); setLoading(false) })
  }, [])

  if (!mounted) return null

  const previewViewers = viewers.slice(0, 5)
  const remaining = Math.max(0, viewers.length - 5)
  const openPaywall = () => { haptic(10); setShowPaywall(true) }

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
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base truncate">Profile Views</h1>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: viewers.length > 0 && !loading ? 100 : 0 }}>

          {/* Count + blurred preview */}
          {!loading && viewers.length > 0 && (
            <div className="px-5 pt-6 pb-5">
              <p className="text-white font-extrabold tracking-tight mb-1" style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-0.6px' }}>
                {viewers.length}
              </p>
              <p className="mb-5" style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
                {viewers.length === 1 ? 'person checked out your profile' : 'people checked out your profile'}
              </p>

              {/* Blurred stacked circles */}
              <button
                onClick={openPaywall}
                className="flex items-center gap-0 active:opacity-75 transition-opacity"
              >
                <div className="flex -space-x-3">
                  {previewViewers.map((v, i) => (
                    <div
                      key={v.id}
                      className="relative rounded-full overflow-hidden"
                      style={{ width: 42, height: 42, zIndex: 10 - i, border: '2.5px solid #000', backgroundColor: '#1e1e1e' }}
                    >
                      {v.profile_photo ? (
                        <img
                          src={v.profile_photo}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ filter: 'blur(8px)', transform: 'scale(1.3)' }}
                        />
                      ) : (
                        <div className="absolute inset-0" style={{ background: '#2a2a2a' }} />
                      )}
                      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.28)' }} />
                    </div>
                  ))}
                </div>
                {remaining > 0 && (
                  <span className="ml-3 font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    +{remaining} more
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Divider */}
          {!loading && viewers.length > 0 && (
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 text-center gap-4" style={{ paddingTop: 80 }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>No views yet</p>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  When someone views your profile, they'll show up here
                </p>
              </div>
            </div>
          ) : (
            viewers.map((viewer) => (
              <button
                key={viewer.id}
                onClick={openPaywall}
                className="w-full flex items-center gap-3.5 px-5 py-4 text-left active:bg-white/4 transition-colors border-b"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <BlurredAvatar photo={viewer.profile_photo} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-0.5 tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    ● ● ● ● ● ●
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>
                    {hintText(viewer.travel_styles, viewer.country)} · {timeAgo(viewer.viewed_at)}
                  </p>
                </div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" fill="rgba(255,255,255,0.18)" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="rgba(255,255,255,0.32)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Sticky bottom CTA */}
        {!loading && viewers.length > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 px-4"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
              paddingTop: 20,
              background: 'linear-gradient(to bottom, transparent 0%, #000 28%)',
            }}
          >
            <button
              onClick={openPaywall}
              className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
              style={{ backgroundColor: '#F0EBE3', color: '#000' }}
            >
              ✦ Unlock Profile Views
            </button>
            <p className="text-center mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              See exactly who's interested in traveling with you
            </p>
          </div>
        )}
      </motion.div>

      {/* Paywall on top */}
      <AnimatePresence>
        {showPaywall && (
          <Paywall count={viewers.length} onClose={() => setShowPaywall(false)} />
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
