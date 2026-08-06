export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Backs the promise TrialFlow's reminder screen makes ("we'll remind you
// before your trial ends"). Until this existed, that promise was unbacked —
// the copy shipped, nothing sent it.
//
// This looks like a churn-increasing job and isn't. Users who cancel after a
// warning were going to cancel; what a warning prevents is the surprise-charge
// cohort, who don't just churn — they refund, they one-star, and they tell
// people. Protecting that is worth more than the handful of cancellations the
// reminder itself causes.
//
// Runs once daily (see vercel.json) and sweeps a wide window rather than
// firing at an exact hour, because a 3-day trial can start at any time of day
// and a daily cron can only be so precise. trial_reminder_sent_at is the
// dedupe key, so a wide window can never double-send.

const WINDOW_START_HOURS = 18
const WINDOW_END_HOURS = 42

export async function GET(req: NextRequest) {
  // Vercel Cron authenticates with this header; a manual curl needs the same
  // secret. Without CRON_SECRET set the route refuses to run at all rather
  // than sitting open — it can send push to real users.
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = Date.now()
  const windowStart = new Date(now + WINDOW_START_HOURS * 3600_000).toISOString()
  const windowEnd = new Date(now + WINDOW_END_HOURS * 3600_000).toISOString()

  // trial_ends_at is only ever set while period_type is TRIAL (see the
  // RevenueCat webhook), so a paying annual subscriber ~24h from renewal can
  // never land in here.
  const { data: due, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('subscription_tier', 'plus')
    .is('trial_reminder_sent_at', null)
    .not('trial_ends_at', 'is', null)
    .gte('trial_ends_at', windowStart)
    .lte('trial_ends_at', windowEnd)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!due?.length) {
    return NextResponse.json({ ok: true, due: 0, webSent: 0, nativeSent: 0 })
  }

  const userIds = due.map(u => u.id)
  const title = 'Your free trial ends tomorrow'
  const body = "Keeping TripAlong+? Nothing to do. Not for you? Cancel in two taps — you won't be charged."
  const url = '/settings'

  let webSent = 0
  let nativeSent = 0

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL
  if (vapidPublic && vapidPrivate && vapidEmail) {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)
    if (subs?.length) {
      const payload = JSON.stringify({ title, body, url, tag: 'trial-ending' })
      const results = await Promise.allSettled(
        subs.map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        )
      )
      webSent = results.filter(r => r.status === 'fulfilled').length
    }
  }

  const { data: nativeTokens } = await supabaseAdmin
    .from('native_push_tokens')
    .select('expo_push_token')
    .in('user_id', userIds)
  if (nativeTokens?.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(nativeTokens.map(t => ({
        to: t.expo_push_token,
        title,
        body,
        data: { url },
      }))),
    })
    if (res.ok) nativeSent = nativeTokens.length
  }

  // Marked regardless of delivery outcome. A user with notifications off is
  // still "handled" — retrying them daily for the rest of the trial would be
  // worse than not reminding them at all.
  await supabaseAdmin
    .from('users')
    .update({ trial_reminder_sent_at: new Date().toISOString() })
    .in('id', userIds)

  return NextResponse.json({ ok: true, due: userIds.length, webSent, nativeSent })
}
