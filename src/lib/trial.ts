import { supabase } from './supabase'
import type { UserProfile } from './types'

const TRIAL_DAYS = 7

export type TrialStatus = 'none' | 'active' | 'expired'

export function getTrialStatus(profile: UserProfile | null): TrialStatus {
  if (!profile?.trial_start_at) return 'none'
  const ms = Date.now() - new Date(profile.trial_start_at).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  return days < TRIAL_DAYS ? 'active' : 'expired'
}

export function hasPlus(profile: UserProfile | null): boolean {
  if (!profile) return false
  if (profile.subscription_tier === 'plus' || profile.subscription_tier === 'pro') return true
  return getTrialStatus(profile) === 'active'
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
