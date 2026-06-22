'use client'

import { motion } from 'framer-motion'
import { getTabDir } from '@/lib/tab-direction'

// In the native WebView the user agent is "TripAlong/1.0 (Mobile)".
// The slide+fade transition starts at opacity:0, which flashes the black
// native background on every navigation. Skip animation in the native app.
const isNativeApp =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('TripAlong')

export default function Template({ children }: { children: React.ReactNode }) {
  const dir = getTabDir()
  return (
    <motion.div
      initial={isNativeApp ? false : { x: dir * 28, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      {children}
    </motion.div>
  )
}
