export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Creator pipeline for the founding team: who we've contacted, where each
// conversation stands, and — for anyone signed — what their code has actually
// produced. Same secret as the rest of /api/admin.
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.BROADCAST_SECRET

function authed(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  return !!ADMIN_SECRET && token === ADMIN_SECRET
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Handles arrive as "@Maya", "maya", or a full profile URL. Store one form. */
function normaliseHandle(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  const fromUrl = s.match(/instagram\.com\/([^/?#]+)/)?.[1]
  return (fromUrl ?? s).replace(/^@+/, '').replace(/[^a-z0-9._]/g, '') || null
}

const STAGES = new Set(['reached_out', 'call_scheduled', 'working'])

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supa = db()

  const { data: creators } = await supa
    .from('creators')
    .select('*')
    .order('created_at', { ascending: false })

  // Attach code + live performance for anyone who's signed.
  const { data: codes } = await supa
    .from('creator_codes')
    .select('id, code, creator_id, commission_rate, status')
  const { data: referrals } = await supa.from('creator_referrals').select('code_id')
  const { data: commissions } = await supa
    .from('creator_commissions')
    .select('code_id, user_id, commission_cents, payable_after, paid_at, voided_at')

  const now = Date.now()
  const rows = (creators ?? []).map((c: any) => {
    const code = (codes ?? []).find((k: any) => k.creator_id === c.id)
    if (!code) return { ...c, code: null }

    const mine = (commissions ?? []).filter((m: any) => m.code_id === code.id && !m.voided_at)
    const sum = (rs: any[]) => rs.reduce((t, r) => t + (r.commission_cents ?? 0), 0)
    return {
      ...c,
      code: code.code,
      commission_rate: code.commission_rate,
      signups: (referrals ?? []).filter((r: any) => r.code_id === code.id).length,
      subscribers: new Set(mine.map((m: any) => m.user_id)).size,
      pending_cents: sum(mine.filter((m: any) => !m.paid_at && new Date(m.payable_after).getTime() > now)),
      payable_cents: sum(mine.filter((m: any) => !m.paid_at && new Date(m.payable_after).getTime() <= now)),
      paid_cents: sum(mine.filter((m: any) => !!m.paid_at)),
    }
  })

  return NextResponse.json({ creators: rows })
}

/** Add someone to the pipeline. */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  const name = String(body.name ?? '').trim()
  const instagram_handle = normaliseHandle(body.instagram_handle)
  if (!name && !instagram_handle) {
    return NextResponse.json({ error: 'Give at least a name or an Instagram handle.' }, { status: 400 })
  }

  const followersRaw = String(body.followers ?? '').replace(/[^0-9]/g, '')
  const { data, error } = await db().from('creators').insert({
    name: name || `@${instagram_handle}`,
    instagram_handle,
    followers: followersRaw ? parseInt(followersRaw, 10) : null,
    email: String(body.email ?? '').trim() || null,
    owner: String(body.owner ?? '').trim() || null,
    notes: String(body.notes ?? '').trim() || null,
    stage: STAGES.has(body.stage) ? body.stage : 'reached_out',
  }).select().single()

  if (error) {
    const msg = (error as any).code === '23505'
      ? 'That Instagram handle is already in the pipeline.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true, creator: data })
}

/**
 * Update one creator — stage, owner, archive, details — or issue them a
 * referral code, which is what "signed" actually means in practice.
 */
export async function PATCH(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supa = db()

  if (body.action === 'issue_code') {
    const code = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code) return NextResponse.json({ error: 'A code is required.' }, { status: 400 })

    const { data: creator } = await supa
      .from('creators').select('name, email, payout_method').eq('id', id).maybeSingle()
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    const { error } = await supa.from('creator_codes').insert({
      code,
      creator_id: id,
      creator_name: (creator as any).name,
      email: (creator as any).email,
      payout_method: (creator as any).payout_method,
      commission_rate: body.commission_rate ?? 0.15,
    })
    if (error) {
      const msg = (error as any).code === '23505' ? 'That code is already taken.' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    // Issuing a code IS signing them, so move the stage too.
    await supa.from('creators').update({ stage: 'working', updated_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.stage && STAGES.has(body.stage)) patch.stage = body.stage
  if (body.owner !== undefined) patch.owner = String(body.owner ?? '').trim() || null
  if (body.archived !== undefined) patch.archived = !!body.archived
  if (body.notes !== undefined) patch.notes = String(body.notes ?? '').trim() || null
  if (body.call_at !== undefined) patch.call_at = body.call_at || null
  if (body.email !== undefined) patch.email = String(body.email ?? '').trim() || null
  if (body.payout_method !== undefined) patch.payout_method = String(body.payout_method ?? '').trim() || null
  if (body.followers !== undefined) {
    const f = String(body.followers ?? '').replace(/[^0-9]/g, '')
    patch.followers = f ? parseInt(f, 10) : null
  }
  if (body.instagram_handle !== undefined) patch.instagram_handle = normaliseHandle(body.instagram_handle)

  const { error } = await supa.from('creators').update(patch).eq('id', id)
  if (error) {
    const msg = (error as any).code === '23505' ? 'That handle belongs to someone else already.' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
