export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Ends time-limited creator comps.
//
// This exists because nothing else can end one. Entitlement across the app is
// read as `subscription_tier === 'plus' | 'pro'` (src/lib/trial.ts) —
// subscription_expires_at is never consulted at read time. Paying subscribers
// get downgraded by the Stripe/RevenueCat webhooks when their subscription
// actually lapses, but a comped account has no upstream billing system and so
// no webhook is ever coming for it. Without this sweep, a "one year free"
// code would silently be free forever.
//
// Deliberately NOT solved by making hasPlus() check the expiry date instead:
// that would put every paying subscriber at the mercy of a stale
// subscription_expires_at, so a late renewal webhook would lock a real
// customer out of something they'd paid for. This job can only ever touch
// rows explicitly marked 'creator_comp', which no billing rail ever writes.

export async function GET(req: NextRequest) {
  // Same auth as the other crons: Vercel Cron sends this header, a manual
  // curl needs the same secret, and an unset CRON_SECRET means the route
  // refuses to run rather than sitting open — it downgrades real accounts.
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const nowIso = new Date().toISOString()

  // Scoped three ways on purpose: only comps, only ones with an actual end
  // date (permanent comps have null and must never match), only ones already
  // past it. A paying subscriber can never satisfy the status filter.
  const { data: expired, error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'free',
      // Distinct from 'creator_comp' so the sweep is idempotent — a row it
      // has already handled can't match again on the next run — and so an
      // expired comp stays visibly different from a normal cancellation when
      // auditing later.
      subscription_status: 'creator_comp_expired',
      subscription_expires_at: null,
    })
    .eq('subscription_status', 'creator_comp')
    .not('subscription_expires_at', 'is', null)
    .lte('subscription_expires_at', nowIso)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expired: expired?.length ?? 0 })
}
