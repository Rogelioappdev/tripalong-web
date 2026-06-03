import { supabase } from './supabase'
import type { PlanKey } from './stripe'

export async function startCheckout(planKey: PlanKey) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not logged in')

  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planKey, userId: session.user.id, email: session.user.email }),
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

export async function openBillingPortal(userId: string) {
  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const { url, error } = await res.json()
  if (error) throw new Error(error)
  window.location.href = url
}
