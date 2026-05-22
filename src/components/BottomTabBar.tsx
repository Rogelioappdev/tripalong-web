'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const HIDE_ON = ['/', '/onboarding', '/travel-dna']

export function BottomTabBar() {
  const pathname = usePathname()
  const isOnFeed = pathname === '/feed'
  const [revealed, setRevealed] = useState(false)

  // Auto-hide when returning to feed
  useEffect(() => {
    if (isOnFeed) setRevealed(false)
    else setRevealed(true)
  }, [isOnFeed])

  if (HIDE_ON.some(p => pathname === p) || pathname.startsWith('/auth')) return null

  const tabs = [
    {
      href: '/messages',
      label: 'Messages',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke={active ? '#fff' : 'rgba(255,255,255,0.38)'} strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      href: '/feed',
      label: 'TripAlong',
      isCenter: true,
      icon: (active: boolean) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/tagalong-icon.png"
          alt="TripAlong"
          width={40}
          height={40}
          style={{ opacity: active ? 1 : 0.38, objectFit: 'contain' }}
        />
      ),
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={active ? '#fff' : 'rgba(255,255,255,0.38)'} strokeWidth="1.8"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#fff' : 'rgba(255,255,255,0.38)'} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col items-center pb-6">
      {/* Chevron handle — only visible on feed when tab bar is hidden */}
      <AnimatePresence>
        {isOnFeed && !revealed && (
          <motion.button
            key="chevron"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => setRevealed(true)}
            className="mb-2 w-11 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 15l-6-6-6 6" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating pill tab bar */}
      <motion.div
        initial={false}
        animate={{
          y: isOnFeed && !revealed ? 92 : 0,
          opacity: isOnFeed && !revealed ? 0 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-center mx-3 px-2"
        style={{
          backgroundColor: '#050505',
          borderRadius: 36,
          height: 66,
          width: 'calc(100% - 24px)',
          border: '0.5px solid rgba(255,255,255,0.07)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
        }}
      >
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2"
              onClick={() => { if (tab.href === '/feed') setRevealed(false) }}
            >
              <div className="flex items-center justify-center" style={{ height: tab.isCenter ? 44 : 26 }}>
                {tab.icon(active)}
              </div>
              <span className="text-[10px] font-semibold tracking-wide"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.38)' }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </motion.div>
    </div>
  )
}
