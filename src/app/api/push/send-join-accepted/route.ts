import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ ok: true })

  const { requestId, destination } = await req.json()
  if (!requestId) return NextResponse.json({ ok: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const title = "You're in! 🎉"
  const body = destination ? `You've been accepted to the trip to ${destination}` : "You've been accepted to the trip"

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL
  if (vapidPublic && vapidPrivate && vapidEmail) {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)
    const { data: subs } = await supabase.rpc('get_join_request_requester_push_subscriptions', { p_request_id: requestId })
    if (subs?.length) {
      const payload = JSON.stringify({ title, body, url: '/messages', tag: `join-accepted-${requestId}` })
      await Promise.allSettled(
        subs.map((sub: any) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            payload,
          ).catch(() => {})
        )
      )
    }
  }

  const { data: nativeTokens } = await supabase.rpc('get_join_request_requester_native_push_tokens', { p_request_id: requestId })
  if (nativeTokens?.length) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(nativeTokens.map((t: any) => ({
        to: t.expo_push_token,
        title,
        body,
        data: { url: '/messages', tag: `join-accepted-${requestId}` },
      }))),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
