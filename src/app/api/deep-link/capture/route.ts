export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientIp, hashIp, deviceHint, CLAIM_WINDOW_MINUTES } from '@/lib/deepLinkServer'

/**
 * Records that someone looked at a trip immediately before leaving for the
 * App Store, so /api/deep-link/claim can find it again after they install.
 *
 * Unauthenticated by necessity — the whole point is that this fires before
 * the person has an account. It writes nothing a caller can read back and
 * grants nothing, so the worst case of a junk row is one wasted match.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const tripId = String(body?.trip_id ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const ip = clientIp(req)
  // No address means no matching key, so there is nothing worth storing.
  if (!ip) return NextResponse.json({ ok: false })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ipHash = hashIp(ip)
  const hint = deviceHint(body)

  // Supersede this device's own earlier unclaimed clicks. Without this,
  // browsing three trips and installing would leave the oldest tap as a
  // plausible match — the intent that actually sent them to the App Store is
  // always the most recent one.
  await db.from('deep_link_clicks')
    .update({ claimed_at: new Date().toISOString() })
    .eq('ip_hash', ipHash)
    .is('claimed_at', null)

  const { error } = await db.from('deep_link_clicks').insert({
    trip_id: tripId,
    ip_hash: ipHash,
    ...hint,
  })

  // A foreign-key violation just means the trip was deleted between the page
  // rendering and the tap. Nothing to tell the client either way — it's
  // already navigating to the App Store.
  if (error) return NextResponse.json({ ok: false })

  // Opportunistic retention sweep, so this never needs its own cron. These
  // rows are dead well before the window closes.
  const cutoff = new Date(Date.now() - CLAIM_WINDOW_MINUTES * 60_000 * 2).toISOString()
  await db.from('deep_link_clicks').delete().lt('created_at', cutoff)

  return NextResponse.json({ ok: true })
}
