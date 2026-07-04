export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { userId } = await req.json() as { userId: string }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const origin = req.headers.get('origin') ?? 'https://tripalong.app'

    let session
    try {
      session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${origin}/settings`,
      })
    } catch (err: any) {
      // Stored ID may belong to a different Stripe account/mode (e.g. test-mode
      // ID left over from before a live-mode cutover) — nothing to manage there.
      if (err?.code === 'resource_missing' && err?.param === 'customer') {
        return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
      }
      throw err
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Portal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
