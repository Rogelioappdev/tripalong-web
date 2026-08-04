export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Daily triage pass over every pending photo_verifications row: Claude looks
// at the live selfie next to the user's profile/travel photos and writes a
// match/mismatch/unclear read + a one-sentence reason onto the row. This is
// ADVISORY ONLY — status always stays 'pending' here. A human (via
// /admin/verify) makes every real accept/reject decision; this just gives
// them a fast first read and a count of which ones need the closest look
// (the 'unclear' bucket).
//
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` for
// cron-triggered requests once that env var is set (see vercel.json) — same
// shared-secret shape as BROADCAST_SECRET in api/admin/broadcast-push, just
// Vercel-triggered instead of curl-triggered.

const MODEL = 'claude-sonnet-5'

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = Buffer.from(await res.arrayBuffer())
    return { data: buf.toString('base64'), mediaType: contentType.split(';')[0] }
  } catch {
    return null
  }
}

function parseVerdict(text: string): { label: 'match' | 'mismatch' | 'unclear'; notes: string } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    const label = ['match', 'mismatch', 'unclear'].includes(parsed.label) ? parsed.label : 'unclear'
    return { label, notes: String(parsed.notes ?? '').slice(0, 500) }
  } catch {
    return { label: 'unclear', notes: 'Could not parse a clear verdict — needs a human look.' }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: pending, error } = await supabaseAdmin
    .from('photo_verifications')
    .select('id, user_id, selfie_path')
    .eq('status', 'pending')
    .is('ai_label', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = { processed: 0, match: 0, mismatch: 0, unclear: 0, failed: 0 }

  for (const row of pending ?? []) {
    try {
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('profile_photo, photos')
        .eq('id', row.user_id)
        .single()
      if (!userRow?.profile_photo) {
        summary.failed++
        continue
      }

      const { data: signed } = await supabaseAdmin.storage
        .from('verification-selfies')
        .createSignedUrl(row.selfie_path, 120)
      if (!signed?.signedUrl) {
        summary.failed++
        continue
      }

      const referenceUrls = [userRow.profile_photo, ...(userRow.photos ?? []).slice(0, 2)]
      const [selfieImg, ...referenceImgs] = await Promise.all([
        fetchImageAsBase64(signed.signedUrl),
        ...referenceUrls.map(fetchImageAsBase64),
      ])
      const validReferenceImgs = referenceImgs.filter((img): img is NonNullable<typeof img> => !!img)
      if (!selfieImg || validReferenceImgs.length === 0) {
        summary.failed++
        continue
      }

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'First image: a live selfie submitted for identity verification. Remaining image(s): photos the same person already uploaded to their profile (their main profile photo, plus travel photos if included).' },
            { type: 'image', source: { type: 'base64', media_type: selfieImg.mediaType as any, data: selfieImg.data } },
            ...validReferenceImgs.map(img => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType as any, data: img.data } })),
            { type: 'text', text: 'Does the person in the selfie appear to be the same person as in the reference photo(s)? Reply with ONLY a JSON object, no other text: {"label": "match" | "mismatch" | "unclear", "notes": "one short sentence explaining your read"}. Use "unclear" whenever you are not confident either way (bad lighting, angle, partial face, etc.) — a human will make the final call either way, so it is fine to say unclear often.' },
          ],
        }],
      })

      const textBlock = message.content.find(b => b.type === 'text')
      const verdict = parseVerdict(textBlock && 'text' in textBlock ? textBlock.text : '')

      await supabaseAdmin
        .from('photo_verifications')
        .update({ ai_label: verdict.label, ai_notes: verdict.notes })
        .eq('id', row.id)

      summary.processed++
      summary[verdict.label]++
    } catch {
      summary.failed++
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
