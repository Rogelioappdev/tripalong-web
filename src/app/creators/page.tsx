'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TripAlong Creator — a creator's own view of what their content has produced.
// Lives outside (protected) because creators arrive here from a link, not from
// inside the app, and shouldn't be pushed through the onboarding gate.
//
// Sign-in is a magic link to the email they gave us, with shouldCreateUser
// off: every creator we onboard already has an account (we hand out free
// TripAlong+ on first contact), so a "no account" result means a mistyped or
// mismatched email, not a new signup — and we'd rather say so than silently
// create a stray account.

type Stats = {
  code: string
  creatorName: string
  rate: number
  status: string
  payoutMethod: string | null
  signups: number
  subscribers: number
  conversion: number
  pendingCents: number
  payableCents: number
  paidCents: number
  nextClearAt: string | null
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`
const CREAM = '#F0EBE3'
const MIN_PAYOUT_CENTS = 2500

export default function CreatorPortal() {
  const [phase, setPhase] = useState<'checking' | 'signin' | 'sent' | 'ready' | 'notcreator'>('checking')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  const loadStats = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setPhase('signin'); return }
    const res = await fetch('/api/creators/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.status === 403) { setPhase('notcreator'); return }
    if (!res.ok) { setPhase('signin'); return }
    setStats(await res.json())
    setPhase('ready')
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const sendLink = async () => {
    if (!email.trim()) return
    setBusy(true); setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/creators` : undefined,
      },
    })
    setBusy(false)
    if (err) {
      setError("We don't recognise that email. Use the one you signed up to TripAlong with.")
      return
    }
    setPhase('sent')
  }

  const signOut = async () => { await supabase.auth.signOut(); setPhase('signin'); setStats(null) }

  return (
    <main style={{ minHeight: '100dvh', background: '#0A0A0A', color: CREAM, fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 80px' }}>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,235,227,0.4)' }}>
          TripAlong Creator
        </p>

        {phase === 'checking' && (
          <p style={{ marginTop: 24, color: 'rgba(240,235,227,0.4)', fontSize: 14 }}>Loading…</p>
        )}

        {phase === 'signin' && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', margin: '10px 0 8px' }}>
              See how your content is doing
            </h1>
            <p style={{ color: 'rgba(240,235,227,0.45)', fontSize: 15, lineHeight: 1.5, margin: 0 }}>
              Enter the email you signed up to TripAlong with and we&rsquo;ll send you a sign-in link.
            </p>
            <input
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') sendLink() }}
              placeholder="you@email.com"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: '100%', marginTop: 22, padding: '13px 16px', borderRadius: 14, fontSize: 16,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none',
              }}
            />
            {error && <p style={{ color: '#FF6B6B', fontSize: 13, marginTop: 10 }}>{error}</p>}
            <button
              onClick={sendLink}
              disabled={busy || !email.trim()}
              style={{
                width: '100%', marginTop: 12, padding: '15px 0', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, ${CREAM} 0%, #ddd4ca 100%)`, color: '#000',
                fontWeight: 700, fontSize: 15, opacity: busy || !email.trim() ? 0.4 : 1,
              }}
            >
              {busy ? 'Sending…' : 'Send me a link'}
            </button>
          </>
        )}

        {phase === 'sent' && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px', margin: '10px 0 8px' }}>Check your email</h1>
            <p style={{ color: 'rgba(240,235,227,0.45)', fontSize: 15, lineHeight: 1.5 }}>
              We sent a sign-in link to <strong style={{ color: CREAM }}>{email}</strong>. Open it on this device.
            </p>
          </>
        )}

        {phase === 'notcreator' && (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px', margin: '10px 0 8px' }}>
              This account isn&rsquo;t linked to a creator code
            </h1>
            <p style={{ color: 'rgba(240,235,227,0.45)', fontSize: 15, lineHeight: 1.5 }}>
              You may be signed in with a different email than the one you gave us. Sign out and try the other one,
              or message us and we&rsquo;ll fix it.
            </p>
            <button onClick={signOut} style={{ marginTop: 18, padding: '11px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: CREAM, fontSize: 14, fontWeight: 600 }}>
              Sign out
            </button>
          </>
        )}

        {phase === 'ready' && stats && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', margin: '10px 0 4px' }}>
              {stats.creatorName}
            </h1>
            <p style={{ color: 'rgba(240,235,227,0.4)', fontSize: 14, margin: 0 }}>
              Your code is <strong style={{ color: CREAM, letterSpacing: '0.06em' }}>{stats.code}</strong>
              {stats.status !== 'active' && <span style={{ color: '#D9A455' }}> · paused</span>}
            </p>

            {/* Reach */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 26 }}>
              {[
                { k: 'Signups', v: String(stats.signups) },
                { k: 'Subscribers', v: String(stats.subscribers) },
                { k: 'Convert', v: `${stats.conversion}%` },
              ].map(t => (
                <div key={t.k} style={{ background: '#131313', border: '1px solid #222', borderRadius: 12, padding: '14px 14px 12px' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,235,227,0.4)', margin: 0 }}>{t.k}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{t.v}</p>
                </div>
              ))}
            </div>

            {/* Earnings */}
            <div style={{ background: '#131313', border: '1px solid #222', borderRadius: 12, padding: 18, marginTop: 12 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,235,227,0.4)', margin: '0 0 12px' }}>
                Earnings · {Math.round(stats.rate * 100)}% for 12 months
              </p>
              {[
                {
                  k: 'Pending',
                  v: money(stats.pendingCents),
                  note: stats.nextClearAt
                    ? `clears ${new Date(stats.nextClearAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : null,
                },
                { k: 'Ready to pay', v: money(stats.payableCents), note: null },
                { k: 'Paid to date', v: money(stats.paidCents), note: null },
              ].map((r, i) => (
                <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0', borderTop: i ? '1px solid #1e1e1e' : 'none' }}>
                  <span style={{ fontSize: 14.5, color: 'rgba(240,235,227,0.75)' }}>{r.k}</span>
                  {r.note && <span style={{ fontSize: 12, color: 'rgba(240,235,227,0.32)' }}>{r.note}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 17, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
                </div>
              ))}
            </div>

            <p style={{ color: 'rgba(240,235,227,0.35)', fontSize: 12.5, lineHeight: 1.6, marginTop: 14 }}>
              Earnings sit in <strong style={{ color: 'rgba(240,235,227,0.6)' }}>Pending</strong> for 30 days after a
              subscription starts, in case of refunds. Once cleared they move to Ready and are paid out monthly, with a
              {' '}{money(MIN_PAYOUT_CENTS)} minimum — anything under that rolls over.
              {stats.payoutMethod ? ` We pay to ${stats.payoutMethod}.` : ' Send us your PayPal email so we can pay you.'}
            </p>

            <button onClick={signOut} style={{ marginTop: 22, padding: '10px 16px', borderRadius: 11, background: 'transparent', border: '1px solid #2a2a2a', color: 'rgba(240,235,227,0.5)', fontSize: 13 }}>
              Sign out
            </button>
          </>
        )}
      </div>
    </main>
  )
}
