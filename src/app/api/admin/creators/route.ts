export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin control panel for the creator referral programme: roster + earnings,
// issuing codes, and marking payouts. This exposes every creator's earnings
// and can create codes, so it must never be reachable from the client.
//
// Prefers a dedicated ADMIN_SECRET, falling back to BROADCAST_SECRET so the
// route still works if the dedicated one is ever missing. Kept separate on
// purpose: rotating the admin password shouldn't break the push-broadcast
// tooling, and vice versa.
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.BROADCAST_SECRET

function authed(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  return !!ADMIN_SECRET && token === ADMIN_SECRET
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Roster with per-creator totals. */
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = admin()

  const { data: codes } = await db
    .from('creator_codes')
    .select('id, code, creator_name, creator_handle, email, payout_method, commission_rate, status, created_at')
    .order('created_at', { ascending: false })

  const { data: referrals } = await db.from('creator_referrals').select('code_id, user_id')
  const { data: commissions } = await db
    .from('creator_commissions')
    .select('code_id, user_id, commission_cents, net_cents, payable_after, paid_at, voided_at')

  const now = Date.now()
  const rows = (codes ?? []).map((c: any) => {
    const signupIds = (referrals ?? []).filter((r: any) => r.code_id === c.id).map((r: any) => r.user_id)
    const mine = (commissions ?? []).filter((m: any) => m.code_id === c.id && !m.voided_at)
    const subscribers = new Set(mine.map((m: any) => m.user_id)).size

    const sum = (rs: any[]) => rs.reduce((t, r) => t + (r.commission_cents ?? 0), 0)
    const pending = sum(mine.filter((m: any) => !m.paid_at && new Date(m.payable_after).getTime() > now))
    const payable = sum(mine.filter((m: any) => !m.paid_at && new Date(m.payable_after).getTime() <= now))
    const paid = sum(mine.filter((m: any) => !!m.paid_at))

    return {
      ...c,
      signups: signupIds.length,
      subscribers,
      // Signup → subscriber, which is the number that tells you whether a
      // creator's audience is actually a fit rather than just large.
      conversion: signupIds.length ? +(100 * subscribers / signupIds.length).toFixed(1) : 0,
      revenue_cents: mine.reduce((t: number, m: any) => t + (m.net_cents ?? 0), 0),
      pending_cents: pending,
      payable_cents: payable,
      paid_cents: paid,
    }
  })

  return NextResponse.json({ creators: rows })
}

/** Create a code. */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim().toUpperCase()
  const creator_name = String(body.creator_name ?? '').trim()
  if (!code || !creator_name) {
    return NextResponse.json({ error: 'code and creator_name are required' }, { status: 400 })
  }

  const { data, error } = await admin().from('creator_codes').insert({
    code,
    creator_name,
    creator_handle: body.creator_handle ?? null,
    email: body.email ?? null,
    payout_method: body.payout_method ?? null,
    commission_rate: body.commission_rate ?? 0.15,
  }).select().single()

  if (error) {
    const msg = (error as any).code === '23505' ? 'That code already exists.' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true, creator: data })
}

/**
 * Mark a creator's payable commissions as paid, or change their status/rate.
 * Paying stamps paid_at on every cleared, unpaid row — which is what makes
 * double-paying impossible even if the button is pressed twice.
 */
export async function PATCH(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const codeId = String(body.code_id ?? '')
  if (!codeId) return NextResponse.json({ error: 'code_id required' }, { status: 400 })
  const db = admin()

  if (body.action === 'mark_paid') {
    const { data, error } = await db
      .from('creator_commissions')
      .update({ paid_at: new Date().toISOString() })
      .eq('code_id', codeId)
      .is('paid_at', null)
      .is('voided_at', null)
      .lte('payable_after', new Date().toISOString())
      .select('commission_cents')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const total = (data ?? []).reduce((t: number, r: any) => t + r.commission_cents, 0)
    return NextResponse.json({ ok: true, rows: data?.length ?? 0, total_cents: total })
  }

  const patch: Record<string, unknown> = {}
  if (body.status) patch.status = body.status
  if (body.commission_rate !== undefined) patch.commission_rate = body.commission_rate
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const { error } = await db.from('creator_codes').update(patch).eq('id', codeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
