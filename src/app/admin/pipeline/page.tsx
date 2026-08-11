'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'

// Creator pipeline for the three of us. Built to stay usable at 300+ rows:
// everything is one screen, grouped by stage, with search and filters rather
// than pagination — you should always be able to find a person in two seconds.
//
// Shares the admin secret (and its localStorage key) with /admin/creators, so
// signing in to one signs you in to both.

const KEY = 'ta_admin_secret'
const OWNERS = ['Jack', 'Kurt', 'Rogelio']

const STAGES = [
  { id: 'reached_out', label: 'Reached out', hint: 'DM sent, no reply yet or still talking' },
  { id: 'call_scheduled', label: 'Call scheduled', hint: 'Booked in' },
  { id: 'working', label: 'Working with us', hint: 'Signed and posting' },
] as const

type Stage = typeof STAGES[number]['id']

type Creator = {
  id: string
  name: string
  instagram_handle: string | null
  followers: number | null
  email: string | null
  stage: Stage
  owner: string | null
  notes: string | null
  archived: boolean
  code: string | null
  signups?: number
  subscribers?: number
  pending_cents?: number
  payable_cents?: number
  paid_cents?: number
}

// Size tiers. Derived from follower count rather than stored, so correcting a
// follower number instantly recategorises them.
function tierOf(f: number | null) {
  if (f == null) return { id: 'unknown', label: 'Unknown', color: '#6b6b6b' }
  if (f < 10_000) return { id: 'small', label: 'Small niche', color: '#3E9DBF' }
  if (f < 100_000) return { id: 'medium', label: 'Medium', color: '#B98A35' }
  return { id: 'large', label: 'Large 100k+', color: '#8B6BD9' }
}

const money = (c?: number) => `$${((c ?? 0) / 100).toFixed(2)}`
const fmtFollowers = (f: number | null) =>
  f == null ? '—' : f >= 1000 ? `${(f / 1000).toFixed(f >= 10_000 ? 0 : 1)}k` : String(f)

// Stable colour per handle so the same person is always the same colour —
// it's what makes a long list scannable without avatars.
function hue(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

export default function PipelinePage() {
  const [secret, setSecret] = useState('')
  const [creators, setCreators] = useState<Creator[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [q, setQ] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)

  const [add, setAdd] = useState({ name: '', instagram_handle: '', followers: '', owner: '', notes: '' })

  useEffect(() => { setSecret(localStorage.getItem(KEY) ?? '') }, [])

  const load = useCallback(async (s: string) => {
    if (!s) return
    setError(null)
    const res = await fetch('/api/admin/pipeline', { headers: { Authorization: `Bearer ${s}` } })
    if (!res.ok) { setError('Wrong secret, or the server rejected it.'); setCreators(null); return }
    setCreators((await res.json()).creators ?? [])
    localStorage.setItem(KEY, s)
  }, [])

  useEffect(() => { if (secret) load(secret) }, [secret, load])

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true)
    const res = await fetch('/api/admin/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
    })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(out.error ?? 'Update failed'); return false }
    await load(secret)
    return true
  }

  const create = async () => {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(add),
    })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(out.error ?? 'Could not add'); return }
    setAdd({ name: '', instagram_handle: '', followers: '', owner: '', notes: '' })
    load(secret)
  }

  const issueCode = async (c: Creator) => {
    const suggested = (c.instagram_handle ?? c.name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    const code = prompt(`Referral code for ${c.name}:`, suggested)
    if (!code) return
    await patch({ id: c.id, action: 'issue_code', code })
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (creators ?? []).filter(c => {
      if (c.archived !== showArchived) return false
      if (tierFilter !== 'all' && tierOf(c.followers).id !== tierFilter) return false
      if (ownerFilter !== 'all' && (c.owner ?? '') !== (ownerFilter === 'none' ? '' : ownerFilter)) return false
      if (!needle) return true
      return c.name.toLowerCase().includes(needle) || (c.instagram_handle ?? '').includes(needle)
    })
  }, [creators, q, tierFilter, ownerFilter, showArchived])

  const input = {
    padding: '9px 12px', borderRadius: 9, background: '#181818',
    border: '1px solid #2a2a2a', color: '#fff', fontSize: 13.5, outline: 'none',
  } as const

  return (
    <main style={{ minHeight: '100dvh', background: '#0A0A0A', color: '#F0EBE3', fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Creator pipeline</h1>
          <a href="/admin/creators" style={{ fontSize: 13, color: '#3E9DBF' }}>Codes &amp; payouts →</a>
        </div>
        <p style={{ color: 'rgba(240,235,227,0.45)', fontSize: 14, marginTop: 4 }}>
          Everyone we&rsquo;ve talked to, where it stands, and who&rsquo;s chasing it.
        </p>

        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Admin secret"
          style={{ ...input, marginTop: 14, width: 260 }} />
        {error && <p style={{ color: '#FF6B6B', fontSize: 13.5 }}>{error}</p>}

        {creators && (
          <>
            {/* Add */}
            <section style={{ marginTop: 22, background: '#111', border: '1px solid #222', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={add.instagram_handle} onChange={e => setAdd(a => ({ ...a, instagram_handle: e.target.value }))}
                  placeholder="@handle" style={{ ...input, width: 170 }} />
                <input value={add.name} onChange={e => setAdd(a => ({ ...a, name: e.target.value }))}
                  placeholder="Name" style={{ ...input, width: 170 }} />
                <input value={add.followers} onChange={e => setAdd(a => ({ ...a, followers: e.target.value }))}
                  placeholder="Followers" style={{ ...input, width: 110 }} />
                <select value={add.owner} onChange={e => setAdd(a => ({ ...a, owner: e.target.value }))} style={{ ...input, width: 130 }}>
                  <option value="">Unassigned</option>
                  {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input value={add.notes} onChange={e => setAdd(a => ({ ...a, notes: e.target.value }))}
                  placeholder="Notes" style={{ ...input, flex: 1, minWidth: 160 }} />
                <button onClick={create} disabled={busy || (!add.name && !add.instagram_handle)}
                  style={{ padding: '9px 18px', borderRadius: 9, background: '#F0EBE3', color: '#000', fontWeight: 700, fontSize: 13.5, border: 'none', opacity: busy || (!add.name && !add.instagram_handle) ? 0.4 : 1 }}>
                  Add
                </button>
              </div>
            </section>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or @handle"
                style={{ ...input, width: 230 }} />
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={{ ...input }}>
                <option value="all">All sizes</option>
                <option value="small">Small niche (under 10k)</option>
                <option value="medium">Medium (10k–100k)</option>
                <option value="large">Large (100k+)</option>
                <option value="unknown">Unknown</option>
              </select>
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ ...input }}>
                <option value="all">Anyone</option>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="none">Unassigned</option>
              </select>
              <button onClick={() => setShowArchived(v => !v)}
                style={{ ...input, cursor: 'pointer', color: showArchived ? '#F0EBE3' : 'rgba(240,235,227,0.5)' }}>
                {showArchived ? 'Viewing archived' : 'Show archived'}
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(240,235,227,0.4)' }}>
                {visible.length} shown · {creators.filter(c => !c.archived).length} active
              </span>
            </div>

            {/* Stages */}
            {STAGES.map(stage => {
              const inStage = visible.filter(c => c.stage === stage.id)
              return (
                <section key={stage.id} style={{ marginTop: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 750, margin: 0 }}>{stage.label}</h2>
                    <span style={{ fontSize: 13, color: 'rgba(240,235,227,0.4)', fontVariantNumeric: 'tabular-nums' }}>{inStage.length}</span>
                    <span style={{ fontSize: 12.5, color: 'rgba(240,235,227,0.25)' }}>{stage.hint}</span>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {inStage.map(c => {
                      const tier = tierOf(c.followers)
                      const handle = c.instagram_handle
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#111', border: '1px solid #1e1e1e', borderRadius: 11, padding: '10px 14px', flexWrap: 'wrap' }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 17, flexShrink: 0, display: 'grid', placeItems: 'center',
                            background: `hsl(${hue(handle ?? c.name)} 45% 22%)`, color: `hsl(${hue(handle ?? c.name)} 70% 78%)`,
                            fontWeight: 800, fontSize: 13,
                          }}>
                            {(c.name || handle || '?').slice(0, 2).toUpperCase()}
                          </div>

                          <div style={{ minWidth: 190 }}>
                            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 650 }}>{c.name}</p>
                            {handle && (
                              <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 13, color: '#3E9DBF', textDecoration: 'none' }}>
                                @{handle} ↗
                              </a>
                            )}
                          </div>

                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: tier.color, background: `${tier.color}1f`, whiteSpace: 'nowrap' }}>
                            {fmtFollowers(c.followers)} · {tier.label}
                          </span>

                          <select value={c.owner ?? ''} onChange={e => patch({ id: c.id, owner: e.target.value })} disabled={busy}
                            title="Who's chasing this one"
                            style={{ ...input, padding: '5px 8px', fontSize: 12.5, width: 118 }}>
                            <option value="">Unassigned</option>
                            {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>

                          {c.code ? (
                            <span style={{ fontSize: 12.5, color: 'rgba(240,235,227,0.75)', fontVariantNumeric: 'tabular-nums' }}>
                              <strong style={{ letterSpacing: '0.05em' }}>{c.code}</strong>
                              {' · '}{c.signups ?? 0} signups · {c.subscribers ?? 0} subs · {money(c.payable_cents)} ready
                            </span>
                          ) : stage.id === 'working' ? (
                            <button onClick={() => issueCode(c)} disabled={busy}
                              style={{ ...input, cursor: 'pointer', padding: '5px 10px', fontSize: 12.5, color: '#F0EBE3' }}>
                              Issue code
                            </button>
                          ) : null}

                          {c.notes && <span style={{ fontSize: 12.5, color: 'rgba(240,235,227,0.3)', flex: 1, minWidth: 100 }}>{c.notes}</span>}

                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            <select value={c.stage} onChange={e => patch({ id: c.id, stage: e.target.value })} disabled={busy}
                              style={{ ...input, padding: '5px 8px', fontSize: 12.5 }}>
                              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <button onClick={() => patch({ id: c.id, archived: !c.archived })} disabled={busy}
                              title={c.archived ? 'Restore' : 'Archive — not a fit'}
                              style={{ ...input, cursor: 'pointer', padding: '5px 9px', fontSize: 12.5, color: 'rgba(240,235,227,0.45)' }}>
                              {c.archived ? '↺' : '×'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {!inStage.length && (
                      <p style={{ color: 'rgba(240,235,227,0.25)', fontSize: 13, padding: '6px 2px' }}>Nobody here yet.</p>
                    )}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}
