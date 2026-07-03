'use client'

import { supabase } from './supabase'

export function getPushState(): 'unsupported' | 'granted' | 'denied' | 'default' {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return 'unsupported'
  return (Notification.permission as 'granted' | 'denied' | 'default')
}

export type NotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported'

// Dual-rail status check — native app can't use the web Notification API
// reliably inside the WebView (same reason the onboarding prompt hands off
// to native), so this asks the native side over the bridge instead.
export function getNotificationStatusAsync(): Promise<NotificationStatus> {
  const bridge = typeof window !== 'undefined' && (window as any).ReactNativeWebView
  if (!bridge) return Promise.resolve(getPushState())

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      delete (window as any).__tripalongNotificationStatusResult
      resolve('default')
    }, 2500)
    ;(window as any).__tripalongNotificationStatusResult = (status: string) => {
      clearTimeout(timeout)
      delete (window as any).__tripalongNotificationStatusResult
      resolve(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'default')
    }
    bridge.postMessage(JSON.stringify({ type: 'get_notification_status' }))
  })
}

export async function registerPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return false

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const existing = await reg.pushManager.getSubscription()
    const subscription = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false

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
    return true
  } catch {
    return false
  }
}

export async function sendPushNotification(params: {
  chatId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'image' | 'join'
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
