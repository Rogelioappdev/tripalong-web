export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseFollowers } from '@/lib/parseFollowers'

// Public creator application. Deliberately unauthenticated — the whole point
// is that replying to a DM with one link removes all data entry from our side,
// and a gate would put it straight back.
//
// Abuse controls are proportionate rather than heavy: a honeypot field that
// real people never fill, hard length caps, and a unique handle so the same
// person can't stack up rows. Nothing here grants anything or costs money, so
// the worst case of a junk row is one click to archive.

function normaliseHandle(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  const fromUrl = s.match(/instagram\.com\/([^/?#]+)/)?.[1]
  return (fromUrl ?? s).replace(/^@+/, '').replace(/[^a-z0-9._]/g, '').slice(0, 40) || null
}

const cap = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // Honeypot: hidden in the form, so anything filling it is a bot. Return a
  // success shape rather than an error — no feedback to tune against.
  if (String(body.website ?? '').trim()) return NextResponse.json({ ok: true })

  const instagram_handle = normaliseHandle(body.instagram_handle)
  if (!instagram_handle) {
    return NextResponse.json({ error: 'Please enter your Instagram handle.' }, { status: 400 })
  }

  const followers = parseFollowers(body.followers)

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await db.from('creators').insert({
    name: cap(body.name, 80) || `@${instagram_handle}`,
    instagram_handle,
    followers,
    email: cap(body.email, 120),
    payout_method: cap(body.payout_method, 120),
    notes: cap(body.notes, 500),
    stage: 'reached_out',
  })

  // Duplicate handle: they already applied, or we added them from a DM. Treat
  // as success — telling someone "you already exist" invites a second attempt
  // with a tweaked handle, which is worse than a no-op.
  if (error && (error as any).code !== '23505') {
    return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
