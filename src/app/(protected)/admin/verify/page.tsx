'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type VerificationRow = {
  id: string
  user_id: string
  selfie_path: string
  selfieUrl: string | null
  ai_label: 'match' | 'mismatch' | 'unclear' | null
  ai_notes: string | null
  created_at: string
  user: { id: string; name: string; profile_photo: string | null; photos: string[] } | null
}

type Counts = { pending: number; match: number; mismatch: number; unclear: number; unlabeled: number }

const LABEL_COLOR: Record<string, string> = {
  match: '#30D158',
  mismatch: '#FF453A',
  unclear: '#FFD60A',
}

// Internal-only review queue — gated server-side by is_admin (see
// src/app/api/admin/verify-review/route.ts), not by anything client-visible.
// Every row here is human-decided; ai_label/ai_notes (from the daily Claude
// triage cron) are shown only as a hint to speed up the decision.
export default function AdminVerifyPage() {
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [rows, setRows] = useState<VerificationRow[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setForbidden(true); setLoading(false); return }
    const res = await fetch('/api/admin/verify-review', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.status === 401 || res.status === 403) { setForbidden(true); setLoading(false); return }
    const data = await res.json()
    setRows(data.rows ?? [])
    setCounts(data.counts ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const decide = async (verificationId: string, decision: 'verified' | 'rejected') => {
    setDecidingId(verificationId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin/verify-review/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ verificationId, decision }),
    })
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== verificationId))
      setCounts(prev => prev ? { ...prev, pending: prev.pending - 1 } : prev)
    }
    setDecidingId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    )
  }

  if (forbidden) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-6 text-center">
        <p className="text-white/40 text-sm">Not authorized.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}>
      <div className="max-w-2xl mx-auto px-5 flex flex-col gap-6">
        <div>
          <h1 className="text-white font-extrabold text-2xl mb-3">Photo Verification Queue</h1>
          {counts && (
            <div className="flex flex-wrap gap-2">
              <Pill label={`${counts.pending} pending`} color="#F0EBE3" />
              {counts.unclear > 0 && <Pill label={`${counts.unclear} need a closer look`} color={LABEL_COLOR.unclear} />}
              {counts.match > 0 && <Pill label={`${counts.match} likely match`} color={LABEL_COLOR.match} />}
              {counts.mismatch > 0 && <Pill label={`${counts.mismatch} likely mismatch`} color={LABEL_COLOR.mismatch} />}
              {counts.unlabeled > 0 && <Pill label={`${counts.unlabeled} not yet triaged`} color="rgba(255,255,255,0.4)" />}
            </div>
          )}
        </div>

        {rows.length === 0 && (
          <p className="text-white/30 text-sm">Nothing pending — you're caught up.</p>
        )}

        {rows.map(row => (
          <div key={row.id} className="rounded-3xl p-4 flex flex-col gap-3" style={{ backgroundColor: '#0D0D0D', border: '0.5px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-sm">{row.user?.name ?? row.user_id}</p>
              {row.ai_label && (
                <span className="text-xs font-bold rounded-full px-2.5 py-1" style={{ color: LABEL_COLOR[row.ai_label], backgroundColor: `${LABEL_COLOR[row.ai_label]}1A` }}>
                  AI: {row.ai_label}
                </span>
              )}
            </div>

            {row.ai_notes && <p className="text-white/40 text-xs leading-relaxed">{row.ai_notes}</p>}

            <div className="flex gap-2 overflow-x-auto">
              <ImgCol label="Live selfie" url={row.selfieUrl} />
              <ImgCol label="Profile photo" url={row.user?.profile_photo ?? null} />
              {(row.user?.photos ?? []).slice(0, 4).map((url, i) => (
                <ImgCol key={url} label={`Photo ${i + 1}`} url={url} />
              ))}
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => decide(row.id, 'rejected')}
                disabled={decidingId === row.id}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ backgroundColor: 'rgba(255,69,58,0.12)', color: '#FF453A', border: '0.5px solid rgba(255,69,58,0.3)' }}
              >
                Reject
              </button>
              <button
                onClick={() => decide(row.id, 'verified')}
                disabled={decidingId === row.id}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ backgroundColor: '#F0EBE3', color: '#000' }}
              >
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-xs font-bold rounded-full px-3 py-1.5" style={{ color, backgroundColor: `${color}1A`, border: `0.5px solid ${color}40` }}>
      {label}
    </span>
  )
}

function ImgCol({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="shrink-0 flex flex-col gap-1">
      <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white/6 flex items-center justify-center">
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-white/20 text-xs">—</span>}
      </div>
      <span className="text-white/30 text-[10px] text-center">{label}</span>
    </div>
  )
}
