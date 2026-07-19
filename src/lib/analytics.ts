import posthog from 'posthog-js'

// Central, typed product analytics. Before this the app only had PostHog's
// default auto-events ($pageview / autocapture), so the whole TripAlong+
// conversion funnel — paywall → checkout → purchase — was invisible. These
// named events make that funnel (and the activation loop that feeds it)
// measurable in PostHog. Fire-and-forget: analytics must never break the app.

export type Rail = 'web' | 'native'
export type Billing = 'monthly' | 'annual'

// Which paywall surface the user saw. Lets us see *which* wall converts.
export type PaywallSurface =
  | 'swipe_paywall'   // PaywallModal (hit limit / rewind / who-viewed / compatibility)
  | 'plus_details'    // PlusDetailsSheet (Settings → membership)
  | 'trial_expired'   // TrialExpiredPaywall
  | 'founding_member' // FoundingMemberPaywall
  | 'profile_views'   // ProfileViewsSheet

// The PaywallModal's contextual trigger (why the wall appeared).
export type PaywallTrigger = 'swipes' | 'rewind' | 'who-viewed' | 'compatibility' | 'upgrade' | 'joins'

type EventProps = {
  // ── Conversion funnel ───────────────────────────────────────────────
  paywall_viewed: { surface: PaywallSurface; rail: Rail; trigger?: PaywallTrigger }
  checkout_started: { rail: Rail; billing: Billing }
  purchase_completed: { rail: Rail; billing?: Billing }
  purchase_cancelled: { rail: Rail }
  purchase_failed: { rail: Rail; reason?: string }
  // ── Swipe cap (measures the daily-limit experiment) ─────────────────
  // Fires the moment a user hits their daily swipe wall — the top of the
  // cap→paywall→purchase funnel and the exposure event for retention cohorts
  // (did hitting the wall make them churn?). Without this, users who hit the
  // cap and bounce without tapping "Unlock" leave no trace at all.
  swipe_limit_reached: { limit: number; variant: string; rail: Rail }
  // Fires when a user hits the daily join cap on TripAlong World (after the
  // lifetime free-join grace). Top of the join→paywall→purchase funnel.
  join_limit_reached: { limit: number; lifetime: number; rail: Rail }
  // ── Activation loop (leading indicators of conversion) ──────────────
  trip_saved: { trip_id: string }
  trip_joined: { trip_id: string; source: 'swipe' | 'detail' }
  trip_created: { destination?: string; vibes_count?: number }
}

export function track<K extends keyof EventProps>(event: K, props: EventProps[K]): void {
  if (typeof window === 'undefined') return
  try {
    posthog.capture(event, props as Record<string, unknown>)
  } catch {
    // never let a tracking failure surface to the user
  }
}
