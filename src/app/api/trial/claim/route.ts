export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let userId: string
  try {
    const body = await req.json()
    userId = body.userId
    if (!userId || typeof userId !== 'string') throw new Error('missing userId')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Verify the userId is a real user
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('trial_start_at, subscription_tier')
    .eq('id', userId)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Already claimed — idempotent success
  if (existing.trial_start_at) {
    return NextResponse.json({ trial_start_at: existing.trial_start_at })
  }

  // Already a paid subscriber
  if (existing.subscription_tier === 'plus' || existing.subscription_tier === 'pro') {
    return NextResponse.json({ trial_start_at: null, already_paid: true })
  }

  const trial_start_at = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('users')
    .update({ trial_start_at })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to claim trial' }, { status: 500 })
  }

  return NextResponse.json({ trial_start_at })
}
