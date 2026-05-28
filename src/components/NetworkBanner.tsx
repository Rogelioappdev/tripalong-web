'use client'

import { useNetworkStatus } from '@/lib/network'

export function NetworkBanner() {
  const status = useNetworkStatus()
  const visible = status === 'offline' || status === 'reconnected'
  const isOffline = status === 'offline'

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
        transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 16px',
        backgroundColor: '#1C1C1E',
        borderBottom: '0.5px solid rgba(255,255,255,0.1)',
      }}>
        {isOffline ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"
                stroke="#FF9F0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: '#FF9F0A', fontSize: 13, fontWeight: 600, letterSpacing: '-0.1px' }}>
              No internet connection
            </span>
          </>
        ) : (
          <>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#30D158', flexShrink: 0 }} />
            <span style={{ color: '#30D158', fontSize: 13, fontWeight: 600, letterSpacing: '-0.1px' }}>
              Back online
            </span>
          </>
        )}
      </div>
    </div>
  )
}
