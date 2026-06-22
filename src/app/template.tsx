'use client'

import { motion } from 'framer-motion'
import { getTabDir } from '@/lib/tab-direction'

const isNativeApp =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('TripAlong')

export default function Template({ children }: { children: React.ReactNode }) {
  // In the native WebView, this wrapper starts at opacity:0 on every navigation,
  // making the entire page invisible and flashing the black native background.
  // Skip the animation entirely in the app — the web browser keeps it.
  if (isNativeApp) return <>{children}</>

  const dir = getTabDir()
  return (
    <motion.div
      initial={{ x: dir * 28, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      {children}
    </motion.div>
  )
}
