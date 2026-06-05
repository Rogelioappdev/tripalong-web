export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  // Verify the caller is authenticated
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role to read + write — bypasses RLS safely on the server
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if trial already claimed — prevents re-claiming after expiry
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('trial_start_at, subscription_tier')
    .eq('id', user.id)
    .single()

  if (existing?.trial_start_at) {
    return NextResponse.json({ error: 'Trial already claimed' }, { status: 409 })
  }
  if (existing?.subscription_tier === 'plus' || existing?.subscription_tier === 'pro') {
    return NextResponse.json({ error: 'Already a paid subscriber' }, { status: 409 })
  }

  const trial_start_at = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('users')
    .update({ trial_start_at })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to claim trial' }, { status: 500 })
  }

  return NextResponse.json({ trial_start_at })
}
