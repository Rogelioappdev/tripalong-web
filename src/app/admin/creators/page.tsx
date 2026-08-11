'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'

// Internal control panel for the creator referral programme. Gated by the same
// shared secret as the other /api/admin routes — the secret is typed in here
// and kept in localStorage, never shipped in the bundle.
const KEY = 'ta_admin_secret'

type Creator = {
  id: string
  code: string
  creator_name: string
  creator_handle: string | null
  email: string | null
  payout_method: string | null
  commission_rate: number
  status: string
  signups: number
  subscribers: number
  conversion: number
  revenue_cents: number
  pending_cents: number
  payable_cents: number
  paid_cents: number
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`

export default function AdminCreatorsPage() {
  const [secret, setSecret] = useState('')
  const [creators, setCreators] = useState<Creator[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ code: '', creator_name: '', creator_handle: '', email: '', payout_method: '', commission_rate: '0.15' })

  useEffect(() => { setSecret(localStorage.getItem(KEY) ?? '') }, [])

  const load = useCallback(async (s: string) => {
    if (!s) return
    setError(null)
    const res = await fetch('/api/admin/creators', { headers: { Authorization: `Bearer ${s}` } })
    if (!res.ok) { setError('Wrong secret, or the server rejected it.'); setCreators(null); return }
    const body = await res.json()
    setCreators(body.creators ?? [])
    localStorage.setItem(KEY, s)
  }, [])

  useEffect(() => { if (secret) load(secret) }, [secret, load])

  const createCode = async () => {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ ...form, commission_rate: parseFloat(form.commission_rate) || 0.15 }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(body.error ?? 'Could not create code'); return }
    setForm({ code: '', creator_name: '', creator_handle: '', email: '', payout_method: '', commission_rate: '0.15' })
    load(secret)
  }

  const markPaid = async (c: Creator) => {
    if (!confirm(`Mark ${money(c.payable_cents)} as paid to ${c.creator_name}? Do this only after the money has actually been sent.`)) return
    setBusy(true)
    await fetch('/api/admin/creators', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ code_id: c.id, action: 'mark_paid' }),
    })
    setBusy(false)
    load(secret)
  }

  const setStatus = async (c: Creator, status: string) => {
    setBusy(true)
    await fetch('/api/admin/creators', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ code_id: c.id, status }),
    })
    setBusy(false)
    load(secret)
  }

  const totalPayable = (creators ?? []).reduce((t, c) => t + c.payable_cents, 0)
  const readyToPay = (creators ?? []).filter(c => c.payable_cents >= 2500)

  return (
    <main style={{ minHeight: '100dvh', background: '#0A0A0A', color: '#F0EBE3', padding: 24, fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 4px' }}>Creators</h1>
        <p style={{ color: 'rgba(240,235,227,0.45)', fontSize: 14, marginTop: 0 }}>
          Referral codes, attribution and payouts. <a href="/admin/pipeline" style={{ color: '#5AC8FA' }}>Creator pipeline →</a>
        </p>

        <input
          type="password"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder="Admin secret"
          style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: '#141414', border: '1px solid #262626', color: '#fff', width: 280, fontSize: 14 }}
        />
        {error && <p style={{ color: '#FF6B6B', fontSize: 13.5 }}>{error}</p>}

        {creators && (
          <>
            <section style={{ marginTop: 28, background: '#111', border: '1px solid #222', borderRadius: 12, padding: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Issue a code</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  ['code', 'CODE'], ['creator_name', 'Name'], ['creator_handle', '@handle'],
                  ['email', 'Email'], ['payout_method', 'PayPal email'], ['commission_rate', 'Rate (0.15)'],
                ] as const).map(([k, ph]) => (
                  <input
                    key={k}
                    value={(form as any)[k]}
                    onChange={e => setForm(f => ({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value }))}
                    placeholder={ph}
                    style={{ padding: '9px 12px', borderRadius: 9, background: '#181818', border: '1px solid #2a2a2a', color: '#fff', fontSize: 13.5, width: k === 'code' ? 120 : 165 }}
                  />
                ))}
                <button
                  onClick={createCode}
                  disabled={busy || !form.code || !form.creator_name}
                  style={{ padding: '9px 18px', borderRadius: 9, background: '#F0EBE3', color: '#000', fontWeight: 700, fontSize: 13.5, border: 'none', opacity: busy || !form.code || !form.creator_name ? 0.4 : 1 }}
                >
                  Create
                </button>
              </div>
            </section>

            <section style={{ marginTop: 20, background: '#111', border: '1px solid #222', borderRadius: 12, padding: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>
                Payout run — {money(totalPayable)} cleared
              </h2>
              <p style={{ color: 'rgba(240,235,227,0.4)', fontSize: 13, marginTop: 0 }}>
                {readyToPay.length} creator{readyToPay.length === 1 ? '' : 's'} over the $25 threshold. Send the money first, then mark it paid.
              </p>
              {readyToPay.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid #1e1e1e' }}>
                  <strong style={{ fontSize: 14 }}>{c.creator_name}</strong>
                  <span style={{ fontSize: 13, color: 'rgba(240,235,227,0.5)' }}>{c.payout_method ?? 'no payout method'}</span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{money(c.payable_cents)}</span>
                  <button onClick={() => markPaid(c)} disabled={busy}
                    style={{ padding: '6px 12px', borderRadius: 8, background: '#1f1f1f', border: '1px solid #333', color: '#F0EBE3', fontSize: 12.5, fontWeight: 600 }}>
                    Mark paid
                  </button>
                </div>
              ))}
            </section>

            <div style={{ marginTop: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ color: 'rgba(240,235,227,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {['Code', 'Creator', 'Rate', 'Signups', 'Subs', 'Conv', 'Revenue', 'Pending', 'Ready', 'Paid', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Code' || h === 'Creator' ? 'left' : 'right', padding: '8px 10px', borderBottom: '1px solid #222', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {creators.map(c => (
                    <tr key={c.id} style={{ opacity: c.status === 'active' ? 1 : 0.45 }}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #1a1a1a', fontWeight: 800 }}>{c.code}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #1a1a1a' }}>
                        {c.creator_name}
                        {c.creator_handle && <span style={{ color: 'rgba(240,235,227,0.4)' }}> {c.creator_handle}</span>}
                      </td>
                      {[
                        `${Math.round(c.commission_rate * 100)}%`,
                        c.signups, c.subscribers, `${c.conversion}%`,
                        money(c.revenue_cents), money(c.pending_cents), money(c.payable_cents), money(c.paid_cents),
                      ].map((v, i) => (
                        <td key={i} style={{ padding: '10px', borderBottom: '1px solid #1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                      ))}
                      <td style={{ padding: '10px', borderBottom: '1px solid #1a1a1a', textAlign: 'right' }}>
                        <button onClick={() => setStatus(c, c.status === 'active' ? 'paused' : 'active')} disabled={busy}
                          style={{ padding: '5px 10px', borderRadius: 7, background: 'transparent', border: '1px solid #333', color: 'rgba(240,235,227,0.6)', fontSize: 12 }}>
                          {c.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!creators.length && (
                    <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,235,227,0.35)' }}>No codes yet. Issue one above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
