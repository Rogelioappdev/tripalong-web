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
  // Used for creator commission. RevenueCat sends the real transacted price
  // and the store's take-home share, so we record what actually happened
  // (including non-USD prices and promotional pricing) rather than assuming
  // list price and a 15% Apple cut. Both are optional — see the fallback in
  // recordCreatorCommission.
  id?: string
  price?: number
  currency?: string
  takehome_percentage?: number
  product_id?: string
}

// Commission is only ever paid on money that actually changed hands, and only
// for the first 12 months after a referred user's first purchase.
const COMMISSION_WINDOW_MONTHS = 12
const REFUND_HOLD_DAYS = 30
// Fallback list prices in cents, used only if RevenueCat omits `price`.
const FALLBACK_PRICE_CENTS: Record<string, number> = {
  annual: 3999, yearly: 3999, monthly: 699, weekly: 699,
}
const FALLBACK_TAKEHOME = 0.85 // Apple Small Business Program

/**
 * Writes a commission row when a referred user pays. Deliberately
 * fire-and-forget from the caller's perspective: a failure here must never
 * break subscription state, which is what the rest of this webhook exists to
 * keep correct.
 */
async function recordCreatorCommission(
  // Loosely typed on purpose: ReturnType<typeof createClient> resolves its
  // generics to a schema that doesn't know the creator_* tables, which makes
  // .insert() infer never[] and fails the build. There are no generated
  // database types in this project to import instead.
  admin: any,
  event: RevenueCatEvent,
) {
  try {
    // A trial start is not revenue. Only NORMAL/INTRO periods have money.
    if (event.period_type === 'TRIAL') return
    if (!event.app_user_id) return

    const { data: referral } = await admin
      .from('creator_referrals')
      .select('code_id')
      .eq('user_id', event.app_user_id)
      .maybeSingle()
    if (!referral) return

    const { data: creator } = await admin
      .from('creator_codes')
      .select('id, commission_rate, status')
      .eq('id', (referral as any).code_id)
      .maybeSingle()
    if (!creator || (creator as any).status === 'revoked') return

    // Enforce the 12-month window from this user's FIRST attributed purchase.
    const { data: firstRow } = await admin
      .from('creator_commissions')
      .select('purchased_at')
      .eq('user_id', event.app_user_id)
      .order('purchased_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (firstRow) {
      const first = new Date((firstRow as any).purchased_at)
      const cutoff = new Date(first)
      cutoff.setMonth(cutoff.getMonth() + COMMISSION_WINDOW_MONTHS)
      if (new Date() > cutoff) return
    }

    const product = (event.product_id ?? '').toLowerCase()
    const fallbackKey = Object.keys(FALLBACK_PRICE_CENTS).find(k => product.includes(k))
    const grossCents = typeof event.price === 'number' && event.price > 0
      ? Math.round(event.price * 100)
      : (fallbackKey ? FALLBACK_PRICE_CENTS[fallbackKey] : 0)
    if (!grossCents) return

    const takehome = typeof event.takehome_percentage === 'number' && event.takehome_percentage > 0
      ? event.takehome_percentage
      : FALLBACK_TAKEHOME
    const netCents = Math.round(grossCents * takehome)
    const rate = Number((creator as any).commission_rate ?? 0.15)
    const commissionCents = Math.round(netCents * rate)
    if (commissionCents <= 0) return

    const payableAfter = new Date()
    payableAfter.setDate(payableAfter.getDate() + REFUND_HOLD_DAYS)

    // event_id is unique — a redelivered webhook can't pay twice.
    await admin.from('creator_commissions').insert({
      code_id: (creator as any).id,
      user_id: event.app_user_id,
      event_id: event.id ?? null,
      product: event.product_id ?? null,
      currency: event.currency ?? 'USD',
      gross_cents: grossCents,
      net_cents: netCents,
      rate,
      commission_cents: commissionCents,
      payable_after: payableAfter.toISOString(),
    })
  } catch {
    // Swallow — commission accounting must never take down purchase handling.
  }
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

    // Money changed hands (unless this is the free trial period) — credit the
    // creator who referred this user, if any.
    await recordCreatorCommission(supabaseAdmin, event)
  } else if (event.type === 'CANCELLATION') {
    // Auto-renew turned off, but the entitlement stays active until expiration —
    // EXPIRATION is what actually triggers the downgrade below.
    await supabaseAdmin.from('users').update({
      subscription_status: 'canceled',
    }).eq('id', event.app_user_id)
  } else if (event.type === 'REFUND' || event.type === 'CANCELLATION_REFUND') {
    // Money given back — void any unpaid commission for this user so we don't
    // pay out on revenue we no longer have. Already-paid rows are left alone;
    // clawing back a payout is a human conversation, not an automatic one.
    await supabaseAdmin.from('creator_commissions')
      .update({ voided_at: new Date().toISOString() })
      .eq('user_id', event.app_user_id)
      .is('paid_at', null)
      .is('voided_at', null)
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
