'use client'

const APP_STORE = 'https://apps.apple.com/us/app/tagalong-find-trips-together/id6758787857'
const ANDROID_URL = 'https://tripalong-web.vercel.app/'

function PhoneMockup() {
  // SVG coordinate space matches iPhone 15 Pro points: 393 × 852
  // Outer corner radius: 47  |  Screen inset: 9px  |  Screen corner radius: 40
  const OUTER = 'M47,0 L346,0 A47,47 0 0 1 393,47 L393,805 A47,47 0 0 1 346,852 L47,852 A47,47 0 0 1 0,805 L0,47 A47,47 0 0 1 47,0 Z'
  const SCREEN = 'M49,9 L344,9 A40,40 0 0 1 384,49 L384,803 A40,40 0 0 1 344,843 L49,843 A40,40 0 0 1 9,803 L9,49 A40,40 0 0 1 49,9 Z'

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Floating chip — right — z-index 1 so phone sits in front of it */}
      <div style={{
        position: 'absolute', top: '22%', right: 10,
        background: 'rgba(14,14,14,0.92)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        zIndex: 1,
      }}>
        <span style={{ color: '#30D158', fontSize: 12, fontWeight: 800 }}>88%</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>travel style match</span>
      </div>

      {/* Floating chip — left — z-index 1 so phone sits in front of it */}
      <div style={{
        position: 'absolute', bottom: '28%', left: 10,
        background: 'rgba(14,14,14,0.92)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '7px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        zIndex: 1,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>✈️  3,200+ trips</span>
      </div>

      {/* Phone wrapper — z-index 2 so it overlaps the chips (chips float behind) */}
      <div style={{
        height: '100%',
        maxHeight: 500,
        aspectRatio: '393 / 852',
        position: 'relative',
        flexShrink: 0,
        zIndex: 2,
        filter: [
          'drop-shadow(0 30px 24px rgba(0,0,0,0.85))',
          'drop-shadow(0 10px 10px rgba(0,0,0,0.6))',
          'drop-shadow(0 0 1px rgba(255,255,255,0.12))',
        ].join(' '),
      }}>

        {/* Screenshot clipped to screen area */}
        <div style={{
          position: 'absolute',
          // Inset matches the 9pt screen margin in SVG coordinate space
          // 9/393 = 2.29% horizontal, 9/852 = 1.056% vertical
          top: '1.06%', left: '2.29%',
          width: '95.42%', height: '97.89%',
          borderRadius: '10.2%', // 40/393 ≈ 10.2%
          overflow: 'hidden',
          background: '#000',
        }}>
          <img
            src="/screenshots/app-feed.jpg"
            alt="TripAlong app"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
          />
          {/* Subtle glass sheen */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 45%)',
          }} />
        </div>

        {/* SVG frame — exact iPhone 15 Pro geometry */}
        <svg
          viewBox="0 0 393 852"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Natural Titanium: lighter at edges where light catches the chamfer */}
            <linearGradient id="g-titanium" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#6e6e70" />
              <stop offset="15%"  stopColor="#5a5a5c" />
              <stop offset="40%"  stopColor="#3d3d3f" />
              <stop offset="70%"  stopColor="#2c2c2e" />
              <stop offset="100%" stopColor="#1c1c1e" />
            </linearGradient>
            {/* Edge highlight — simulates the chamfered/polished rim */}
            <linearGradient id="g-edge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
              <stop offset="8%"   stopColor="rgba(255,255,255,0.04)" />
              <stop offset="92%"  stopColor="rgba(255,255,255,0.04)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.14)" />
            </linearGradient>
            <linearGradient id="g-edge-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.14)" />
              <stop offset="6%"   stopColor="rgba(255,255,255,0.02)" />
              <stop offset="94%"  stopColor="rgba(255,255,255,0.01)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
          </defs>

          {/* ── Main titanium frame (outer - screen cutout) ── */}
          <path fillRule="evenodd" fill="url(#g-titanium)" d={`${OUTER} ${SCREEN}`} />

          {/* ── Edge highlight passes ── */}
          <path fillRule="evenodd" fill="url(#g-edge)"   d={`${OUTER} ${SCREEN}`} opacity="0.6" />
          <path fillRule="evenodd" fill="url(#g-edge-v)" d={`${OUTER} ${SCREEN}`} opacity="0.5" />

          {/* ── Screen inner border — subtle depth shadow ── */}
          <path fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" d={SCREEN} />
          <path fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" d={SCREEN} />

          {/* ── Dynamic island ── */}
          <rect x="131.5" y="24" width="130" height="37" rx="18.5" fill="#000" />

          {/* ── Action button (top-left) ── */}
          <rect x="-4" y="108" width="4" height="40" rx="2" fill="#3d3d3f" />
          {/* ── Volume up ── */}
          <rect x="-4" y="166" width="4" height="72" rx="2" fill="#3d3d3f" />
          {/* ── Volume down ── */}
          <rect x="-4" y="256" width="4" height="72" rx="2" fill="#3d3d3f" />
          {/* ── Power / side button ── */}
          <rect x="393" y="222" width="4" height="90" rx="2" fill="#3d3d3f" />

          {/* ── Home indicator ── */}
          <rect x="146" y="822" width="101" height="5" rx="2.5" fill="rgba(255,255,255,0.22)" />
        </svg>
      </div>
    </div>
  )
}

export default function GetPage() {
  return (
    <main style={{
      background: '#000',
      height: '100dvh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 22px',
      paddingTop: 'calc(env(safe-area-inset-top) + 18px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
      position: 'relative',
    }}>

      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(240,235,227,0.035) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Logo ── */}
      <div style={{ flexShrink: 0, marginBottom: 14 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-0.3px' }}>TripAlong</span>
      </div>

      {/* ── Headline ── */}
      <div style={{ flexShrink: 0, marginBottom: 14 }}>
        <h1 style={{
          color: '#fff',
          fontSize: 'clamp(28px, 8vw, 40px)',
          fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.8px',
          margin: '0 0 8px',
        }}>
          Travel together.<br />
          <span style={{ color: 'rgba(255,255,255,0.28)' }}>Not alone.</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.36)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Swipe on trips. Meet your crew. Go.
        </p>
      </div>

      {/* ── Phone mockup ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <PhoneMockup />
      </div>

      {/* ── Download buttons ── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, position: 'relative', zIndex: 10 }}>

        {/* iOS */}
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            padding: '14px 0', borderRadius: 16,
            background: '#F0EBE3', color: '#000',
            textDecoration: 'none', fontWeight: 700, fontSize: 15,
            boxShadow: '0 2px 20px rgba(240,235,227,0.1)',
            letterSpacing: '-0.1px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          Download on the App Store
        </a>

        {/* Android */}
        <div>
          <a
            href={ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              padding: '14px 0', borderRadius: 16,
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              color: '#fff',
              textDecoration: 'none', fontWeight: 700, fontSize: 15,
              letterSpacing: '-0.1px',
            }}
          >
            {/* Android robot logo */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm-2.5-1C2.67 17 2 17.67 2 18.5v5c0 .83.67 1.5 1.5 1.5S5 24.33 5 23.5v-5C5 17.67 4.33 17 3.5 17zm17 0c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5zM15.53 2.16l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 0 0 6 7h12a5.98 5.98 0 0 0-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
            </svg>
            Download on Android
          </a>
          <p style={{
            color: 'rgba(255,255,255,0.22)', fontSize: 11, textAlign: 'center',
            margin: '7px 0 0', fontWeight: 500,
          }}>
            Web version only available for Android for now
          </p>
        </div>

      </div>

      {/* Social proof */}
      <p style={{
        color: 'rgba(255,255,255,0.16)', fontSize: 11, textAlign: 'center',
        margin: '12px 0 0', flexShrink: 0, position: 'relative', zIndex: 10,
      }}>
        3,200+ travelers already planning their next trip
      </p>

    </main>
  )
}
