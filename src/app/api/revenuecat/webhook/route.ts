export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// RevenueCat webhooks authenticate via a shared secret in the Authorization
// header (configured to match in the RevenueCat dashboard), not HMAC signing
// like Stripe's webhooks.
const AUTH_HEADER_SECRET = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER

// Matches the entitlement identifier in the RevenueCat dashboard
// (Product catalog > Entitlements), attached to all 3 App Store subscription
// products (weekly/monthly/yearly).
const PLUS_ENTITLEMENT_ID = 'TagAlong+'

// Event types where the entitlement becomes (or remains) active.
const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'TRANSFER',
])

interface RevenueCatEvent {
  type: string
  app_user_id: string
  entitlement_ids?: string[]
  expiration_at_ms?: number | null
  // 'TRIAL' while the 3-day introductory offer is running, 'NORMAL' once it
  // converts to a paid period. This is the only reliable way to tell a trial
  // apart from a paid subscription — `subscription_expires_at` alone can't,
  // since a renewing annual sub is also ~24h from expiry once a year, which
  // would otherwise make the trial-ending reminder fire at real subscribers.
  period_type?: string
  // Only present on TRANSFER events — RevenueCat's automatic fix for a
  // purchase that got recorded under the wrong app_user_id (e.g. the app
  // configured the SDK under a stale identity before the real one was
  // known). No app_user_id field is sent on these at all.
  transferred_from?: string[]
  transferred_to?: string[]
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!AUTH_HEADER_SECRET || authHeader !== `Bearer ${AUTH_HEADER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const event: RevenueCatEvent | undefined = body?.event
  if (!event) {
    return NextResponse.json({ received: true })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (event.type === 'TRANSFER') {
    // Move the entitlement to whoever it was transferred to, and downgrade
    // whoever it was mistakenly attached to before — otherwise the source
    // account keeps showing Plus forever and the destination account never
    // gets unlocked, even though RevenueCat itself already fixed the identity.
    for (const id of event.transferred_to ?? []) {
      await supabaseAdmin.from('users').update({
        subscription_tier: 'plus',
        subscription_status: 'active',
      }).eq('id', id)
    }
    const toIds = new Set(event.transferred_to ?? [])
    for (const id of event.transferred_from ?? []) {
      if (toIds.has(id)) continue
      await supabaseAdmin.from('users').update({
        subscription_tier: 'free',
        subscription_status: 'canceled',
        subscription_expires_at: null,
      }).eq('id', id)
    }
    return NextResponse.json({ received: true })
  }

  if (!event.app_user_id) {
    return NextResponse.json({ received: true })
  }

  // Ignore events for entitlements other than Plus (e.g. if more are added later).
  if (event.entitlement_ids && !event.entitlement_ids.includes(PLUS_ENTITLEMENT_ID)) {
    return NextResponse.json({ received: true })
  }

  if (ACTIVE_EVENT_TYPES.has(event.type)) {
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null
    // On a trial, expiration is the trial end date — that's what
    // /api/cron/trial-ending reminds against. Once the period flips to
    // NORMAL (the trial converted) we clear it, so the reminder can never
    // fire at someone who is already a paying subscriber. The sent-marker is
    // cleared alongside it so a genuinely new trial later still gets one.
    const isTrial = event.period_type === 'TRIAL'
    await supabaseAdmin.from('users').update({
      subscription_tier: 'plus',
      subscription_status: 'active',
      subscription_expires_at: expiresAt,
      trial_ends_at: isTrial ? expiresAt : null,
      ...(isTrial ? { trial_reminder_sent_at: null } : {}),
    }).eq('id', event.app_user_id)
  } else if (event.type === 'CANCELLATION') {
    // Auto-renew turned off, but the entitlement stays active until expiration —
    // EXPIRATION is what actually triggers the downgrade below.
    await supabaseAdmin.from('users').update({
      subscription_status: 'canceled',
    }).eq('id', event.app_user_id)
  } else if (event.type === 'EXPIRATION') {
    await supabaseAdmin.from('users').update({
      subscription_tier: 'free',
      subscription_status: 'expired',
      subscription_expires_at: null,
      trial_ends_at: null,
    }).eq('id', event.app_user_id)
  } else if (event.type === 'BILLING_ISSUE') {
    await supabaseAdmin.from('users').update({
      subscription_status: 'billing_issue',
    }).eq('id', event.app_user_id)
  }

  return NextResponse.json({ received: true })
}
