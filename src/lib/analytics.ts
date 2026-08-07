import posthog from 'posthog-js'
import type { FilterDimension } from './tripFilters'

// Central, typed product analytics. Before this the app only had PostHog's
// default auto-events ($pageview / autocapture), so the whole TripAlong+
// conversion funnel — paywall → checkout → purchase — was invisible. These
// named events make that funnel (and the activation loop that feeds it)
// measurable in PostHog. Fire-and-forget: analytics must never break the app.

export type Rail = 'web' | 'native'
export type Billing = 'weekly' | 'monthly' | 'annual'

// Which paywall surface the user saw. Lets us see *which* wall converts.
export type PaywallSurface =
  | 'swipe_paywall'     // PaywallModal (hit limit / rewind / who-viewed / compatibility)
  | 'plus_details'      // PlusDetailsSheet (Settings → membership)
  | 'trial_expired'     // TrialExpiredPaywall
  | 'founding_member'   // FoundingMemberPaywall
  | 'profile_views'     // ProfileViewsSheet
  | 'onboarding_trial'  // TrialOfferPaywall — post-onboarding, pre-first-swipe
  | 'swipe_wall_trial'  // TrialOfferPaywall — reached from the daily swipe cap

// The PaywallModal's contextual trigger (why the wall appeared).
export type PaywallTrigger = 'swipes' | 'rewind' | 'who-viewed' | 'compatibility' | 'upgrade' | 'joins' | 'filters' | 'onboarding-trial'

type EventProps = {
  // ── Conversion funnel ───────────────────────────────────────────────
  paywall_viewed: { surface: PaywallSurface; rail: Rail; trigger?: PaywallTrigger }
  checkout_started: { rail: Rail; billing: Billing }
  purchase_completed: { rail: Rail; billing?: Billing }
  // Fires the moment a trial-bearing plan is actually bought (annual, which
  // carries the 3-day intro offer on both rails). Before this, a trial start
  // and a straight full-price purchase were indistinguishable in analytics —
  // which made the whole point of the wall redesign unmeasurable.
  trial_started: { surface: PaywallSurface; rail: Rail; billing: Billing }
  // The swipe wall's own two outcomes. `eligible` records whether we offered
  // the trial frame or the plain paid frame (see canOfferFreeTrial), so the
  // two populations never get averaged together in the funnel.
  // The pre-paywall run-up (intro → reminder → paywall). Each step is its own
  // drop-off point, so a funnel on this shows whether the sequence is warming
  // people up or just adding taps between them and the offer.
  trial_flow_step_viewed: { step: string; source: string }
  wall_cta_tapped: { rail: Rail; eligible: boolean }
  wall_declined: { rail: Rail; eligible: boolean }
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
  // Fires when a Plus user changes a feed filter dimension — product
  // visibility into which filters actually get used post-purchase.
  // (Filters are parked as of 2026-08-06; kept for when they return.)
  filter_dimension_changed: { dimension: FilterDimension; active_count: number }
  // ── Who viewed you ───────────────────────────────────────────────────
  // This feature had NO instrumentation at all until now: the eye icon fired
  // nothing, ProfileViewsSheet contained no track() calls, and the
  // 'profile_views' surface below was declared but never emitted. So its 2
  // lifetime conversions had no denominator — we couldn't tell "nobody sees
  // it" from "everybody sees it and the paywall fails", which need opposite
  // fixes. These three give it one.
  profile_views_bar_shown: { viewer_count: number; is_plus: boolean }
  profile_views_opened: { viewer_count: number; source: string; is_plus: boolean }
  // ── Activation loop (leading indicators of conversion) ──────────────
  trip_saved: { trip_id: string }
  trip_joined: { trip_id: string; source: 'swipe' | 'detail' }
  trip_join_requested: { trip_id: string; source: 'swipe' | 'detail' }
  trip_created: { destination?: string; vibes_count?: number }
  // ── Onboarding funnel ────────────────────────────────────────────────
  // One event per screen shown, not one event type per screen — the
  // 22-screen sequence (splash → auth → welcome → valueprop → 10 quiz
  // steps → 6 DNA dimensions → passport → finale) changes over time (a
  // step was just removed this session), so a generic `step` property
  // means adding/removing/reordering screens never requires touching this
  // file. `index`/`total` let a PostHog funnel/trend show exactly where in
  // the sequence people are dropping, not just which named step.
  onboarding_step_viewed: { step: string; index: number; total: number }
  // Fires once, the moment a fresh signup actually reaches /feed — the
  // bottom of the funnel every onboarding_step_viewed feeds into.
  onboarding_completed: Record<string, never>
}

export function track<K extends keyof EventProps>(event: K, props: EventProps[K]): void {
  if (typeof window === 'undefined') return
  try {
    posthog.capture(event, props as Record<string, unknown>)
  } catch {
    // never let a tracking failure surface to the user
  }
}
