export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// One-off/occasional admin broadcast (e.g. launch announcement) to every
// push-subscribed user, web and native. Triggered manually via curl with a
// shared secret — not exposed in any client UI.
const AUTH_HEADER_SECRET = process.env.BROADCAST_SECRET

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!AUTH_HEADER_SECRET || token !== AUTH_HEADER_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { title, body, url } = await req.json()
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let webSent = 0
  let nativeSent = 0

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL
  if (vapidPublic && vapidPrivate && vapidEmail) {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)
    const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth')
    if (subs?.length) {
      const payload = JSON.stringify({ title, body, url: url ?? '/feed', tag: 'broadcast' })
      const results = await Promise.allSettled(
        subs.map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        )
      )
      webSent = results.filter(r => r.status === 'fulfilled').length
    }
  }

  const { data: nativeTokens } = await supabaseAdmin.from('native_push_tokens').select('expo_push_token')
  if (nativeTokens?.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(nativeTokens.map((t) => ({
        to: t.expo_push_token,
        title,
        body,
        data: { url: url ?? '/feed' },
      }))),
    })
    if (res.ok) nativeSent = nativeTokens.length
  }

  return NextResponse.json({ ok: true, webSent, nativeSent })
}
