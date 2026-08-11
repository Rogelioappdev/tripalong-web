export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Creator deal pipeline — the stage before /api/admin/creators.
//
// Same shared secret as the rest of /api/admin: this holds real people's
// names, follower counts and deal terms, and can issue referral codes, so it
// must never be reachable from the client app.
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.BROADCAST_SECRET

function authed(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  return !!ADMIN_SECRET && token === ADMIN_SECRET
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Handles arrive pasted out of Instagram, so they turn up as "@name",
// "instagram.com/name/", "Name " with trailing spaces, or mixed case. Reduce
// everything to the bare handle so the unique index can actually do its job.
function normHandle(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .split(/[?\s]/)[0]
    .toLowerCase()
}

const STAGES = ['new', 'waiting', 'call', 'closed', 'live', 'dead']

// A lead in an active stage that nobody has touched in this many days is the
// real failure mode with 40+ conversations — not lost, just quietly forgotten.
const STALE_DAYS = 4

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = admin()

  const { data: leads, error } = await db
    .from('creator_leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pull real performance for leads that already converted, so a signed
  // creator's row shows what the deal actually produced instead of stopping
  // at "closed". This is the whole reason the pipeline lives here rather than
  // in a spreadsheet.
  const codeIds = (leads ?? []).map(l => l.code_id).filter(Boolean)
  let perf: Record<string, { signups: number; subscribers: number; revenue_cents: number }> = {}

  if (codeIds.length) {
    const [{ data: refs }, { data: comms }] = await Promise.all([
      db.from('creator_referrals').select('code_id, user_id').in('code_id', codeIds),
      db.from('creator_commissions').select('code_id, user_id, commission_cents, voided_at').in('code_id', codeIds),
    ])
    for (const id of codeIds) {
      const mine = (comms ?? []).filter(c => c.code_id === id && !c.voided_at)
      perf[id] = {
        signups: (refs ?? []).filter(r => r.code_id === id).length,
        subscribers: new Set(mine.map(c => c.user_id)).size,
        revenue_cents: mine.reduce((t, c) => t + (c.commission_cents ?? 0), 0),
      }
    }
  }

  const now = Date.now()
  const staleMs = STALE_DAYS * 86400000

  const rows = (leads ?? []).map(l => {
    const active = ['new', 'waiting', 'call'].includes(l.stage)
    const touched = new Date(l.last_contact_at ?? l.created_at).getTime()
    const callMs = l.call_at ? new Date(l.call_at).getTime() : null

    return {
      ...l,
      perf: l.code_id ? perf[l.code_id] ?? null : null,
      // Derived server-side so every client agrees on what's urgent.
      call_overdue: !!(callMs && callMs < now && ['call'].includes(l.stage)),
      call_today: !!(callMs && new Date(callMs).toDateString() === new Date(now).toDateString()),
      stale: active && now - touched > staleMs,
      days_quiet: Math.floor((now - touched) / 86400000),
    }
  })

  return NextResponse.json({ leads: rows, stale_days: STALE_DAYS })
}

/**
 * POST — create one lead, or bulk-import a pasted blob of handles.
 * Bulk mode is the point: 40+ DMs is not something anyone types in one at a
 * time, and re-pasting the same batch must be a no-op, not 40 duplicates.
 */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = admin()
  const body = await req.json().catch(() => ({}))

  if (typeof body.bulk === 'string' && body.bulk.trim()) {
    const handles = Array.from(new Set(
      body.bulk.split(/[\n,]/).map(normHandle).filter(Boolean),
    ))
    if (!handles.length) return NextResponse.json({ error: 'No handles found' }, { status: 400 })

    // ignoreDuplicates so pasting an overlapping batch adds only what's new
    // and silently leaves existing leads (and their stage/notes) untouched.
    const { data, error } = await db
      .from('creator_leads')
      .upsert(handles.map(h => ({ handle: h })), { onConflict: 'handle', ignoreDuplicates: true })
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, added: data?.length ?? 0, seen: handles.length })
  }

  const handle = normHandle(body.handle)
  if (!handle) return NextResponse.json({ error: 'Handle is required' }, { status: 400 })

  const { data, error } = await db
    .from('creator_leads')
    .insert({
      handle,
      name: body.name || null,
      followers: Number.isFinite(+body.followers) && body.followers !== '' ? +body.followers : null,
      stage: STAGES.includes(body.stage) ? body.stage : 'new',
      notes: body.notes || null,
      call_at: body.call_at || null,
      last_contact_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (error) {
    const dupe = error.code === '23505'
    return NextResponse.json(
      { error: dupe ? 'That handle is already in the pipeline.' : error.message },
      { status: dupe ? 409 : 500 },
    )
  }
  return NextResponse.json({ ok: true, id: data?.id })
}

/** PATCH — update a lead, or convert it into a real creator + referral code. */
export async function PATCH(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = admin()
  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // ---- convert: lead -> creator_codes row, keeping the thread intact ----
  if (body.action === 'convert') {
    const { data: lead } = await db
      .from('creator_leads').select('*').eq('id', body.id).maybeSingle()
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (lead.code_id) return NextResponse.json({ error: 'Already converted.' }, { status: 400 })

    // Same normalisation the redeem route applies, so a code minted here can
    // always be typed back in successfully.
    const code = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 })

    const { data: created, error: codeErr } = await db
      .from('creator_codes')
      .insert({
        code,
        creator_name: lead.name || lead.handle,
        creator_handle: lead.handle,
        email: body.email || null,
        payout_method: body.payout_method || null,
        commission_rate: Number.isFinite(+body.commission_rate) ? +body.commission_rate : 0.15,
        status: 'active',
      })
      .select('id')
      .maybeSingle()

    if (codeErr) {
      const dupe = codeErr.code === '23505'
      return NextResponse.json(
        { error: dupe ? 'That code is already taken.' : codeErr.message },
        { status: dupe ? 409 : 500 },
      )
    }

    const { error: linkErr } = await db
      .from('creator_leads')
      .update({ code_id: created!.id, stage: 'closed', updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, code_id: created!.id, code })
  }

  // ---- ordinary field update ----
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage)) return NextResponse.json({ error: 'Bad stage' }, { status: 400 })
    patch.stage = body.stage
  }
  for (const f of ['name', 'notes', 'deal_terms', 'call_at', 'last_contact_at'] as const) {
    if (body[f] !== undefined) patch[f] = body[f] || null
  }
  if (body.followers !== undefined) {
    patch.followers = body.followers === '' || body.followers === null ? null : +body.followers
  }
  // "Just messaged them" — the single most-used action, so it gets a shortcut.
  if (body.touch) patch.last_contact_at = new Date().toISOString()

  const { error } = await db.from('creator_leads').update(patch).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await admin().from('creator_leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
