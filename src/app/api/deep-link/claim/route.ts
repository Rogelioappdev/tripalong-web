export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  clientIp, hashIp, deviceHint, matchScore, CLAIM_WINDOW_MINUTES,
} from '@/lib/deepLinkServer'

/**
 * Called once by a freshly installed app: "did this device tap a trip link
 * before it had me installed?"
 *
 * This works only because the app is a WebView wrapper — the web layer runs
 * on the same device and the same network as the browser that tapped the
 * link, so the request arrives from the same address. A fully native client
 * would need this call made from native code to get the same match.
 *
 * Returns a trip id or nothing. It deliberately cannot return anything else:
 * a fingerprint match is a guess about a device, never an authentication of
 * a person, so the result is only ever used to choose which public trip card
 * to show first. Joining that trip still requires the user to tap Join as
 * themselves.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (!ip) return NextResponse.json({ trip_id: null })

  const body = await req.json().catch(() => ({}))
  const hint = deviceHint(body)

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const since = new Date(Date.now() - CLAIM_WINDOW_MINUTES * 60_000).toISOString()
  const { data: rows } = await db
    .from('deep_link_clicks')
    .select('id, trip_id, platform, tz, lang, screen, created_at')
    .eq('ip_hash', hashIp(ip))
    .is('claimed_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!rows?.length) return NextResponse.json({ trip_id: null })

  // Best device match wins; recency breaks ties, since rows are already
  // sorted newest-first and this sort is stable.
  const best = [...rows].sort((a, b) => matchScore(b, hint) - matchScore(a, hint))[0]

  // Claim it before returning. This is what makes the call idempotent-ish:
  // a retry, a refresh mid-onboarding, or a second device on the same WiFi
  // won't be handed the same click again.
  const { data: claimed } = await db
    .from('deep_link_clicks')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', (best as any).id)
    .is('claimed_at', null)
    .select('trip_id')
    .maybeSingle()

  // Lost the race to a concurrent claim — correct outcome is nothing.
  if (!claimed) return NextResponse.json({ trip_id: null })

  // Only hand back a trip that still exists and is actually visible, so we
  // never route someone into a dead or deleted card as their first screen.
  const { data: trip } = await db
    .from('trips')
    .select('id')
    .eq('id', (claimed as any).trip_id)
    .maybeSingle()

  return NextResponse.json({ trip_id: trip ? (claimed as any).trip_id : null })
}
