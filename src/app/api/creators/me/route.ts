export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// The creator's own view of their referral performance. Scoped hard to the
// signed-in creator: the only way in is a verified session whose email matches
// a creator_codes row, and the response contains aggregates only.
//
// It deliberately returns NO individual user data and NO TripAlong revenue —
// the people who signed up are real users who never agreed to have their
// activity shown to a marketer, and what the company grosses isn't a
// contractor's business.
export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await anon.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: creator } = await db
    .from('creator_codes')
    .select('id, code, creator_name, commission_rate, status, payout_method')
    .ilike('email', user.email)
    .maybeSingle()

  if (!creator) {
    return NextResponse.json({ error: 'not_a_creator' }, { status: 403 })
  }

  const { count: signups } = await db
    .from('creator_referrals')
    .select('user_id', { count: 'exact', head: true })
    .eq('code_id', (creator as any).id)

  const { data: rows } = await db
    .from('creator_commissions')
    .select('user_id, commission_cents, payable_after, paid_at, voided_at')
    .eq('code_id', (creator as any).id)

  const live = (rows ?? []).filter((r: any) => !r.voided_at)
  const now = Date.now()
  const sum = (rs: any[]) => rs.reduce((t, r) => t + (r.commission_cents ?? 0), 0)

  const subscribers = new Set(live.map((r: any) => r.user_id)).size
  const pending = live.filter((r: any) => !r.paid_at && new Date(r.payable_after).getTime() > now)
  const payable = sum(live.filter((r: any) => !r.paid_at && new Date(r.payable_after).getTime() <= now))
  const paid = sum(live.filter((r: any) => !!r.paid_at))

  // The soonest date any pending money becomes payable — shown so "pending"
  // never feels open-ended.
  const nextClear = pending
    .map((r: any) => new Date(r.payable_after).getTime())
    .sort((a: number, b: number) => a - b)[0] ?? null

  return NextResponse.json({
    code: (creator as any).code,
    creatorName: (creator as any).creator_name,
    rate: Number((creator as any).commission_rate),
    status: (creator as any).status,
    payoutMethod: (creator as any).payout_method,
    signups: signups ?? 0,
    subscribers,
    conversion: signups ? +(100 * subscribers / signups).toFixed(1) : 0,
    pendingCents: sum(pending),
    payableCents: payable,
    paidCents: paid,
    nextClearAt: nextClear ? new Date(nextClear).toISOString() : null,
  })
}
