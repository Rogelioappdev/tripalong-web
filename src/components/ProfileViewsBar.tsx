'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { getMyViewerCount } from '@/lib/queries'

interface Props {
  isPlus: boolean
  onOpen: () => void
}

// Same threshold the rest of the app uses for the who-viewed reveal
// (PlusWelcomeFlow gates on viewers.length >= 3). Below it there's nothing
// worth showing, and a "0 people viewed you" row would be actively
// discouraging on the app's primary screen.
const MIN_VIEWERS = 3

// Silhouettes, not faces. getProfileViewers is Plus-gated server-side, so a
// free user's real viewers genuinely aren't available here — and inventing
// avatars, or reusing unrelated users' photos, would be a lie. Abstract
// shapes still carry the "these are people" read that makes the curiosity
// gap work, without fabricating anyone.
function ViewerSilhouettes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 30, height: 30, borderRadius: 15,
            marginLeft: i === 0 ? 0 : -11,
            background: `linear-gradient(145deg, rgba(240,235,227,${0.24 - i * 0.05}), rgba(240,235,227,${0.10 - i * 0.02}))`,
            border: '1.5px solid #0d0d0d',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 3 - i,
          }}
        >
          {/* head + shoulders, deliberately vague */}
          <svg width="30" height="30" viewBox="0 0 30 30" style={{ opacity: 0.55 }}>
            <circle cx="15" cy="11" r="5" fill="rgba(255,255,255,0.55)" />
            <ellipse cx="15" cy="26" rx="9" ry="7" fill="rgba(255,255,255,0.45)" />
          </svg>
        </div>
      ))}
    </div>
  )
}

export function ProfileViewsBar({ isPlus, onOpen }: Props) {
  const { data: count = 0 } = useQuery({
    queryKey: ['viewerCount'],
    queryFn: getMyViewerCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // One impression event per mount once the bar actually qualifies — this is
  // the denominator the whole feature has been missing (2 conversions ever,
  // against an unknown number of people who saw the entry point).
  const shownRef = useRef(false)
  useEffect(() => {
    if (count < MIN_VIEWERS || shownRef.current) return
    shownRef.current = true
    track('profile_views_bar_shown', { viewer_count: count, is_plus: isPlus })
  }, [count, isPlus])

  if (count < MIN_VIEWERS) return null

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={() => {
        haptic(8)
        track('profile_views_opened', { viewer_count: count, source: 'feed_bar', is_plus: isPlus })
        onOpen()
      }}
      className="w-full flex items-center gap-3 active:opacity-70 transition-opacity"
      style={{
        marginTop: 2, marginBottom: 8,
        padding: '9px 12px',
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '0.5px solid rgba(255,255,255,0.09)',
        textAlign: 'left',
      }}
    >
      <ViewerSilhouettes />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>
          {count} {count === 1 ? 'traveler' : 'travelers'} viewed your profile
        </p>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.5, marginTop: 1 }}>
          {isPlus ? 'Tap to see who' : 'See who they are'}
        </p>
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}
