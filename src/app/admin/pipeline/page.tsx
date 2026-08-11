'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'

// Creator deal pipeline — everything before /admin/creators.
//
// Shares the admin secret with the other /admin pages (same localStorage key)
// so you type it once. The list is stage-filtered rather than a kanban board
// on purpose: this gets checked on a phone between DMs, and horizontal
// columns are unusable there.
const KEY = 'ta_admin_secret'

type Lead = {
  id: string
  handle: string
  name: string | null
  followers: number | null
  stage: 'new' | 'waiting' | 'call' | 'closed' | 'live' | 'dead'
  notes: string | null
  deal_terms: string | null
  call_at: string | null
  last_contact_at: string | null
  code_id: string | null
  created_at: string
  perf: { signups: number; subscribers: number; revenue_cents: number } | null
  call_overdue: boolean
  call_today: boolean
  stale: boolean
  days_quiet: number
}

const STAGES = [
  { id: 'new',     label: 'New',      hint: 'Came in, not replied yet',   color: '#5AC8FA' },
  { id: 'waiting', label: 'Waiting',  hint: 'Ball is in their court',     color: '#FFB020' },
  { id: 'call',    label: 'Call',     hint: 'Call booked',                color: '#AF7BFF' },
  { id: 'closed',  label: 'Closed',   hint: 'Agreed, content in progress',color: '#3DD68C' },
  { id: 'live',    label: 'Live',     hint: 'Content published',          color: '#F0EBE3' },
  { id: 'dead',    label: 'Passed',   hint: 'Not a fit / ghosted',        color: '#6B6B6B' },
] as const

const money = (c: number) => `$${(c / 100).toFixed(2)}`
const card = { background: '#111', border: '1px solid #222', borderRadius: 12, padding: 18 } as const
const input = { padding: '9px 12px', borderRadius: 9, background: '#181818', border: '1px solid #2a2a2a', color: '#fff', fontSize: 13.5 } as const
const btn = { padding: '8px 14px', borderRadius: 9, border: '1px solid #2a2a2a', background: '#181818', color: '#F0EBE3', fontSize: 13, cursor: 'pointer' } as const

function whenLabel(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function PipelinePage() {
  const [secret, setSecret] = useState('')
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [bulk, setBulk] = useState('')

  useEffect(() => { setSecret(localStorage.getItem(KEY) ?? '') }, [])

  const load = useCallback(async (s: string) => {
    if (!s) return
    setError(null)
    const res = await fetch('/api/admin/creator-leads', { headers: { Authorization: `Bearer ${s}` } })
    if (!res.ok) { setError('Wrong secret, or the server rejected it.'); setLeads(null); return }
    const body = await res.json()
    setLeads(body.leads ?? [])
    localStorage.setItem(KEY, s)
  }, [])

  useEffect(() => { if (secret) load(secret) }, [secret, load])

  const call = useCallback(async (method: string, payload: any) => {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/creator-leads', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(body.error ?? 'Something went wrong'); return null }
    await load(secret)
    return body
  }, [secret, load])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of leads ?? []) c[l.stage] = (c[l.stage] ?? 0) + 1
    return c
  }, [leads])

  // The whole reason this exists: with 40+ conversations the failure isn't
  // losing someone, it's forgetting them. Surface that first, above the list.
  const attention = useMemo(() => {
    const l = leads ?? []
    return {
      overdue: l.filter(x => x.call_overdue),
      today: l.filter(x => x.call_today && !x.call_overdue),
      stale: l.filter(x => x.stale),
      unanswered: l.filter(x => x.stage === 'new'),
    }
  }, [leads])

  const shown = useMemo(() => {
    const l = (leads ?? []).filter(x => filter === 'all' ? x.stage !== 'dead' : x.stage === filter)
    const rank = (x: Lead) => (x.call_overdue ? 0 : x.call_today ? 1 : x.stale ? 2 : 3)
    return [...l].sort((a, b) => rank(a) - rank(b) || b.days_quiet - a.days_quiet)
  }, [leads, filter])

  const importBulk = async () => {
    const r = await call('POST', { bulk })
    if (r) { setBulk(''); setFilter('new') }
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#0A0A0A', color: '#F0EBE3', padding: 24, fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 4px' }}>Creator pipeline</h1>
        <p style={{ color: 'rgba(240,235,227,0.45)', fontSize: 14, marginTop: 0 }}>
          Every creator conversation, from first DM to signed. <a href="/admin/creators" style={{ color: '#5AC8FA' }}>Signed creators & payouts →</a>
        </p>

        <input
          type="password" value={secret} onChange={e => setSecret(e.target.value)}
          placeholder="Admin secret"
          style={{ ...input, marginTop: 16, width: 280, padding: '10px 14px', borderRadius: 10, background: '#141414', border: '1px solid #262626' }}
        />
        {error && <p style={{ color: '#FF6B6B', fontSize: 13.5 }}>{error}</p>}

        {leads && (
          <>
            {/* ── Needs you ─────────────────────────────────────────────── */}
            {(attention.overdue.length + attention.today.length + attention.stale.length + attention.unanswered.length > 0) && (
              <section style={{ ...card, marginTop: 24, borderColor: '#2e2410', background: '#14100a' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Needs you</h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {([
                    ['Call overdue', attention.overdue, '#FF6B6B'],
                    ['Call today', attention.today, '#AF7BFF'],
                    ['Gone quiet', attention.stale, '#FFB020'],
                    ['Never replied to', attention.unanswered, '#5AC8FA'],
                  ] as const).map(([label, list, color]) => list.length > 0 && (
                    <div key={label} style={{ flex: '1 1 200px', background: '#0f0f0f', border: '1px solid #232323', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, margin: '2px 0 6px' }}>{list.length}</div>
                      <div style={{ fontSize: 12.5, color: 'rgba(240,235,227,0.55)', lineHeight: 1.5 }}>
                        {list.slice(0, 4).map(l => '@' + l.handle).join(', ')}{list.length > 4 ? ` +${list.length - 4}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Bulk import ───────────────────────────────────────────── */}
            <section style={{ ...card, marginTop: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Add from Instagram</h2>
              <p style={{ fontSize: 13, color: 'rgba(240,235,227,0.45)', margin: '0 0 12px' }}>
                Paste handles — one per line or comma separated. @, full profile URLs and mixed case are all fine.
                Handles already in the pipeline are skipped, so you can paste the same batch twice safely.
              </p>
              <textarea
                value={bulk} onChange={e => setBulk(e.target.value)} rows={4}
                placeholder={'@traveljane\ninstagram.com/nomadkyle\nbackpack.sam'}
                style={{ ...input, width: '100%', fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
              />
              <button onClick={importBulk} disabled={busy || !bulk.trim()}
                style={{ ...btn, marginTop: 10, background: '#F0EBE3', color: '#000', fontWeight: 700, border: 'none', opacity: busy || !bulk.trim() ? 0.4 : 1 }}>
                Import
              </button>
            </section>

            {/* ── Stage filter ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
              <button onClick={() => setFilter('all')}
                style={{ ...btn, background: filter === 'all' ? '#F0EBE3' : '#181818', color: filter === 'all' ? '#000' : '#F0EBE3', fontWeight: filter === 'all' ? 700 : 400 }}>
                Active {(leads.filter(l => l.stage !== 'dead')).length}
              </button>
              {STAGES.map(s => (
                <button key={s.id} onClick={() => setFilter(s.id)} title={s.hint}
                  style={{ ...btn, background: filter === s.id ? s.color : '#181818', color: filter === s.id ? '#000' : '#F0EBE3', fontWeight: filter === s.id ? 700 : 400 }}>
                  {s.label} {counts[s.id] ?? 0}
                </button>
              ))}
            </div>

            {/* ── Leads ─────────────────────────────────────────────────── */}
            <section style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shown.length === 0 && (
                <p style={{ color: 'rgba(240,235,227,0.4)', fontSize: 14 }}>Nothing here.</p>
              )}
              {shown.map(l => {
                const stage = STAGES.find(s => s.id === l.stage)!
                const isOpen = open === l.id
                return (
                  <div key={l.id} style={{ ...card, padding: 14, borderColor: l.call_overdue ? '#5a2a2a' : l.stale ? '#3a3016' : '#222' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: stage.color, flexShrink: 0 }} />
                      <button onClick={() => setOpen(isOpen ? null : l.id)}
                        style={{ background: 'none', border: 'none', color: '#F0EBE3', fontSize: 15, fontWeight: 650, cursor: 'pointer', padding: 0 }}>
                        @{l.handle}
                      </button>
                      {l.name && <span style={{ fontSize: 13.5, color: 'rgba(240,235,227,0.55)' }}>{l.name}</span>}
                      {l.followers != null && (
                        <span style={{ fontSize: 12.5, color: 'rgba(240,235,227,0.4)' }}>
                          {l.followers >= 1000 ? `${(l.followers / 1000).toFixed(1)}k` : l.followers}
                        </span>
                      )}

                      <span style={{ flex: 1 }} />

                      {l.call_at && (
                        <span style={{ fontSize: 12.5, color: l.call_overdue ? '#FF6B6B' : l.call_today ? '#AF7BFF' : 'rgba(240,235,227,0.45)' }}>
                          {l.call_overdue ? 'Overdue · ' : l.call_today ? 'Today · ' : ''}{whenLabel(l.call_at)}
                        </span>
                      )}
                      {l.stale && !l.call_at && (
                        <span style={{ fontSize: 12.5, color: '#FFB020' }}>Quiet {l.days_quiet}d</span>
                      )}
                      {l.perf && (
                        <span style={{ fontSize: 12.5, color: '#3DD68C' }}>
                          {l.perf.signups} signups · {money(l.perf.revenue_cents)}
                        </span>
                      )}

                      <select
                        value={l.stage}
                        onChange={e => call('PATCH', { id: l.id, stage: e.target.value })}
                        style={{ ...input, padding: '6px 8px', fontSize: 12.5 }}
                      >
                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <button onClick={() => call('PATCH', { id: l.id, touch: true })} disabled={busy}
                        title="Reset the quiet timer — use when you've just messaged them"
                        style={{ ...btn, padding: '6px 10px', fontSize: 12.5 }}>
                        Messaged
                      </button>
                    </div>

                    {isOpen && (
                      <LeadDetail lead={l} busy={busy} onCall={call} onDelete={async () => {
                        if (!confirm(`Remove @${l.handle} from the pipeline? This deletes the notes and history.`)) return
                        setBusy(true)
                        await fetch(`/api/admin/creator-leads?id=${l.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${secret}` } })
                        setBusy(false); setOpen(null); load(secret)
                      }} />
                    )}
                  </div>
                )
              })}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function LeadDetail({ lead, busy, onCall, onDelete }: {
  lead: Lead; busy: boolean
  onCall: (m: string, p: any) => Promise<any>
  onDelete: () => void
}) {
  const [f, setF] = useState({
    name: lead.name ?? '', followers: lead.followers?.toString() ?? '',
    notes: lead.notes ?? '', deal_terms: lead.deal_terms ?? '',
    call_at: lead.call_at ? lead.call_at.slice(0, 16) : '',
  })
  const [code, setCode] = useState('')
  const [rate, setRate] = useState('0.15')

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #222', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Real name" style={{ ...input, width: 170 }} />
        <input value={f.followers} onChange={e => setF({ ...f, followers: e.target.value })} placeholder="Followers" style={{ ...input, width: 110 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(240,235,227,0.5)' }}>
          Call
          <input type="datetime-local" value={f.call_at} onChange={e => setF({ ...f, call_at: e.target.value })} style={{ ...input, colorScheme: 'dark' }} />
        </label>
      </div>

      <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} rows={2}
        placeholder="Notes — what they asked for, what you offered, where it stalled"
        style={{ ...input, width: '100%', resize: 'vertical' }} />

      <textarea value={f.deal_terms} onChange={e => setF({ ...f, deal_terms: e.target.value })} rows={2}
        placeholder="Agreed terms — e.g. 2 reels + 1 story, 20% commission, free Plus for a year"
        style={{ ...input, width: '100%', resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => onCall('PATCH', {
            id: lead.id, name: f.name, followers: f.followers,
            notes: f.notes, deal_terms: f.deal_terms,
            call_at: f.call_at ? new Date(f.call_at).toISOString() : null,
          })}
          disabled={busy}
          style={{ ...btn, background: '#F0EBE3', color: '#000', fontWeight: 700, border: 'none' }}>
          Save
        </button>
        <a href={`https://instagram.com/${lead.handle}`} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }}>
          Open DM
        </a>
        <span style={{ flex: 1 }} />
        <button onClick={onDelete} disabled={busy} style={{ ...btn, color: '#FF6B6B', borderColor: '#3a2020' }}>Remove</button>
      </div>

      {/* Conversion — the handoff into the real referral programme. */}
      {lead.code_id ? (
        <div style={{ fontSize: 13, color: '#3DD68C', paddingTop: 4 }}>
          Signed — has a referral code.{' '}
          <a href="/admin/creators" style={{ color: '#5AC8FA' }}>Manage in Creators →</a>
          {lead.perf && ` · ${lead.perf.signups} signups, ${lead.perf.subscribers} subscribers, ${money(lead.perf.revenue_cents)} commission`}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4, borderTop: '1px solid #1c1c1c' }}>
          <span style={{ fontSize: 12.5, color: 'rgba(240,235,227,0.5)' }}>Close the deal:</span>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="THEIRCODE" style={{ ...input, width: 130 }} />
          <input value={rate} onChange={e => setRate(e.target.value)} placeholder="0.15" style={{ ...input, width: 70 }} />
          <button
            onClick={() => onCall('PATCH', { id: lead.id, action: 'convert', code, commission_rate: parseFloat(rate) || 0.15 })}
            disabled={busy || !code}
            style={{ ...btn, background: '#3DD68C', color: '#000', fontWeight: 700, border: 'none', opacity: busy || !code ? 0.4 : 1 }}>
            Issue code & mark closed
          </button>
        </div>
      )}
    </div>
  )
}
