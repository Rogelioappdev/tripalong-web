export type SwipeVariant = 'capped' | 'unlimited'

export const CAPPED_DAILY_LIMIT = 15

// Deterministic 50/50 split by user ID — stable across sessions/devices
// without needing a round trip before the first swipe. Persisted to
// users.swipe_variant on first computation so conversion/retention can be
// segmented by variant directly in Supabase.
export function computeSwipeVariant(userId: string): SwipeVariant {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2 === 0 ? 'capped' : 'unlimited'
}

export function getDailySwipeLimit(variant: SwipeVariant): number {
  return variant === 'unlimited' ? Infinity : CAPPED_DAILY_LIMIT
}
