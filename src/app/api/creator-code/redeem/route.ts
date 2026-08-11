export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Binds a signing-up user to a creator's referral code. This is NOT the same
// thing as /api/redeem-creator-code — that one is a single-use code granting a
// creator free Plus for themselves. This one is multi-use and attributes an
// audience, which is what commission is calculated from.
//
// Auth uses the verified session token rather than a client-supplied userId:
// attribution decides who gets paid, so it has to be the person actually
// signed in.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = (await req.json().catch(() => ({})))?.code
  if (typeof raw !== 'string' || !raw.trim()) {
    return NextResponse.json({ error: 'Enter a code' }, { status: 400 })
  }
  // Codes are handed out and typed (or pasted) by humans off a video, so
  // normalise hard: uppercase and strip everything that isn't A-Z0-9. That
  // covers spaces, stray punctuation, and invisible characters picked up by
  // copy-paste — a real failure the first time this was used, where a code
  // pasted out of a formatted table arrived as "| TESTMAYA".
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!code) return NextResponse.json({ error: 'Enter a code' }, { status: 400 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: creator } = await admin
    .from('creator_codes')
    .select('id, code, creator_name, email, status')
    .eq('code', code)
    .maybeSingle()

  if (!creator || creator.status !== 'active') {
    return NextResponse.json({ error: "That code doesn't look right." }, { status: 404 })
  }

  // No paying someone for referring themselves.
  if (creator.email && user.email && creator.email.toLowerCase() === user.email.toLowerCase()) {
    return NextResponse.json({ error: "You can't use your own code." }, { status: 400 })
  }

  // First touch wins, permanently. If a row already exists we return success
  // rather than an error — the user did nothing wrong, and telling them "you
  // already have a code" mid-onboarding is noise. But we never reassign.
  const { data: existing } = await admin
    .from('creator_referrals')
    .select('code_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, alreadyAttributed: true })
  }

  const { error } = await admin
    .from('creator_referrals')
    .insert({ user_id: user.id, code_id: creator.id })

  if (error) {
    // Unique violation = a concurrent request won the race. Same outcome.
    if ((error as any).code === '23505') return NextResponse.json({ ok: true, alreadyAttributed: true })
    return NextResponse.json({ error: 'Could not apply that code. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, creatorName: creator.creator_name })
}
