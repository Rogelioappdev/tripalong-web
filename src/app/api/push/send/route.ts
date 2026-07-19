import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ ok: true })

  const { chatId, conversationId, senderId, senderName, content, type, url } = await req.json()
  // Group chats key off chatId (trip_chat_id); DMs key off conversationId —
  // exactly one of the two identifies the thread to notify.
  const targetId = chatId ?? conversationId
  const isDM = !chatId && !!conversationId
  if (!targetId || !senderId) return NextResponse.json({ ok: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  let groupName: string | null = null
  if (!isDM && type !== 'join') {
    const { data: chat } = await supabase
      .from('trip_chats')
      .select('name, trips(destination), hangalongs(title)')
      .eq('id', targetId)
      .single()
    groupName = (chat as any)?.trips?.destination ?? (chat as any)?.hangalongs?.title ?? chat?.name ?? null
  }

  // Group chat notifications must show which group they're from, and never
  // leak the message body — full content requires opening the app.
  const title = type === 'join'
    ? 'New trip member'
    : isDM
      ? (senderName ?? 'TripAlong')
      : `${groupName ?? 'Trip chat'} - ${senderName ?? 'Someone'}`
  const body = type === 'join'
    ? (content ?? '')
    : isDM
      ? (type === 'image' ? '📷 Photo' : (content ?? ''))
      : (type === 'image' ? 'sent a photo 📷' : 'sent a message')
  const subsRpc = isDM ? 'get_dm_push_subscriptions' : 'get_chat_push_subscriptions'
  const tokensRpc = isDM ? 'get_dm_native_push_tokens' : 'get_chat_native_push_tokens'
  const rpcIdParam = isDM ? 'p_conversation_id' : 'p_chat_id'

  // Web push (VAPID) — independent of the native push path below
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL
  if (vapidPublic && vapidPrivate && vapidEmail) {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)
    const { data: subs } = await supabase.rpc(subsRpc, {
      [rpcIdParam]: targetId,
      p_exclude_user_id: senderId,
    })
    if (subs?.length) {
      const payload = JSON.stringify({ title, body, url: url ?? '/messages', tag: targetId })
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
  const { data: nativeTokens } = await supabase.rpc(tokensRpc, {
    [rpcIdParam]: targetId,
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
        data: { url: url ?? '/messages', tag: targetId },
      }))),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
