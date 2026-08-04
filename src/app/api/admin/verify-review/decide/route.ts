export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: reviewer } = await supabaseAdmin.from('users').select('is_admin').eq('id', user.id).single()
  if (!reviewer?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { verificationId, decision } = await req.json()
  if (!verificationId || (decision !== 'verified' && decision !== 'rejected')) {
    return NextResponse.json({ error: 'verificationId and decision (verified|rejected) are required' }, { status: 400 })
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('photo_verifications')
    .select('id, user_id, selfie_path, status')
    .eq('id', verificationId)
    .single()
  if (fetchError || !row) return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
  if (row.status !== 'pending') return NextResponse.json({ error: 'Already decided' }, { status: 409 })

  const { error: updateError } = await supabaseAdmin
    .from('photo_verifications')
    .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', row.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (decision === 'verified') {
    await supabaseAdmin.from('users').update({ is_verified: true, updated_at: new Date().toISOString() }).eq('id', row.user_id)
  }

  // Retention: delete the raw selfie once a decision is made, keep only the
  // status/result — the row itself stays (audit trail), just not the photo.
  await supabaseAdmin.storage.from('verification-selfies').remove([row.selfie_path])

  return NextResponse.json({ success: true })
}
