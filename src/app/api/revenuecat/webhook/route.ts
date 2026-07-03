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
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!AUTH_HEADER_SECRET || authHeader !== `Bearer ${AUTH_HEADER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const event: RevenueCatEvent | undefined = body?.event
  if (!event?.app_user_id) {
    return NextResponse.json({ received: true })
  }

  // Ignore events for entitlements other than Plus (e.g. if more are added later).
  if (event.entitlement_ids && !event.entitlement_ids.includes(PLUS_ENTITLEMENT_ID)) {
    return NextResponse.json({ received: true })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (ACTIVE_EVENT_TYPES.has(event.type)) {
    await supabaseAdmin.from('users').update({
      subscription_tier: 'plus',
      subscription_status: 'active',
      subscription_expires_at: event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null,
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
    }).eq('id', event.app_user_id)
  } else if (event.type === 'BILLING_ISSUE') {
    await supabaseAdmin.from('users').update({
      subscription_status: 'billing_issue',
    }).eq('id', event.app_user_id)
  }

  return NextResponse.json({ received: true })
}
