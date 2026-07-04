export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { planKey, userId, email } = await req.json() as {
      planKey: PlanKey
      userId: string
      email: string
    }

    const plan = PLANS[planKey]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    // Get or create Stripe customer
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    let customerId = profile?.stripe_customer_id

    const createCustomer = async () => {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      })
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId)
      return customer.id
    }

    if (!customerId) customerId = await createCustomer()

    const origin = req.headers.get('origin') ?? 'https://tripalong.app'
    const createSession = (customer: string) => stripe.checkout.sessions.create({
      customer,
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${origin}/feed?upgrade=success&plan=${planKey}`,
      cancel_url: `${origin}/feed?upgrade=cancelled`,
      subscription_data: {
        metadata: { supabase_user_id: userId, tier: plan.tier },
      },
      allow_promotion_codes: true,
    })

    let session
    try {
      session = await createSession(customerId)
    } catch (err: any) {
      // Stored ID may belong to a different Stripe account/mode (e.g. test-mode
      // ID left over from before a live-mode cutover) — self-heal once instead
      // of paying an extra round-trip to pre-verify on every checkout.
      if (err?.code === 'resource_missing' && err?.param === 'customer') {
        customerId = await createCustomer()
        session = await createSession(customerId)
      } else {
        throw err
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
