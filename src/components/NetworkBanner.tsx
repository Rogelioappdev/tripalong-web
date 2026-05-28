'use client'

import { useNetworkStatus } from '@/lib/network'

export function NetworkBanner() {
  const status = useNetworkStatus()
  const visible = status === 'offline' || status === 'reconnected'

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: 'env(safe-area-inset-top)',
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Offline */}
      <div
        style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top)',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: '#1C1C1E',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          opacity: status === 'offline' ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: status === 'offline' ? 'auto' : 'none',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke="#FF9F0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ color: '#FF9F0A', fontSize: 13, fontWeight: 600 }}>No internet connection</span>
      </div>

      {/* Back online */}
      <div
        style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top)',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: '#1C1C1E',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          opacity: status === 'reconnected' ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: status === 'reconnected' ? 'auto' : 'none',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#30D158', flexShrink: 0 }} />
        <span style={{ color: '#30D158', fontSize: 13, fontWeight: 600 }}>Back online</span>
      </div>
    </div>
  )
}
