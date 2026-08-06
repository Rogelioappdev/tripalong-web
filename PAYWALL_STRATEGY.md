# TripAlong Paywall Strategy — holistic redesign

**Written 2026-08-05. Strategy + specs, no code.** Hand this to an execution session.
Companion docs: `PRICING_RESEARCH.md` (competitor pricing), `MONETIZATION_FEATURES_PLAN.md`, and the
`tripalong_paywall_conversion_plan` memory (the real Supabase diagnostics this builds on).

---

## 0. Ground truth — what the code actually does today (verified, not assumed)

Everything below was read out of the current repo, not inferred from prior notes.

### The headline finding: the swipe wall has never offered a trial

`src/lib/trial.ts:8` — `getTrialStatus()` is hard-stubbed:

```ts
export function getTrialStatus(_profile: UserProfile | null): TrialStatus {
  // TripAlong+ paused — app is fully free during beta
  return 'active'
}
```

At the wall (`SwipeStack.tsx:876`) that makes `isFirstTime === false` and `isExpired === false`
permanently. So the wall always renders the third branch:

- CTA reads **"Unlock unlimited →"**
- opens `PaywallModal` with `trigger: 'swipes'`
- which shows an Annual/Monthly toggle and a button reading **"Unlock Plus · $39.99/yr"**

The `"Get 7 days free →" / "No card required"` branch directly above it (`SwipeStack.tsx:1007-1012`)
is unreachable dead code.

**So the ~1% is not a trial offer converting badly. It is a cold, full-price, $39.99 ask fired at a
user mid-task who has never paid for anything in this app.** That reframes the entire problem: we are
not optimizing a bad trial pitch, we are introducing one.

### You are already paying for free days and getting nothing for them

The yearly SKU has a live 3-day StoreKit Introductory Offer (App Store Connect, all 175 territories,
no end date). An eligible native user who taps "Unlock Plus · $39.99/yr" is charged **$0 today** — but
every pixel on that screen said $39.99. The free days are being given away silently, doing zero
persuasive work.

### Both payment rails are already trial-capable — no new payment infrastructure needed

| Rail | Trial mechanism | Status |
|---|---|---|
| Native (iOS, ~100% of revenue) | StoreKit Introductory Offer on `$rc_annual` | Live |
| Web (Stripe) | `lib/stripe.ts:36` `trialPeriodDays: 3`, `checkout/route.ts:66` `subscription_data.trial_period_days`, `payment_method_collection: 'always'` | Live |

Both require a real payment method. Both auto-convert. This is exactly the trial mechanic you chose.

### The trial UI you want already exists and is good

`src/components/onboarding/TrialOfferPaywall.tsx` — 84px "3 days" hero, a 3-step day-by-day timeline
(Today / In 2 days / Day 3), yearly-with-trial vs weekly-no-trial decoy pair, hold-to-confirm CTA.
It is mounted in exactly one place: post-onboarding, pre-first-swipe. **The highest-intent moment in
the product cannot reach it.**

### Four defects that must be fixed before any of this can work (P0)

1. **`getTrialStatus()` stub** — blocks every trial branch in the app. Unstub or replace.
2. **Weekly throws on native.** `purchase.ts:45` still has `if (billing === 'weekly') throw new
   Error(...)`. `TrialOfferPaywall` offers Weekly as its decoy plan and calls `purchasePlus('weekly')`
   — so on native (where 100% of revenue comes from), a user who picks the decoy and holds to confirm
   gets an error message instead of a purchase. The earlier note claiming this guard was removed is
   wrong; it is still there. **Until a weekly-aware build is confirmed live, the decoy on native must
   be Monthly, not Weekly.**
3. **An unbacked promise.** `TrialOfferPaywall.tsx:37` tells the user *"We'll send a heads up before
   anything happens."* Nothing in this codebase sends it. `vercel.json` has exactly one cron
   (`verify-daily`), and the RevenueCat webhook only writes subscription state — it schedules nothing.
   We are currently making a trust promise we do not keep. Given the "genuine app" positioning you
   asked for, this is the single most important thing to make real.
4. **App Review exposure.** Guideline 3.1.2 requires a Restore Purchases path on any screen selling
   an auto-renewable subscription. `PaywallModal` has one; `TrialOfferPaywall` does not. If
   `TrialOfferPaywall` becomes the wall's paywall on native, it needs Restore before the next submit.

---

## 1. Decisions locked in this session

| Decision | Call |
|---|---|
| Trial mechanic at the wall | Reuse the real 3-day trial the onboarding screen already uses (`purchasePlus('annual')`). No new no-card system. |
| Post-onboarding `TrialOfferPaywall` | Keep as-is. It is already a soft ask (X to skip). The wall must be written so it doesn't read as a repeat. |
| Discounts | Allowed **only in a generosity register** — it must feel like the founders genuinely gave you something, never like a manipulated scarcity play. No fake countdowns, no "expires in 10:00". The user should feel they're winning too. |
| Location filtering | **Free once, then Plus** — and done properly. It's a heavily requested feature. |

### One honest caveat about the goal

You said you want *almost everyone* who hits the wall to start a trial. With a real card-on-file trial,
that ceiling doesn't exist — the Apple sheet itself is an irreducible friction step, and best-in-class
wall→trial-start at this kind of moment lands around **20–40%**, not ~90%. The ~90% shape is only
reachable with the no-card soft unlock you deliberately didn't pick (and which bleeds ~55% at day 0
and produces far less revenue).

So the target this plan is built to hit: **25–35% of cap-hitters start a real trial within their first
two cap hits, and 40–60% of those convert to paid.** Against a ~1% baseline on a 1,013-user pool, that
is a 25–35× improvement on the same traffic. I'm proceeding on that basis; if you'd rather chase the
literal ~90%, that's the no-card path and a different document.

---

## 2. The core reframe

Three sentences that the rest of this plan follows from:

1. **The wall is the trial moment, not the purchase moment.** Nothing at the wall should ask for money.
   It asks for a free thing that happens to require Face ID.
2. **The wall must stop selling the free alternative.** Today the largest element on that screen — 58px
   tabular numerals — is a countdown to when waiting becomes free. You cannot make the trial the
   default choice while the biggest thing on screen advertises the alternative.
3. **Every ask must be earned and honest.** The user hit the wall because they used the product hard.
   Say that. Reciprocity ("here, have it, feel it first") beats pressure, and it's also the only
   register consistent with the brand line on the marketing site.

---

## 3. Moment 1 — the swipe wall redesign (highest priority)

### 3.1 What's wrong with the current screen, element by element

Read from `SwipeStack.tsx:876-1015`:

| Element | Current | Problem |
|---|---|---|
| Next trip cover | `blur(20px) scale(1.1)` | Fully abstracted. No concrete loss — a blur is not a destination. |
| Headline | "{destination} is waiting" 22px | Good instinct, undersold at 22px. |
| Sub | "You've reached your 10 daily swipes" | Neutral-to-punitive. States a rule, gives no credit. |
| **Countdown** | **58px, centered, visual hero** | **The core defect. It teaches "waiting is the plan."** |
| Divider | "or unlock now" | Frames the trial as the *alternative* to the plan. |
| CTA | "Unlock unlimited →" | The word "unlock" implies payment. No mention of free. |
| Below CTA | nothing | No risk reversal at the exact moment doubt peaks. |

### 3.2 The new hierarchy

Largest → smallest. This ordering *is* the spec:

1. **The deck peek.** Replace the single blurred cover with a partial reveal: the next card sharp from
   the top down to ~40%, gradient-dissolving below, with two more card edges stacked behind it. A blur
   says "something's hidden." A peek plus a stack says "there's a *pile* of this and you're being
   stopped mid-pile."
2. **The named loss, real data.** "Tokyo, Lisbon and 23 more match your Travel DNA." Pull the real
   remaining-deck count and the next two destinations from the already-loaded feed array. Specific
   beats generic — and this is the same lever that made "{destination} is waiting" the right instinct.
3. **The earned line.** "You've used all 10 swipes today." Optionally, only if computed truthfully
   from `daily_swipe_counts`: "That puts you in the top X% of travelers this week." (Median swipes/day
   is exactly 10 — the cap — so a true percentile is computable. Do not ship a made-up number; the
   whole strategy rests on being the app that doesn't do that.)
4. **The offer, as the hero.** "Keep going — 3 days free." This replaces the countdown as the single
   largest thing on screen.
5. **One CTA.** `Keep swiping — 3 days free →`. Solid cream, full width. No plan toggle here.
6. **Risk reversal, 12px, directly under the CTA.** "$0 today. We'll remind you before day 3 — cancel
   in two taps, no questions." (Only ship the word "remind" once the cron in §3.6 exists.)
7. **The reciprocity line, one line, no emoji.** "We'd rather you feel it for 3 days than pay for
   something you haven't tried."
8. **"Not now"** — plain low-contrast text, honestly tappable. Never a hidden or delayed X.
9. **The countdown, demoted to 11px:** "or wait 7h 22m for tomorrow's 10." It stays because hiding it
   would be dishonest — but it is now a footnote, not the plan.

### 3.3 The flow

```
Wall (single CTA)
   └─> TrialOfferPaywall  [reused, new source="swipe_wall" prop]
          └─> Apple sheet / Stripe checkout
                 └─> PlusWelcomeFlow  [already exists]
```

Two steps, deliberately. The wall's job is to convert attention into a tap; `TrialOfferPaywall`'s job
is risk reversal, and it already does that well (the Today / In 2 days / Day 3 timeline is the single
best-built persuasion asset in the app). Because the wall's CTA already says "3 days free," step two
reads as confirmation, not as a second ask.

Changes needed to `TrialOfferPaywall` when opened from the wall:

- **Headline swap.** Onboarding's "3 days of TripAlong+, on us" becomes the earned frame:
  *"You've earned this one."* / "3 days of TripAlong+, free."
- **Decoy plan = Monthly on native** until the weekly guard (defect #2) is confirmed removed.
- **Drop hold-to-confirm at the wall; keep it in onboarding.** Onboarding is ceremonial — the 1.5s
  hold reads as a commitment ritual. The wall is mid-task and impatient; there the same hold reads as
  the app making it hard to say yes. Plain tap.
- **Add Restore Purchases** (defect #4).
- Fire `paywall_viewed` with `surface: 'swipe_wall_trial'` so the two placements never blur together
  in the funnel.

### 3.4 Trial-ineligible users (the case that will otherwise embarrass us)

StoreKit intro-offer eligibility is one-time per Apple ID per subscription group. A user who already
burned it taps "3 days free" and Apple shows them a full-price sheet. That's a broken promise on the
screen that's supposed to establish trust.

**We cannot currently detect this.** The WebView bridge (`purchase.ts`) supports exactly four messages:
`purchase_plus`, `restore_purchases`, `manage_subscription`, `get_plus_pricing`. There is no
eligibility check, and adding one is a native change → new EAS build → App Store review.

Phased handling:

- **Phase 1 (web-only, ships immediately):** assume eligible. This is right for the large majority —
  58.2% of cap hits happen on day 1 of a brand-new account. Then handle the failure honestly: if the
  sheet comes back `cancelled` **and** the user is a known repeat cap-hitter, show a short, non-salesy
  follow-up: *"Looks like your Apple ID already used its free trial. That's Apple's rule, not ours —
  here's what we can do instead."* → route into the §4.4 genuine-gift path.
- **Phase 2 (next native build):** add a `get_intro_eligibility` bridge message mirroring
  `get_plus_pricing` exactly (same 2.5s timeout, same null-on-old-build fallback). Render the truthful
  variant: ineligible users see a straight "$39.99/yr, cancel anytime" ask with no trial language.

### 3.5 Declining must never be a dead end

Today, "Maybe later" returns the user to a wall with a countdown — a dead screen whose only remaining
instruction is *close the app*. That is where the 24-hour churn window opens.

On decline, soft-land instead of dead-ending. Do **not** hand back free swipes (that dissolves the cap
and you'd be paying for the wall twice). Land them somewhere real:

- Their **Saved trips** — the trips they already chose, no swiping required.
- **Group chats** they're in — the actual product value, and the retention surface.
- **TripAlong World** — browsing without swiping (join cap still applies).

And silently: record the decline plus the next 3 locked trip IDs. Those exact destinations become the
content of the push in §4.

### 3.6 The reminder cron — non-negotiable, and it's also a conversion lever

Build `/api/cron/trial-ending`, daily. Find users whose `subscription_expires_at` is ~24h out and who
are still in trial; send one push: *"Your 3 free days end tomorrow. Keeping Plus? Nothing to do.
Not for you? Cancel here — takes two taps."*

This looks like a churn-increasing move. It isn't. Warned users who cancel were going to cancel; what
you avoid is the surprise-charge cohort, who don't just churn — they refund, they one-star, and they
tell people. It also backs a promise the app is already making, which is the entire premise of the
positioning you asked for.

Note: `vercel.json` currently declares one cron. Confirm the plan's cron limit before adding two more
(this one and §4's) — on Hobby you get very few, and this may force consolidating into a single daily
dispatcher route.

---

## 4. Moment 2 — the rejection case: personalized re-engagement

The Cal AI move is not "send a push." It's *use what the user told you about themselves, and reflect
it back so specifically that it doesn't read as marketing.* We collected 16 screens of exactly that.

### 4.1 What we actually know about each user (verified fields)

Usable today: `traveler_types[]`, `travel_styles`, `travel_pace`, `social_energy`, `planning_style`,
`experience_level`, `travel_with`, home city/country + coords, age, `saved_trips`, `trip_members`
(joins), `daily_swipe_counts` (per-day counts, UTC-keyed), profile views, verification status.

**The gap that limits the best copy:** there is no per-trip like/pass log. The `swipes` table is dead
(19 rows ever). So "destinations they showed interest in" can only come from saves and joins — not
from swipe direction. **Prerequisite build: record destination + trip_id on right-swipe.** It's cheap,
it feeds every personalization below, and it also finally gives you a like/pass ratio, which you have
never had.

### 4.2 Segments (real counts from the 1,013-user cap pool)

| Segment | Users | Read | Treatment |
|---|---|---|---|
| Hit cap once | 792 | Curious, unproven | Utility touch only. No selling. |
| 2–3 hits | 171 | Habit forming | Trial ask, personalized by DNA. |
| 4–6 hits | 38 | Proven, unconverted | Earned full-screen ask + genuine gift. |
| 7+ hits | 12 | Your most loyal non-payers | Personal, one-to-one register. |

### 4.3 The ladder

**T+0, in-app, at decline.** No sales copy. Show the 3 trips they'd have seen next as locked cards
with destinations legible. Store those IDs. This creates the specific curiosity gap the push later
resolves — the push works because it finishes a sentence the app already started.

**T+~30min after their cap resets (push #1) — utility, not sales.**
> "Your swipes are back. Tokyo and 4 more are still in your deck."

Note the timing mechanics: `daily_swipe_counts` is UTC-keyed, so everyone's cap resets at UTC midnight
— which is late afternoon/evening for US users and pre-dawn for parts of Asia. Gate sends to
08:00–22:00 in the user's inferred local time (we have their country/coords) and hold until the window
opens. Never send outside it.

**After the 2nd cap hit (push #2) — identity reflection.**
> "You said you're a Backpacker who travels solo. 7 new trips this week match that."

This is the Cal AI beat exactly: quote their own self-description back, attached to a real count. It
lands as the app paying attention, not as a campaign — provided the count is real.

**After the 3rd cap hit within 7 days — the strongest ask, and not at the wall.**
Fire a full-screen at *app open*, before they start swiping, so the ask isn't competing with an
interrupted task:
> "You've hit your limit three times this week. That's not a free-plan problem — that's you actually
> using this. Have 3 days on us."

Behavior reflection (Strava/Duolingo register) plus reciprocity. This is the highest-expected-value
single moment in the whole ladder, because the user has proven intent three times and the copy is
made of their own real numbers.

**Angle variation for repeat non-converters.** Never make the same ask four times. Rotate the *reason*:
swipes → filters ("you searched Lisbon twice") → who-viewed ("6 people looked at your profile this
week") → back to swipes. Same product, different door.

### 4.4 The genuine gift (4+ hits, still declining)

Your discount answer was "whatever hooks them, but we must feel like a genuine app where the user is
winning too." So: **give time, not a discount.** A one-time, personally-framed extra week:

> "You've been here more than almost anyone, and you haven't paid us a cent. Have a week of Plus on
> us — no card, nothing to cancel. If it's not worth it after that, no hard feelings."

Why time beats price here:
- It costs you nothing real (marginal cost ≈ 0) but reads as a genuine gift, which price cuts never do.
- It leaves the price story completely intact — no one learns that waiting produces a discount.
- No fake urgency required, so it stays inside the brand line.
- It's the only offer in this document a user might screenshot and show a friend approvingly.

**Cheap implementation path:** RevenueCat's server-side *promotional entitlement grant* (REST:
`POST /subscribers/{app_user_id}/entitlements/{entitlement}/promotional`). No App Store Connect offer
config, no StoreKit promotional-offer signing, **no native build.** Grant 1 week, RC fires
`EXPIRATION` into the existing `/api/revenuecat/webhook` when it lapses, and the trial-expiry paywall
picks it up from there. Cap it: one grant per user, ever, 38+12 = 50 eligible users today.

Only if that fails at scale should you consider a price discount — and then quietly, to that segment
only, never as a public banner.

### 4.5 Hygiene rules (these protect the brand line; treat them as spec, not suggestions)

- Max **2 monetization pushes per user per 7 days**. Utility pushes (chat, join requests) don't count.
- Local-time window 08:00–22:00, always.
- Hard suppression: anyone currently in trial, anyone subscribed, anyone who denied notification
  permission (we can read this — `getNotificationStatusAsync()`).
- One kill switch env var that stops all re-engagement sends.
- New table `reengagement_sends (user_id, variant, sent_at, opened_at)` — dedupe key and the only way
  you'll know which angle works.
- Never a countdown, never "offer expires," never a fake scarcity claim. Ever.

---

## 5. Full-journey positioning of the three Plus features

### 5.1 The organizing rule

**One feature owns one moment. One ask per session. Never bundle after onboarding.**

Bundled feature lists ("unlimited swipes + filters + who viewed you!") convert worse than a single
relevant unlock, because they ask the user to evaluate a product instead of solve the problem they're
having *right now*. The only place a bundle belongs is the onboarding trial screen, where there is no
specific problem yet.

Each feature owns a distinct emotional need:

| Feature | Need it serves | Moment it owns |
|---|---|---|
| Unlimited swipes | **Momentum** — "don't stop me" | The cap wall |
| Location filtering | **Control** — "I know what I want" | The intent moment (2nd free search) |
| Who viewed you | **Curiosity / social proof** | The return visit |

They reinforce rather than compete because they fire on different *days* and different *intents* for
most users — and because of the suppression rules in §5.3.

### 5.2 The journey

| # | Moment | What happens | Why |
|---|---|---|---|
| 1 | Onboarding trial screen | Existing soft ask. The **only** place Plus is presented as a bundle. | No specific pain exists yet, so sell the whole idea, softly, once. |
| 2 | Swipes 1–7, first session | **Nothing. Sell nothing.** | Activation is worth more than an early ask. 60% of registered users never swipe at all; don't add friction to the ones who do. |
| 3 | Swipe 8 | Tiny non-blocking counter: "2 swipes left today." | An expected wall reads as a rule; a surprise wall reads as a punishment. This one line is cheap and it changes how §3 lands. |
| 4 | Swipe 10 — **the wall** | §3 in full. Unlimited swipes only. No feature list. One CTA. | The spine of the strategy. Highest intent, highest volume (56.5% of active swipe-days). |
| 5 | Decline | Soft-land (§3.5) + record for the ladder. | Never dead-end the highest-intent user in the app. |
| 6 | Filters go live | **First filtered search is free and excellent.** Second one gates. | You chose free-once. It also makes the gate defensible: they've felt it, so the ask is about *keeping* something, not buying a promise. Prior data: 2/2 filter-triggered conversions, both retained — tiny n, but the strongest per-exposure signal in the table. |
| 7 | Who viewed you | **Visibility fix only, no new paywall.** Move the entry point off the Messages-header eye icon into the main loop (a feed-level card or a push when the 3+ viewer threshold trips). Existing modal handles the ask. | 449 users (16%) already cross the threshold and 2 have ever converted — that's exposure, not persuasion. Deliberately deprioritized per your call; keep the build small. |
| 8 | Trial day 2 | Reminder push (§3.6). | Backs the promise. Protects refunds and ratings. |
| 9 | Trial day 3 | Expiry paywall — the one moment a straight paid ask is correct, because they've now felt it. | |
| 10 | Post-conversion | `PlusWelcomeFlow` (exists) teaches filters + who-viewed. | Swipe-trigger converts already retain at 80%; the cheapest way to protect that is making sure they discover the other two features they're paying for. |

### 5.3 Collision rules

- The wall always wins. If two triggers qualify in one session, the wall shows and everything else
  suppresses.
- After any wall ask, suppress the filter ask for 24h.
- Who-viewed never interrupts — it badges and notifies, it does not take over the screen.
- One full-screen monetization moment per session, maximum.

---

## 6. Measurement

Existing and reusable: `swipe_limit_reached`, `paywall_viewed{surface,trigger}`, `checkout_started`,
`purchase_completed`, `purchase_cancelled`, `conversion_trigger` on `users`.

Add:

- `trial_started { surface, rail, plan }` — the missing bottom of the new funnel. Today a trial start
  and a full-price purchase are indistinguishable in analytics.
- `wall_cta_tapped` / `wall_declined { repeat_hit_count }`
- `reengagement_sent` / `reengagement_opened { variant, hit_count }`
- `filter_free_used` / `filter_gate_hit`

**Primary funnel:** `swipe_limit_reached` → `wall_cta_tapped` → `trial_started` → `purchase_completed`.

**Targets:** ≥25% of cap-hitters start a trial within their first two cap hits; ≥40% trial→paid.

**Do not A/B this.** At 46–130 signups/day and a ~1% baseline, splitting traffic gives you an
underpowered test that will read as noise for months — the same trap the earlier "0% vs 6% swing"
turned out to be. Ship the redesign to 100%, compare the 14 days before against the 14 days after on
the funnel above, and watch D3/D7 retention alongside it so you'd notice if the new wall is winning
conversions by burning the habit.

---

## 7. Build sequence

**P0 — web-only, ships same day, no App Store cycle** *(the whole §3 wall lives here)*
1. Unstub `getTrialStatus()`.
2. Rewire the wall: new hierarchy, demote the countdown, deck peek, real deck count, single CTA.
3. Wall → `TrialOfferPaywall` with a `source` prop; earned-frame headline; plain tap instead of hold.
4. Native decoy plan → Monthly (defect #2). Add Restore Purchases to `TrialOfferPaywall` (defect #4).
5. Swipe-8 counter. Decline soft-landing. New analytics events.

**P1 — web + cron**
6. `/api/cron/trial-ending` — makes the day-2 promise real (defect #3).
7. Record destination on right-swipe (unblocks all personalization).
8. Re-engagement ladder v1: `reengagement_sends` table, push #1 and #2, hygiene rules.

**P2**
9. Filters live, free-once-then-Plus.
10. 3rd-cap-hit full-screen ask at app open.

**P3 — needs an EAS build + App Store review**
11. `get_intro_eligibility` bridge message; truthful ineligible variant.
12. Confirm/remove the weekly guard once a weekly-aware build is live.
13. Who-viewed visibility fix.

**P4**
14. RevenueCat promotional-entitlement gift for the 4+ segment.

---

## 8. Risks I'd flag before building

- **The cap could be the wrong lever entirely.** Median swipes/day is *exactly 10* — the cap. That
  means the cap, not disinterest, is defining the ceiling of engagement for the median active user,
  on a product whose value depends on liquidity (people joining each other's trips). If the new wall
  converts well but D3/D7 sags below ~8%, you're buying subscriptions with habit. Watch both.
- **Top-of-funnel is shrinking independently** (daily active swipers fell from ~130–170 to ~47–81
  between late July and early August). No paywall design fixes that, and a conversion-rate improvement
  on a shrinking base can look like success while revenue stays flat. Worth its own session.
- **Sandbox trial verification is still outstanding.** No one has yet confirmed the 3-day offer
  renders correctly for a genuinely eligible Apple ID (the test device's ID had already consumed
  eligibility). Do this before shipping copy that promises free days.
- **The `paywall_viewed` surface enum needs the new value** or the wall's trial screen will be
  indistinguishable from onboarding's in every funnel you build on top of it.
