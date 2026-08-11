'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'

// The link we reply to every DM with. Everything on this page is data we'd
// otherwise have to extract from Instagram by hand — and the follower count
// and email in particular are things we currently don't have for most of the
// pipeline, because a DM doesn't carry them.

const CREAM = '#F0EBE3'

export default function CreatorApply() {
  const [f, setF] = useState({
    instagram_handle: '', name: '', followers: '', email: '', payout_method: '', notes: '',
    website: '', // honeypot — hidden, real people never fill it
  })
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!f.instagram_handle.trim()) { setError('We need your Instagram handle at least.'); return }
    setState('sending'); setError(null)
    const res = await fetch('/api/creators/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setState('form'); setError(body.error ?? 'Something went wrong.'); return }
    setState('done')
  }

  const input = {
    width: '100%', padding: '13px 15px', borderRadius: 13, fontSize: 16,
    background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', outline: 'none',
  } as const

  const label = {
    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'rgba(240,235,227,0.42)', display: 'block', marginBottom: 6,
  } as const

  return (
    <main style={{ minHeight: '100dvh', background: '#0A0A0A', color: CREAM, fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '52px 24px 90px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,235,227,0.4)', margin: 0 }}>
          TripAlong Creator
        </p>

        {state === 'done' ? (
          <>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.9px', margin: '12px 0 10px', lineHeight: 1.1 }}>
              You&rsquo;re in the list
            </h1>
            <p style={{ color: 'rgba(240,235,227,0.5)', fontSize: 16, lineHeight: 1.55 }}>
              We&rsquo;ll come back to you on Instagram. In the meantime, download TripAlong and have a look around —
              we&rsquo;ll set you up with the full paid version free once we talk.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.9px', margin: '12px 0 10px', lineHeight: 1.1 }}>
              Make content for TripAlong
            </h1>
            <p style={{ color: 'rgba(240,235,227,0.5)', fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              Tell us where to find you and we&rsquo;ll be in touch. Takes about thirty seconds.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28 }}>
              <div>
                <label style={label}>Instagram handle *</label>
                <input value={f.instagram_handle} onChange={e => { setF(v => ({ ...v, instagram_handle: e.target.value })); setError(null) }}
                  placeholder="@yourhandle" autoCapitalize="none" autoCorrect="off" style={input} />
              </div>
              <div>
                <label style={label}>Your name</label>
                <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} placeholder="First and last" style={input} />
              </div>
              <div>
                <label style={label}>Followers</label>
                <input value={f.followers} onChange={e => setF(v => ({ ...v, followers: e.target.value }))}
                  placeholder="e.g. 8400" inputMode="numeric" style={input} />
              </div>
              <div>
                <label style={label}>Email</label>
                <input value={f.email} onChange={e => setF(v => ({ ...v, email: e.target.value }))}
                  placeholder="you@email.com" type="email" autoCapitalize="none" style={input} />
              </div>
              <div>
                <label style={label}>PayPal email — for getting paid</label>
                <input value={f.payout_method} onChange={e => setF(v => ({ ...v, payout_method: e.target.value }))}
                  placeholder="Same as above is fine" autoCapitalize="none" style={input} />
              </div>
              <div>
                <label style={label}>What kind of content do you make?</label>
                <textarea value={f.notes} onChange={e => setF(v => ({ ...v, notes: e.target.value }))}
                  placeholder="Solo travel, hiking, van life, wherever you're headed next…" rows={3}
                  style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Honeypot — hidden from people, catches bots. */}
              <input value={f.website} onChange={e => setF(v => ({ ...v, website: e.target.value }))}
                tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

              {error && <p style={{ color: '#FF6B6B', fontSize: 13.5, margin: 0 }}>{error}</p>}

              <button onClick={submit} disabled={state === 'sending'}
                style={{
                  width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', marginTop: 4,
                  background: `linear-gradient(135deg, ${CREAM} 0%, #ddd4ca 100%)`, color: '#000',
                  fontWeight: 700, fontSize: 15.5, opacity: state === 'sending' ? 0.5 : 1,
                }}>
                {state === 'sending' ? 'Sending…' : 'Send it'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
