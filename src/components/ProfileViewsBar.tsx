'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { getMyViewerCount, getProfileViewers } from '@/lib/queries'

interface Props {
  isPlus: boolean
  onOpen: () => void
}

// Same threshold the rest of the app uses for the who-viewed reveal
// (PlusWelcomeFlow gates on viewers.length >= 3). Below it there's nothing
// worth showing, and a "0 people viewed you" row would be actively
// discouraging on the app's primary screen.
const MIN_VIEWERS = 3

// Real viewers, blurred for free users. The `get_my_viewers` RPC deliberately
// returns profile_photo to non-Plus callers (with first-name-only and
// styles/country nulled, and a `-- blurred client-side` comment) precisely so
// this can be shown — the identity is what the paywall sells, not the
// existence of viewers. Plus users see them sharp, which is the reward.
// Falls back to a silhouette per-viewer when someone has no photo.
function ViewerAvatars({ photos, isPlus }: { photos: (string | null)[]; isPlus: boolean }) {
  const slots = photos.length ? photos.slice(0, 3) : [null, null, null]
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {slots.map((photo, i) => (
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
          {photo ? (
            <img
              src={photo}
              alt=""
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                // Lighter than the sheet's blur(5px): these circles are 30px,
                // where 5px would erase the face into a flat smudge. 3px keeps
                // the hint of a person, which is the whole mechanic.
                filter: isPlus ? undefined : 'blur(3px) brightness(0.85)',
                transform: isPlus ? undefined : 'scale(1.25)',
              }}
            />
          ) : (
            <svg width="30" height="30" viewBox="0 0 30 30" style={{ opacity: 0.55 }}>
              <circle cx="15" cy="11" r="5" fill="rgba(255,255,255,0.55)" />
              <ellipse cx="15" cy="26" rx="9" ry="7" fill="rgba(255,255,255,0.45)" />
            </svg>
          )}
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

  // Only the newest three — this is a teaser, and the sheet is where the full
  // list lives. Skipped entirely below the threshold so we don't fetch viewer
  // data for a bar that won't render.
  const { data: viewers = [] } = useQuery({
    queryKey: ['viewerPreview'],
    queryFn: () => getProfileViewers(3),
    enabled: count >= MIN_VIEWERS,
    staleTime: 60_000,
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
      <ViewerAvatars photos={viewers.map(v => v.profile_photo)} isPlus={isPlus} />

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
