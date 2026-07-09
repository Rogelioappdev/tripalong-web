'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getUnreadCount } from '@/lib/queries'
import { setTabDir } from '@/lib/tab-direction'
import { haptic } from '@/lib/haptics'

const HIDE_ON = ['/', '/onboarding', '/travel-dna', '/terms', '/privacy', '/faq', '/report-bug', '/notify-confirmed', '/get']

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const { data: unread = 0 } = useQuery({
    queryKey: ['unreadCount', userId],
    queryFn: getUnreadCount,
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  if (HIDE_ON.some(p => pathname === p) || pathname.startsWith('/auth')) return null

  const tabs = [
    {
      href: '/messages',
      label: 'Messages',
      showBadge: unread > 0,
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
          width={34}
          height={34}
          style={{ opacity: active ? 1 : 0.38, objectFit: 'contain' }}
        />
      ),
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={active ? '#fff' : 'rgba(255,255,255,0.38)'} strokeWidth="1.8"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#fff' : 'rgba(255,255,255,0.38)'} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="fixed z-50 md:hidden"
      style={{ bottom: 16, left: 12, right: 12 }}
    >
      <div
        className="flex items-center"
        style={{
          backgroundColor: '#080808',
          borderRadius: 32,
          height: 58,
          border: '0.5px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
        }}
      >
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <motion.button
              key={tab.href}
              type="button"
              onClick={() => {
                if (!active) {
                  haptic(8)
                  setTabDir(pathname, tab.href)
                  router.push(tab.href)
                }
              }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            >
              <div className="relative flex items-center justify-center" style={{ height: tab.isCenter ? 38 : 22 }}>
                {tab.icon(active)}
                {tab.showBadge && (
                  <span
                    className="absolute top-0 right-0 block rounded-full"
                    style={{ width: 8, height: 8, backgroundColor: '#F0EBE3', transform: 'translate(2px, -2px)' }}
                  />
                )}
              </div>
              <span
                className="text-[9px] font-semibold tracking-wide"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.35)' }}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
