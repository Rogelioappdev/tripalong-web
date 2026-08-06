import { supabase } from './supabase'
import type { UserProfile } from './types'

const TRIAL_DAYS = 7

export type TrialStatus = 'none' | 'active' | 'expired'

export function getTrialStatus(_profile: UserProfile | null): TrialStatus {
  // TripAlong+ paused — app is fully free during beta
  return 'active'
}

// Can we honestly promise this user free days?
//
// This is a *proxy* for real trial eligibility, not the real thing. The real
// rule lives in the stores: StoreKit intro offers are one-time per Apple ID
// per subscription group, and the WebView bridge has no eligibility check
// (purchase.ts only speaks purchase_plus / restore_purchases /
// manage_subscription / get_plus_pricing), so a truthful answer on native
// needs a new bridge message and therefore a new build. Until then we infer
// from our own billing history and fail in the safe direction — never
// promising free days to someone who might be charged immediately.
//
// `subscription_expires_at` alone is not enough: the RevenueCat webhook nulls
// it on EXPIRATION (see api/revenuecat/webhook/route.ts:106) while setting
// subscription_status to 'expired'. So any non-null status means this account
// has billing history and must see the plain paid frame.
export function canOfferFreeTrial(profile: UserProfile | null): boolean {
  if (!profile) return false
  if (profile.subscription_tier !== 'free') return false
  if (profile.subscription_status) return false
  if (profile.subscription_expires_at) return false
  return true
}

export function hasPlus(profile: UserProfile | null): boolean {
  if (!profile) return false
  return profile.subscription_tier === 'plus' || profile.subscription_tier === 'pro'
}

export function trialDaysLeft(profile: UserProfile | null): number {
  if (!profile?.trial_start_at) return 0
  const ms = Date.now() - new Date(profile.trial_start_at).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(TRIAL_DAYS - days))
}

export async function claimFoundingTrial(userId: string): Promise<void> {
  const res = await fetch('/api/trial/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Server error ${res.status}`)
  }
}

// Dev override: ?trial=day0|day3|day6|expired
// Returns a fake trial_start_at offset from now, or null if no override
export function getDevTrialOverride(): string | null {
  if (typeof window === 'undefined') return null
  const param = new URLSearchParams(window.location.search).get('trial')
  if (!param) return null
  const offsets: Record<string, number> = {
    day0: 0,
    day1: 1,
    day3: 3,
    day6: 6,
    expired: 8,
  }
  const days = offsets[param]
  if (days === undefined) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}
