'use client'

import { useMotionValue, useTransform, useDragControls, animate } from 'framer-motion'
import type { DragHandlers } from 'framer-motion'

export function useDismissibleSheet(onClose: () => void) {
  const y = useMotionValue(0)
  const backdropOpacity = useTransform(y, [0, 280], [1, 0])
  const dragControls = useDragControls()

  const handleDragEnd: DragHandlers['onDragEnd'] = (_, info) => {
    if (info.offset.y > 80 || info.velocity.y > 500) {
      animate(y, typeof window !== 'undefined' ? window.innerHeight : 900, {
        type: 'spring', stiffness: 300, damping: 28,
        onComplete: onClose,
      })
    } else {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  const startDrag = (e: React.PointerEvent) => {
    dragControls.start(e)
    e.stopPropagation()
  }

  return { y, backdropOpacity, dragControls, handleDragEnd, startDrag }
}
