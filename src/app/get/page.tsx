'use client'

import { useRouter } from 'next/navigation'

const APP_STORE = 'https://apps.apple.com/us/app/tagalong-find-trips-together/id6758787857'
const ANDROID_EARLY = 'https://tripalong-web.vercel.app/'

const TRIPS = [
  { dest: 'Tokyo', country: 'japan', dates: 'Jul 12 – Jul 22', color: '#1a1210', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { dest: 'Bali', country: 'indonesia', dates: 'Aug 3 – Aug 14', color: '#0d1a12', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { dest: 'Paris', country: 'france', dates: 'Sep 5 – Sep 12', color: '#12111a', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
]

function PhoneMockup() {
  return (
    <div style={{
      width: 240,
      height: 490,
      background: '#111',
      borderRadius: 44,
      border: '7px solid #2a2a2a',
      boxShadow: '0 0 0 1px #333, 0 40px 100px rgba(0,0,0,0.9), 0 0 60px rgba(240,235,227,0.04)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Dynamic island */}
      <div style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        width: 90, height: 24, background: '#000', borderRadius: 14, zIndex: 20,
      }} />

      {/* App content */}
      <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column' }}>

        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '44px 16px 0', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>9:41</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <svg width="14" height="10" viewBox="0 0 24 16" fill="white" opacity={0.9}><rect x="0" y="5" width="4" height="11" rx="1"/><rect x="6" y="3" width="4" height="13" rx="1"/><rect x="12" y="0" width="4" height="16" rx="1"/><rect x="18" y="2" width="5" height="12" rx="1" opacity={0.4}/></svg>
            <svg width="13" height="10" viewBox="0 0 24 18" fill="white" opacity={0.9}><path d="M12 4C8.5 4 5.3 5.4 3 7.7L0 4.7C3.1 1.8 7.3 0 12 0s8.9 1.8 12 4.7l-3 3C18.7 5.4 15.5 4 12 4zm0 7c-1.7 0-3.2.7-4.3 1.8L4.9 10C6.5 8.5 9.1 7.5 12 7.5s5.5 1 7.1 2.5L16.3 12.8C15.2 11.7 13.7 11 12 11zm0 6.5c-1 0-1.9.4-2.5 1L12 21l2.5-2.5c-.6-.6-1.5-1-2.5-1z"/></svg>
            <svg width="22" height="10" viewBox="0 0 40 18" fill="none"><rect x="0" y="1" width="35" height="16" rx="4" stroke="white" strokeWidth="1.5" opacity={0.9}/><rect x="36" y="5" width="4" height="8" rx="2" fill="white" opacity={0.5}/><rect x="1.5" y="2.5" width="28" height="13" rx="2.5" fill="white" opacity={0.9}/></svg>
          </div>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 6px', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>TripAlong</span>
          <div style={{
            background: 'rgba(240,235,227,0.9)', borderRadius: 14,
            padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#000',
          }}>+ Create Trip</div>
        </div>

        {/* Trip card */}
        <div style={{ flex: 1, padding: '0 10px 8px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
            <img
              src={TRIPS[0].img}
              alt="Tokyo"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 25%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.97) 100%)',
            }} />

            {/* Match badge */}
            <div style={{
              position: 'absolute', bottom: 68, left: 12,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: '#30D158' }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 600 }}>2 matches</span>
            </div>

            {/* Trip info */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 12px 14px' }}>
              <p style={{ color: 'rgba(240,235,227,0.55)', fontSize: 9, margin: '0 0 2px' }}>📍 japan</p>
              <h3 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 3px', letterSpacing: '-0.3px' }}>Tokyo</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 7px' }}>Jul 12 – Jul 22</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {['Cultural', 'Foodie'].map(v => (
                  <span key={v} style={{
                    fontSize: 8, borderRadius: 10, padding: '2px 7px', fontWeight: 600,
                    background: 'rgba(240,235,227,0.1)', border: '0.5px solid rgba(240,235,227,0.2)',
                    color: '#F0EBE3',
                  }}>{v}</span>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 12px 42px',
              display: 'flex', justifyContent: 'center', gap: 14,
            }}>
              {/* Pass */}
              <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#FF453A', fontSize: 14, fontWeight: 700 }}>✕</span>
              </div>
              {/* Join */}
              <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#30D158', fontSize: 17, fontWeight: 700 }}>✓</span>
              </div>
              {/* Save */}
              <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>🔖</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          margin: '0 8px 10px',
          background: '#0a0a0a',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 26, height: 48,
          display: 'flex', alignItems: 'center',
          flexShrink: 0,
        }}>
          {[
            { icon: '💬', label: 'Messages', active: false },
            { icon: '✈️', label: 'TripAlong', active: true },
            { icon: '👤', label: 'Profile', active: false },
          ].map(tab => (
            <div key={tab.label} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <span style={{ fontSize: tab.active ? 16 : 12, opacity: tab.active ? 1 : 0.3 }}>{tab.icon}</span>
              <span style={{ fontSize: 7, fontWeight: 600, color: tab.active ? '#fff' : 'rgba(255,255,255,0.3)' }}>{tab.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GetPage() {
  return (
    <main style={{
      background: '#000', minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '0 24px',
      paddingTop: 'calc(env(safe-area-inset-top) + 28px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Glow background */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(240,235,227,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 28, alignSelf: 'flex-start' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.3px' }}>TripAlong</span>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, marginBottom: 36 }}>
        <h1 style={{
          color: '#fff', fontSize: 'clamp(32px, 9vw, 52px)',
          fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px',
          margin: '0 0 14px',
        }}>
          Travel together.<br />
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>Not alone.</span>
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.38)', fontSize: 15, lineHeight: 1.6,
          maxWidth: 300, margin: '0 auto',
        }}>
          Swipe on trips, join a crew, and explore the world with people who get it.
        </p>
      </div>

      {/* Phone mockup */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 40 }}>
        <PhoneMockup />

        {/* Floating chips around phone */}
        <div style={{
          position: 'absolute', top: 60, right: -70,
          background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '7px 12px',
          display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: '#30D158' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Live now</span>
        </div>

        <div style={{
          position: 'absolute', bottom: 120, left: -75,
          background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '7px 12px',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>✈️ 3k+ trips</span>
        </div>
      </div>

      {/* Download buttons */}
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>

        {/* Apple */}
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '16px 0', borderRadius: 18,
            background: '#F0EBE3', color: '#000',
            textDecoration: 'none', fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 24px rgba(240,235,227,0.12)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Download on the App Store
        </a>

        {/* Android */}
        <a
          href={ANDROID_EARLY}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '16px 0', borderRadius: 18,
            background: 'rgba(255,255,255,0.07)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            color: '#fff',
            textDecoration: 'none', fontWeight: 700, fontSize: 16,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.523 15.341l-.002-.002-2.136-3.7 2.136-3.699a.5.5 0 00-.048-.563.506.506 0 00-.554-.133l-8.944 3.562a.5.5 0 000 .928l8.944 3.563a.506.506 0 00.554-.133.5.5 0 00.05-.823zM3.5 12A8.5 8.5 0 1112 3.5 8.51 8.51 0 013.5 12zm17 0A8.5 8.5 0 1112 3.5 8.51 8.51 0 0120.5 12z"/>
          </svg>
          Get Early Access on Android
        </a>

      </div>

      {/* Social proof */}
      <p style={{
        color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 24,
        position: 'relative', zIndex: 1, textAlign: 'center',
      }}>
        3,000+ travelers already planning their next trip
      </p>

    </main>
  )
}
