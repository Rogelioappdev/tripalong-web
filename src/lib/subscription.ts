import { supabase } from './supabase'
import type { PlanKey } from './stripe'

export async function startCheckout(planKey: PlanKey) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planKey, userId: user.id, email: user.email }),
  })
  const { url, error } = await res.json()
  if (error) throw new Error(error)
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
