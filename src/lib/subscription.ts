import { supabase } from './supabase'
import { getProfile } from './queries'
import { hasPlus } from './trial'
import type { PlanKey } from './stripe'
import type { UserProfile } from './types'

export async function startCheckout(planKey: PlanKey) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not logged in')

  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ planKey }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Server error ${res.status}`)
  }
  const { url, error } = await res.json()
  if (error) throw new Error(error)
  if (!url) throw new Error('No checkout URL returned')
  window.location.href = url
}

// After a native purchase, RevenueCat's own entitlement check already
// confirmed the charge, but the Supabase users row is only updated once
// RevenueCat's webhook lands — which can lag a few seconds. Rather than trust
// a single fetch (which can still read stale 'free'), poll until the server
// actually agrees, so callers can commit the real profile instead of an
// optimistic guess. Falls back to the last fetch (even if still stale) once
// attempts run out, so callers always get *something* rather than hanging.
export async function pollForPlus(userId: string, attempts = 8, delayMs = 1500): Promise<UserProfile | null> {
  let last: UserProfile | null = null
  for (let i = 0; i < attempts; i++) {
    last = await getProfile(userId).catch(() => null)
    if (last && hasPlus(last)) return last
    if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
  }
  return last
}

export async function openBillingPortal(userId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not logged in')

  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ userId }),
  })
  const { url, error } = await res.json()
  if (error) throw new Error(error)
  window.location.href = url
}
