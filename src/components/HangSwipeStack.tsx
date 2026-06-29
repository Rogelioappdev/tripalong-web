'use client'

import { useState, useRef } from 'react'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { joinHangalong, getUserJoinedHangalongIds, markHangalongSeen } from '@/lib/queries'
import { HangCard, type HangCardHandle } from './HangCard'
import type { HangalongWithDetails } from '@/lib/types'

interface HangSwipeStackProps {
  hangalongs: HangalongWithDetails[]
  userId: string | null
  onHangTap: (hang: HangalongWithDetails) => void
  onJoin?: (hang: HangalongWithDetails) => void
  onAuthRequired?: () => void
  joinedIds: Set<string>
  onJoinedIdsChange: (ids: Set<string>) => void
}

export function HangSwipeStack({
  hangalongs,
  userId,
  onHangTap,
  onJoin,
  onAuthRequired,
  joinedIds,
  onJoinedIdsChange,
}: HangSwipeStackProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const sharedX = useMotionValue(0)
  const cardRef = useRef<HangCardHandle>(null)

  const visible = hangalongs.filter(h => !dismissed.has(h.id))
  const top = visible[0]
  const second = visible[1]

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
    sharedX.set(0)
    // Persist so card never reappears across sessions
    markHangalongSeen(id).catch(() => {})
  }

  async function handleSwipeRight(hang: HangalongWithDetails) {
    if (!userId) { onAuthRequired?.(); return }
    if (!joinedIds.has(hang.id)) {
      const ok = await joinHangalong(hang.id, userId)
      if (ok) {
        const next = new Set(joinedIds)
        next.add(hang.id)
        onJoinedIdsChange(next)
        onJoin?.(hang)
        haptic(20)
      }
    }
    dismiss(hang.id)
  }

  function handleSwipeLeft(id: string) {
    haptic(6)
    dismiss(id)
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Card stack */}
      <div className="relative flex-1 min-h-0">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <span style={{ fontSize: 48 }}>🌄</span>
            <p className="text-white font-bold text-xl">You're all caught up</p>
            <p className="text-white/40 text-sm">No more hangalongs right now. Check back soon or post your own.</p>
          </div>
        ) : (
          <>
            {second && (
              <HangCard
                key={second.id}
                hang={second}
                isTop={false}
                isJoined={joinedIds.has(second.id)}
                onSwipeLeft={() => handleSwipeLeft(second.id)}
                onSwipeRight={() => handleSwipeRight(second)}
                onTap={() => {}}
                sharedX={sharedX}
              />
            )}
            <AnimatePresence>
              {top && (
                <HangCard
                  key={top.id}
                  ref={cardRef}
                  hang={top}
                  isTop
                  isJoined={joinedIds.has(top.id)}
                  onSwipeLeft={() => handleSwipeLeft(top.id)}
                  onSwipeRight={() => handleSwipeRight(top)}
                  onTap={() => onHangTap(top)}
                  sharedX={sharedX}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Action buttons — in normal flow, always visible above tab bar */}
      {top && (
        <div className="flex items-center justify-center gap-6 shrink-0 py-5">
          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={() => { haptic(6); cardRef.current?.swipeLeft() }}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={() => { haptic(14); cardRef.current?.swipeRight() }}
            className="h-14 px-7 rounded-full flex items-center gap-2 font-bold text-sm"
            style={{ backgroundColor: '#4ade80', color: '#000' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            I'm In
          </motion.button>
        </div>
      )}
    </div>
  )
}
