'use client'

import { usePathname, useRouter } from 'next/navigation'

// Paths where the button would be redundant or intrusive
const HIDDEN_PATHS = ['/beta-feedback', '/early-access', '/login', '/onboarding', '/', '/privacy', '/terms', '/faq']

export function BetaFeedbackButton() {
  const pathname = usePathname()
  const router = useRouter()

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <button
      onClick={() => router.push('/beta-feedback')}
      style={{
        position: 'fixed',
        // Sits just above the bottom tab bar (74px) with a small gap
        bottom: 'calc(74px + env(safe-area-inset-bottom) + 28px)',
        right: 16,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 14px',
        borderRadius: 20,
        background: 'rgba(30,30,30,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}
    >
      <span style={{ fontSize: 14 }}>🧪</span>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.3px' }}>Beta Feedback</span>
    </button>
  )
}
