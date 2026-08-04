export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Session-based (not a bearer-secret route, unlike broadcast-push/cron) —
// a human needs to be logged in to review sensitive biometric selfies, so
// this verifies the caller's own access token (same pattern as
// src/app/api/account/delete/route.ts) then additionally requires
// is_admin = true on their users row before doing anything with the
// service-role client. Not gated by the client-side `gertrudis` member
// code anywhere in this app — that string ships in the JS bundle, which is
// fine for a low-stakes feature flag but not for admin access to selfies.
async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: profile } = await supabaseAdmin.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { supabaseAdmin }
}

export async function GET(req: NextRequest) {
  const result = await requireAdmin(req)
  if ('error' in result) return result.error
  const { supabaseAdmin } = result

  const { data: rows, error } = await supabaseAdmin
    .from('photo_verifications')
    .select('id, user_id, selfie_path, status, ai_label, ai_notes, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((rows ?? []).map(r => r.user_id))]
  const { data: users } = userIds.length
    ? await supabaseAdmin.from('users').select('id, name, profile_photo, photos').in('id', userIds)
    : { data: [] as any[] }
  const usersById = new Map((users ?? []).map(u => [u.id, u]))

  const withUrls = await Promise.all((rows ?? []).map(async row => {
    const { data: signed } = await supabaseAdmin.storage
      .from('verification-selfies')
      .createSignedUrl(row.selfie_path, 300)
    return {
      ...row,
      selfieUrl: signed?.signedUrl ?? null,
      user: usersById.get(row.user_id) ?? null,
    }
  }))

  const counts = {
    pending: withUrls.length,
    match: withUrls.filter(r => r.ai_label === 'match').length,
    mismatch: withUrls.filter(r => r.ai_label === 'mismatch').length,
    unclear: withUrls.filter(r => r.ai_label === 'unclear').length,
    unlabeled: withUrls.filter(r => !r.ai_label).length,
  }

  return NextResponse.json({ rows: withUrls, counts })
}
