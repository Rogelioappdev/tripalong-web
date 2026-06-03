export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const subscription = event.data.object as Stripe.Subscription

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = subscription.metadata?.supabase_user_id
      const tier = (subscription.metadata?.tier as 'plus' | 'pro') ?? 'plus'
      if (!userId) break

      const isActive = ['active', 'trialing'].includes(subscription.status)
      await supabaseAdmin.from('users').update({
        subscription_tier: isActive ? tier : 'free',
        subscription_status: subscription.status,
        subscription_expires_at: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
      }).eq('id', userId)
      break
    }

    case 'customer.subscription.deleted': {
      const userId = subscription.metadata?.supabase_user_id
      if (!userId) break
      await supabaseAdmin.from('users').update({
        subscription_tier: 'free',
        subscription_status: 'canceled',
        subscription_expires_at: null,
      }).eq('id', userId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
