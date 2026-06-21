'use client'

const APP_STORE = 'https://apps.apple.com/us/app/tagalong-find-trips-together/id6758787857'
const ANDROID_URL = 'https://tripalong-web.vercel.app/'

function PhoneMockup() {
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Floating chip — right */}
      <div style={{
        position: 'absolute', top: '20%', right: 0,
        background: 'rgba(14,14,14,0.96)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        transform: 'translateX(78%)',
        zIndex: 10,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#30D158', boxShadow: '0 0 8px #30D158' }} />
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>2 matches found</span>
      </div>

      {/* Floating chip — left */}
      <div style={{
        position: 'absolute', bottom: '30%', left: 0,
        background: 'rgba(14,14,14,0.96)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '7px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        transform: 'translateX(-78%)',
        zIndex: 10,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>✈️  3,200+ trips</span>
      </div>

      {/* iPhone outer shell — titanium gradient */}
      <div style={{
        height: '100%',
        maxHeight: 480,
        aspectRatio: '9 / 19.5',
        background: 'linear-gradient(160deg, #3a3a3c 0%, #2c2c2e 30%, #1c1c1e 70%, #141414 100%)',
        borderRadius: 50,
        padding: 10,
        position: 'relative',
        flexShrink: 0,
        boxShadow: [
          /* outer edge highlight */
          '0 0 0 0.5px rgba(255,255,255,0.15)',
          /* inner edge shadow */
          'inset 0 0 0 0.5px rgba(0,0,0,0.8)',
          /* depth shadow */
          '0 60px 140px rgba(0,0,0,1)',
          '0 24px 60px rgba(0,0,0,0.85)',
          /* subtle warm glow */
          '0 0 100px rgba(240,235,227,0.04)',
        ].join(', '),
      }}>

        {/* Left side buttons */}
        <div style={{ position: 'absolute', left: -3, top: '18%', width: 3, height: 24, background: 'linear-gradient(to right, #1a1a1a, #2a2a2a)', borderRadius: '2px 0 0 2px', boxShadow: '-1px 0 2px rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', left: -3, top: '26%', width: 3, height: 40, background: 'linear-gradient(to right, #1a1a1a, #2a2a2a)', borderRadius: '2px 0 0 2px', boxShadow: '-1px 0 2px rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', left: -3, top: '34%', width: 3, height: 40, background: 'linear-gradient(to right, #1a1a1a, #2a2a2a)', borderRadius: '2px 0 0 2px', boxShadow: '-1px 0 2px rgba(0,0,0,0.5)' }} />
        {/* Right side button */}
        <div style={{ position: 'absolute', right: -3, top: '28%', width: 3, height: 60, background: 'linear-gradient(to left, #1a1a1a, #2a2a2a)', borderRadius: '0 2px 2px 0', boxShadow: '1px 0 2px rgba(0,0,0,0.5)' }} />

        {/* Screen bezel — slight inner shadow for depth */}
        <div style={{
          width: '100%', height: '100%',
          borderRadius: 42,
          overflow: 'hidden',
          background: '#000',
          boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.04)',
          position: 'relative',
        }}>
          {/* Real app screenshot — fills the screen completely */}
          <img
            src="/screenshots/app-feed.jpg"
            alt="TripAlong app"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              display: 'block',
            }}
          />

          {/* Subtle screen glass reflection */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)',
            borderRadius: 42,
          }} />
        </div>
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
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>

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
        margin: '12px 0 0', flexShrink: 0,
      }}>
        3,200+ travelers already planning their next trip
      </p>

    </main>
  )
}
