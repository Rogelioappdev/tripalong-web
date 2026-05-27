'use client'

import { supabase } from './supabase'

export async function registerPush(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
  if (localStorage.getItem('push_registered') === '1') return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const existing = await reg.pushManager.getSubscription()
    const subscription = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const sub = subscription.toJSON()
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
      }),
    })

    localStorage.setItem('push_registered', '1')
  } catch {}
}

export async function sendPushNotification(params: {
  chatId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'image'
  url: string
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    })
  } catch {}
}

