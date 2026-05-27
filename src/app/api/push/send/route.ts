import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

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

  const { data: subs } = await supabase.rpc('get_chat_push_subscriptions', {
    p_chat_id: chatId,
    p_exclude_user_id: senderId,
  })

  if (!subs?.length) return NextResponse.json({ ok: true })

  const title = senderName ?? 'TripAlong'
  const body = type === 'image' ? '📷 Photo' : (content ?? '')
  const payload = JSON.stringify({ title, body, url: url ?? '/messages', tag: chatId })

  await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload,
      ).catch(() => {})
    )
  )

  return NextResponse.json({ ok: true })
}
