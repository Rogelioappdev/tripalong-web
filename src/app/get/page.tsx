'use client'

const APP_STORE = 'https://apps.apple.com/us/app/tagalong-find-trips-together/id6758787857'
const ANDROID_URL = 'https://tripalong-web.vercel.app/'

// SVG icons matching the actual app
function IconMessage({ opacity = 1 }: { opacity?: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function IconProfile({ opacity = 1 }: { opacity?: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity }}>
      <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function IconPlane({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  )
}

function PhoneMockup() {
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Floating chip — right */}
      <div style={{
        position: 'absolute', top: '18%', right: -4,
        background: 'rgba(18,18,18,0.95)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '7px 11px',
        display: 'flex', alignItems: 'center', gap: 5,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        transform: 'translateX(70%)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: '#30D158', boxShadow: '0 0 6px #30D158' }} />
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>2 matches found</span>
      </div>

      {/* Floating chip — left */}
      <div style={{
        position: 'absolute', bottom: '28%', left: -4,
        background: 'rgba(18,18,18,0.95)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '7px 11px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        transform: 'translateX(-70%)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>✈️ 3,200+ trips</span>
      </div>

      {/* Phone outer frame */}
      <div style={{
        height: '100%',
        maxHeight: 460,
        aspectRatio: '9 / 19.5',
        background: 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 40%, #111 100%)',
        borderRadius: 46,
        padding: 8,
        boxShadow: [
          '0 0 0 0.5px rgba(255,255,255,0.08)',
          'inset 0 0 0 0.5px rgba(255,255,255,0.05)',
          '0 50px 120px rgba(0,0,0,0.95)',
          '0 20px 60px rgba(0,0,0,0.8)',
          '0 0 80px rgba(240,235,227,0.03)',
        ].join(', '),
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Side buttons (decorative) */}
        <div style={{ position: 'absolute', left: -2.5, top: '22%', width: 2.5, height: 28, background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', left: -2.5, top: '30%', width: 2.5, height: 28, background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', right: -2.5, top: '26%', width: 2.5, height: 44, background: '#2a2a2a', borderRadius: '0 2px 2px 0' }} />

        {/* Screen */}
        <div style={{
          width: '100%', height: '100%',
          background: '#000',
          borderRadius: 40,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}>
          {/* Dynamic island */}
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: '30%', height: '5%', maxHeight: 28,
            background: '#000', borderRadius: 20, zIndex: 30,
            boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.06)',
          }} />

          {/* Status bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14% 6% 0',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '-0.2px' }}>9:41</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {/* Signal */}
              <svg width="13" height="9" viewBox="0 0 16 12" fill="white">
                <rect x="0" y="6" width="3" height="6" rx="0.8" />
                <rect x="4.5" y="4" width="3" height="8" rx="0.8" />
                <rect x="9" y="2" width="3" height="10" rx="0.8" />
                <rect x="13.5" y="0" width="3" height="12" rx="0.8" opacity="0.3" />
              </svg>
              {/* WiFi */}
              <svg width="13" height="9" viewBox="0 0 20 15" fill="white">
                <path d="M10 11.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
                <path d="M10 7.5c1.8 0 3.4.7 4.6 1.9l1.5-1.5A8.5 8.5 0 0 0 10 5.5a8.5 8.5 0 0 0-6.1 2.4l1.5 1.5A6.4 6.4 0 0 1 10 7.5z" />
                <path d="M10 3.5c2.9 0 5.5 1.1 7.5 3l1.5-1.5A12.5 12.5 0 0 0 10 1.5 12.5 12.5 0 0 0 1 5l1.5 1.5A10.4 10.4 0 0 1 10 3.5z" />
              </svg>
              {/* Battery */}
              <svg width="20" height="9" viewBox="0 0 28 13" fill="none">
                <rect x="0" y="1" width="24" height="11" rx="2.5" stroke="white" strokeWidth="1.2" opacity="0.9" />
                <rect x="25" y="4" width="3" height="5" rx="1.5" fill="white" opacity="0.5" />
                <rect x="1.5" y="2.5" width="18" height="8" rx="1.5" fill="white" opacity="0.9" />
              </svg>
            </div>
          </div>

          {/* App header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4% 5% 3%', flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '13px', letterSpacing: '-0.3px' }}>TripAlong</span>
            <div style={{
              background: 'rgba(240,235,227,0.92)',
              borderRadius: 10, padding: '3px 7px',
              fontSize: '8px', fontWeight: 700, color: '#000', letterSpacing: '-0.1px',
            }}>
              + Create Trip
            </div>
          </div>

          {/* Trip card — fills remaining space */}
          <div style={{ flex: 1, padding: '0 5% 0', minHeight: 0, position: 'relative' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>

              {/* Cover image */}
              <img
                src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=90&fit=crop&crop=center"
                alt="Tokyo"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Gradient overlay — matches the real app exactly */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, transparent 22%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.97) 100%)',
              }} />

              {/* SAVE stamp (subtle) */}
              <div style={{
                position: 'absolute', top: '8%', right: '6%', zIndex: 5,
                border: '1.5px solid #F0EBE3', borderRadius: 5, padding: '2px 6px',
                transform: 'rotate(15deg)',
              }}>
                <span style={{ color: '#F0EBE3', fontWeight: 900, fontSize: '7px', letterSpacing: '1px' }}>SAVE</span>
              </div>

              {/* Trip info */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 8% 5%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="rgba(240,235,227,0.5)">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  </svg>
                  <span style={{ color: 'rgba(240,235,227,0.5)', fontSize: '7.5px', fontWeight: 500 }}>japan</span>
                </div>
                <h3 style={{ color: '#fff', fontWeight: 800, margin: '0 0 2px', fontSize: '19px', letterSpacing: '-0.4px', lineHeight: 1.05 }}>
                  Tokyo
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '7.5px', margin: '0 0 5px' }}>
                  Jul 12 – Jul 22 · Flexible
                </p>
                <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                  {['Cultural', 'Foodie'].map(v => (
                    <span key={v} style={{
                      fontSize: '7px', borderRadius: 8, padding: '2px 6px', fontWeight: 600,
                      background: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.18)',
                      color: '#F0EBE3',
                    }}>{v}</span>
                  ))}
                </div>
                {/* Creator row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 8,
                    border: '1.5px solid #000', overflow: 'hidden', background: '#333', flexShrink: 0,
                  }}>
                    <img
                      src="https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/avatars/a50cfe93-fd2d-4676-b4da-8c970f696690/avatar.jpg"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      alt=""
                    />
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '7.5px' }}>Rogelio P. · going</span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{
                position: 'absolute', bottom: '2%', left: 0, right: 0,
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8%',
                padding: '0 5% 6%',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(20,20,20,0.9)', border: '0.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '7px', fontWeight: 600 }}>Pass</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(20,20,20,0.9)', border: '0.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                    <svg width="17" height="13" viewBox="0 0 24 18" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 2 9 13 4 8"/></svg>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '7px', fontWeight: 600 }}>Join</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(20,20,20,0.9)', border: '0.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '7px', fontWeight: 600 }}>Save</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar — floating pill */}
          <div style={{
            margin: '3% 5% 5%',
            background: '#080808',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            height: '11%',
            maxHeight: 50,
            display: 'flex', alignItems: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <IconMessage opacity={0.35} />
              <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: '6.5px', fontWeight: 600 }}>Messages</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <IconPlane size={18} />
              <span style={{ color: '#fff', fontSize: '6.5px', fontWeight: 600 }}>TripAlong</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <IconProfile opacity={0.35} />
              <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: '6.5px', fontWeight: 600 }}>Profile</span>
            </div>
          </div>
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
