'use client'

import { useEffect, useRef } from 'react'

const EDGE_WIDTH = 24
const DISTANCE_THRESHOLD = 70
const VERTICAL_TOLERANCE = 60
const ANGLE_SLOP = 0.5

// Shared left-edge swipe-back gesture for full-screen stacked routes (chat,
// DM) that have no native swipe-back in the browser/WebView. A touch starting
// within EDGE_WIDTH px of the left edge that then drags right past
// DISTANCE_THRESHOLD fires onBack. Touches starting anywhere else on screen
// are ignored, so normal vertical scroll and message interactions are
// unaffected. Pass `enabled={false}` while a sheet/modal is on top so the
// gesture doesn't navigate the whole screen away underneath it.
export function useSwipeBack(onBack: () => void, enabled = true) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  useEffect(() => {
    if (!enabled) return
    let startX = 0
    let startY = 0
    let tracking = false
    let fired = false

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      tracking = t.clientX <= EDGE_WIDTH
      fired = false
      startX = t.clientX
      startY = t.clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || fired) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dx > DISTANCE_THRESHOLD && dy < VERTICAL_TOLERANCE + dx * ANGLE_SLOP) {
        fired = true
        tracking = false
        onBackRef.current()
      }
    }

    const onTouchEnd = () => { tracking = false }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled])
}
