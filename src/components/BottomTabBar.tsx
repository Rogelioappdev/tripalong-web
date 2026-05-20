'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/feed',
    label: 'Explore',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={active ? '#F0EBE3' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8"/>
        <path d="M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5L12 7z" fill={active ? '#F0EBE3' : 'rgba(255,255,255,0.4)'}/>
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={active ? '#F0EBE3' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={active ? '#F0EBE3' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#F0EBE3' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const HIDE_ON = ['/', '/onboarding', '/travel-dna', '/auth']

export function BottomTabBar() {
  const pathname = usePathname()

  // Hide on auth/onboarding pages and inside DM/chat (those have back buttons)
  if (HIDE_ON.some(p => pathname === p) || pathname.startsWith('/auth')) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/90 backdrop-blur-xl border-t border-white/8">
      <div className="flex items-center justify-around px-2 pb-safe">
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-1 py-3 px-6 min-w-0"
            >
              {tab.icon(active)}
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: active ? '#F0EBE3' : 'rgba(255,255,255,0.4)' }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
