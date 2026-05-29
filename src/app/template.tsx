'use client'

import { motion } from 'framer-motion'
import { getTabDir } from '@/lib/tab-direction'

export default function Template({ children }: { children: React.ReactNode }) {
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
