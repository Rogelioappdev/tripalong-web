'use client'

import { useEffect, type RefObject } from 'react'

const DISTANCE_THRESHOLD = 70
const AXIS_DOMINANCE = 1.4

// Shared swipe-down-to-dismiss gesture for modals/sheets (profile view, trip
// detail, paywalls). Scoped to a ref — attach it to a non-scrolling region
// (a hero image, a header/top bar) so it never fights a scrollable body or a
// horizontal swipe (e.g. a photo carousel) living in the same area: it only
// fires for a gesture that's clearly more vertical than horizontal.
export function useSwipeDownDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false
    let fired = false

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      tracking = true
      fired = false
      startX = t.clientX
      startY = t.clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || fired) return
      const t = e.touches[0]
      if (!t) return
      const dy = t.clientY - startY
      const dx = Math.abs(t.clientX - startX)
      if (dy > DISTANCE_THRESHOLD && dy > dx * AXIS_DOMINANCE) {
        fired = true
        tracking = false
        onDismiss()
      }
    }

    const onTouchEnd = () => { tracking = false }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [ref, onDismiss, enabled])
}
