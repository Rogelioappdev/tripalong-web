import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ ok: true })

  const { chatId, senderId, senderName, content, type, url } = await req.json()
  if (!chatId || !senderId) return NextResponse.json({ ok: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const title = type === 'join' ? 'New trip member' : (senderName ?? 'TripAlong')
  const body = type === 'image' ? '📷 Photo' : (content ?? '')

  // Web push (VAPID) — independent of the native push path below
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL
  if (vapidPublic && vapidPrivate && vapidEmail) {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)
    const { data: subs } = await supabase.rpc('get_chat_push_subscriptions', {
      p_chat_id: chatId,
      p_exclude_user_id: senderId,
    })
    if (subs?.length) {
      const payload = JSON.stringify({ title, body, url: url ?? '/messages', tag: chatId })
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

  // Native push (Expo push service) — independent of the web push path above
  const { data: nativeTokens } = await supabase.rpc('get_chat_native_push_tokens', {
    p_chat_id: chatId,
    p_exclude_user_id: senderId,
  })
  if (nativeTokens?.length) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(nativeTokens.map((t: any) => ({
        to: t.expo_push_token,
        title,
        body,
        data: { url: url ?? '/messages', tag: chatId },
      }))),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
