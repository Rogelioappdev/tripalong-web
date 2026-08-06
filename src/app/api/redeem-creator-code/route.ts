export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Redeems a one-time "Are you a TripAlong Content Creator?" code (Settings ->
// About) into a permanent, free TripAlong+ grant. Codes are stored as SHA-256
// hashes only (creator_access_codes.code_hash) — the raw code is never
// written anywhere after being generated and handed to whoever it's given
// to, so it can't be read back out of the database by anyone, including us.
//
// Auth uses a verified session token (not a client-supplied userId, unlike
// trial/claim/route.ts) since this grants real ongoing value and must only
// ever apply to whoever is actually signed in and submitting the code.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json().catch(() => ({ code: null }))
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Single atomic UPDATE ... WHERE unredeemed-and-not-revoked ... RETURNING —
  // if two requests raced to redeem the same code simultaneously, Postgres's
  // row-level locking means only one UPDATE can actually match and return a
  // row; the other sees an empty result, exactly like a code that was never
  // valid. No separate "check then claim" step that a race could slip
  // between.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('creator_access_codes')
    .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
    .eq('code_hash', codeHash)
    .is('redeemed_by', null)
    .eq('revoked', false)
    .select('id')
    .maybeSingle()

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  if (!claimed) return NextResponse.json({ error: 'Invalid or already-used code' }, { status: 400 })

  // Permanent, free Plus — subscription_status is a marker distinct from any
  // real Stripe/RevenueCat status string, so this is easy to find/audit
  // later and never gets treated as "Canceling" by the Settings UI (which
  // only special-cases the literal 'canceled' status). No expiry: only ever
  // ends if manually revoked/downgraded by hand.
  const { error: grantError } = await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'plus',
      subscription_status: 'creator_comp',
      subscription_expires_at: null,
    })
    .eq('id', user.id)

  if (grantError) return NextResponse.json({ error: grantError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
