'use client'

import { motion } from 'framer-motion'
import { getTabDir } from '@/lib/tab-direction'

const isNativeApp =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('TripAlong')

export default function Template({ children }: { children: React.ReactNode }) {
  const dir = getTabDir()

  // No animation for direct navigation (non-tab-switch)
  if (dir === 0) return <>{children}</>

  return (
    <motion.div
      // Native: no opacity change (avoids black flash through WebView background)
      initial={{ x: dir * 24, opacity: isNativeApp ? 1 : 0.85 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      {children}
    </motion.div>
  )
}
