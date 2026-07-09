'use client'

import { useRouter } from 'next/navigation'

export default function NotifyConfirmedPage() {
  const router = useRouter()

  return (
    <main style={{
      background: '#000', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 28px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>✈️</div>

      <p style={{
        color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600,
        letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10,
      }}>
        You're in
      </p>

      <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, marginBottom: 14, lineHeight: 1.1 }}>
        We'll let you know!
      </h1>

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, lineHeight: 1.65, maxWidth: 280, marginBottom: 40 }}>
        Expect a notification the moment TripAlong goes live on{' '}
        <span style={{ color: '#F0EBE3', fontWeight: 600 }}>July 9th, 12pm PST</span>.
      </p>

      <button
        onClick={() => router.push('/')}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: '12px 28px',
          color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        ← Back to countdown
      </button>
    </main>
  )
}
