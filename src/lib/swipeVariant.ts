export type SwipeVariant = 'capped' | 'unlimited'

// Rolled out to 100% capped at 10 swipes/day on 2026-07-16 (previously a 50/50
// A/B of capped-15 vs unlimited). Lowered from 15 → 10 to bring the wall below
// the average user's daily volume (~12) so it actually fires.
export const CAPPED_DAILY_LIMIT = 10

// Deterministic 50/50 split by user ID — retained ONLY as a historical label so
// analytics can still segment the two former A/B arms (e.g. do users who used to
// be in the "unlimited" arm — and now suddenly hit a wall — churn harder than
// always-capped users?). It no longer controls the limit; see getDailySwipeLimit.
export function computeSwipeVariant(userId: string): SwipeVariant {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2 === 0 ? 'capped' : 'unlimited'
}

// 100% cap: every free user gets the same daily limit regardless of their (now
// historical) variant. Plus users are exempted separately via hasPlus() in
// SwipeStack, so they never reach this ceiling.
export function getDailySwipeLimit(_variant: SwipeVariant): number {
  return CAPPED_DAILY_LIMIT
}
