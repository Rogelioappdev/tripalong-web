# Plus feature #2 — strategy

**Written 2026-08-06. Strategy + specs, no code.** Companion to `PAYWALL_STRATEGY.md`, which
covers the swipe wall (feature #1, unlimited swipes) and is now shipped.

---

## 0. The short version

You picked **location filtering** as feature #2. I planned it, and the data says it can't carry
that slot yet — not because the feature is bad but because **there isn't enough trip supply for a
location filter to return a satisfying result.** Selling it today means selling an empty feed.

The data instead points hard at **"who viewed you"**, which you deprioritised as a visibility
problem. It still is a visibility problem. That's exactly why it should be #2: a distribution fix
is cheap and within your control, and a supply problem is neither.

Recommendation: **promote who-viewed to #2, demote location filtering to #3**, and ship a scoped,
honest version of filtering once supply supports it.

---

## 1. Ground truth (read from the live DB and repo, 2026-08-06)

### Filters are already built and already hard-gated

The memory saying filters are "parked and unwired" is out of date. They're live in the feed:

- `FilterBar` renders in `feed/page.tsx:656` with dimensions Location / Date / Styles / Gender / Age.
- `filterGate` (`feed/page.tsx:151`) blocks non-Plus users the moment they tap **Done** on a
  configured filter → `PaywallModal` with `trigger: 'filters'`.
- Nice touch already in place: `pendingFilters` preserves the filter they drafted through the
  purchase, so upgrading applies it instantly instead of making them redo it.

So there is nothing to *build* for filters. The open question was only "free once, then Plus" —
which is currently **not** implemented (it's hard-gated on first use).

### The supply problem, in numbers

| Metric | Value |
|---|---|
| Live trips (`status='planning'`) | **121** |
| Distinct destinations | **105** |
| **Average trips per destination** | **1.15** |
| Destinations with 3+ trips | **5** |
| Distinct countries | 48 |
| Countries with 5+ trips | 6 |
| New trips, last 7 days | **10** |
| New trips, last 30 days | 110 |

A user who filters to a city gets **one trip**, most of the time. A user who filters to a country
gets one to seven. That is not a premium feature; that's a dead end you charged for.

And supply is *falling* — 10 trips in the last 7 days against 110 in the last 30 means the recent
weekly rate is roughly a third of the month's average. Same shape as the signup and active-swiper
decline already flagged.

### The country data is also dirty enough to break the filter on its own

| Country value | Trips |
|---|---|
| `USA` | 16 |
| `United States` | 13 |
| `United States of America` | 3 |
| `Europe` (a continent) | 3 |

The one country with real inventory is split three ways. `applyTripFilters` does a substring match
against `"{destination} {country}"` (`tripFilters.ts:88`), so a user typing "United States" matches
16 of 32 trips and silently misses the rest. Typing "USA" misses 16 the other way.

### Dimension-by-dimension viability

| Dimension | Inventory | Verdict |
|---|---|---|
| **Styles** (vibes) | adventure 85, nature 53, backpacking 45, chill 28, party 26, road trip 24, cultural 19, foodie 18, beach 13 | **The only healthy one.** Real spread, most filters return a usable deck. Casing is dirty (`Adventure` vs `adventure`, `Food` vs `foodie`) — ~17 trips mis-bucketed. |
| **Location** | 1.15 trips/destination | **Unsellable today.** See above. |
| **Date** | 92 of 121 trips are flexible-dates, and flexible always passes the filter | **Near-useless.** Only 29 trips can ever be excluded by a date filter. |
| **Gender** | 112 of 121 are `everyone`; 5 male, 4 female | **Near-useless.** Filters out at most 9 trips. |
| **Age** | 47 of 121 have any age range set | Weak, half the inventory is unconstrained. |

**Four of the five paid filter dimensions barely do anything.** A user who pays for filters and
then discovers that Date and Gender change nothing has been sold a feature that doesn't work —
the precise "misleading paywall" outcome the brand positions against.

### Who-viewed, by contrast

| Metric | Value |
|---|---|
| Total profile views | **9,414** |
| Distinct users who've been viewed | 727 |
| **Users with 3+ distinct viewers** (the reveal threshold) | **476** |
| Views in the last 7 days | **1,294** |
| Conversions ever via `who-viewed` | **2** |

476 people are sitting on an unlocked-by-default reason to pay, right now, and the flow rate is
healthy (~185 views/day) — unlike trips, this supply is *growing*. The feature itself is fully
built (`ProfileViewsSheet.tsx`: blurred avatar grid at `blur(5px)`, live count, its own paywall,
restore, welcome hand-off).

**Its entire problem is that it has one entry point: a small eye icon in the Messages page header
(`messages/page.tsx:547`).** To find it you must navigate to Messages specifically and notice a
badge. The swipe wall, for comparison, fires full-screen inside the app's main loop.

Your own `PRICING_RESEARCH.md` ranks "who liked/viewed you" as the strongest converting trigger in
this category (Hinge 6.5%; Tinder, Bumble and CMB all lead with it). The mechanism isn't weak here
— it's essentially never shown.

---

## 2. Why who-viewed should be #2

Three reasons, in order of weight:

1. **The bottleneck is inside your control.** Filters need more trips, which needs more users
   creating them — a growth problem measured in months. Who-viewed needs a card in the feed,
   measured in hours. Never pick the blocked lever when an unblocked one is sitting there.
2. **The demand already exists and is measurable.** 476 users qualify today. Even a 5% conversion
   on that pool is ~24 subscribers, which would roughly *double* your all-time subscriber count
   (26). No new supply, no new inventory, no store changes.
3. **It's the strongest trigger in the category.** Every mature app in this space leads with it,
   because it's the one notification that's about *you*.

### The psychology it runs on

Three mechanisms stack, which is why it converts elsewhere:

- **Curiosity gap.** A blurred face is unfinished business. The brain treats a nearly-complete
  pattern as a task, and paying completes it. This is the whole mechanic — and it only works if
  the blurred faces are *seen*, which is why placement is everything.
- **Ego / social proof.** "Six people looked at you this week" is flattering in a way no feature
  list is. It's the app telling you that you're wanted, before asking for anything.
- **Reciprocity of attention.** Someone already spent attention on you. Not looking back feels
  like leaving something unanswered.

Critically, none of these are pressure tactics. Nothing is invented, no countdown, no scarcity —
it's a true fact about real people, which is why this fits the "genuine app" line better than any
discount ever will.

---

## 3. The build: give who-viewed a real surface

The feature is done. This is entirely about distribution. Four placements, in priority order.

### 3.1 The feed card (highest impact)

Insert a **profile-views card into the swipe deck itself**, not as an interruption but as a card in
the stack — the same shape and size as a trip card, appearing after roughly the 4th swipe, at most
once every 48 hours, only when the user has 3+ viewers.

- Blurred avatar grid (3 faces max, reusing the existing `blur(5px)` treatment)
- "**6 travelers checked out your profile**" — real number
- "See who" → opens the existing `ProfileViewsSheet`

Why a card and not a banner or modal: the feed is the one surface every active user touches, and a
card inherits the swipe gesture they're already performing. It can be passed like anything else, so
it never blocks. An interruption at this moment would compete with the swipe cap, which owns the
full-screen moment.

**Collision rule: never render this card in a session where the swipe wall has already fired.**
One full-screen monetization moment per session, and the wall always wins.

### 3.2 The push notification (highest reach)

Ties directly into the re-engagement ladder in `PAYWALL_STRATEGY.md` §4 — this is a better first
push than anything invented, because it's real news about them:

> "3 travelers checked out your profile this week."

Rules: fire at most **once per 7 days**, only at 3+ *new* viewers since the last send, obey the
08:00–22:00 local window and the two-monetization-pushes-per-week cap. Deep-link straight into
`ProfileViewsSheet` — not the feed, not Messages.

This one needs the `reengagement_sends` table from the paywall plan (still unbuilt) so it can be
deduped and capped alongside everything else.

### 3.3 Profile tab badge

A count badge on the Profile tab when there are unseen viewers. Cheap, persistent, no interruption.
It's the "there's something waiting for you" pull that makes people open the app at all.

### 3.4 Keep the Messages eye icon

It costs nothing and some users have learned it. Just stop treating it as the entry point.

### What NOT to change

**Don't touch `ProfileViewsSheet`'s paywall.** It already does the job well — blurred grid, real
count, restore path, welcome hand-off. The conversion problem was never on that screen; every
change should be upstream of it. Resist the urge to redesign what's already working.

---

## 4. What to do with location filtering

Not "never" — "not as the paid hook, not yet." Three moves, cheapest first.

### 4.1 Fix the data (prerequisite for anything else)

- **Normalise `trips.country`.** Map `USA` / `United States` / `United States of America` → one
  canonical value; drop or re-bucket continent values like `Europe`. One-time backfill plus
  normalisation at write time in `CreateTripModal`, or the same bug re-accumulates.
- **Normalise vibe casing** (`Adventure`→`adventure`, `Food`→`foodie`, `Culture`→`cultural`). ~17
  trips are currently invisible to the Styles filter that should match.

This is worth doing regardless — it improves the feed, the globe, and matching, not just filters.

### 4.2 Change what "location filter" means: region, not city

At 1.15 trips per destination, city-level filtering can't succeed. Country and region level can:
6 countries have 5+ trips. Replace free-text location with **quick-pick chips for regions that
actually have inventory**, generated from live data (e.g. "United States 32 · Europe 24 · Southeast
Asia 11"), with the count shown on the chip.

Showing the count is the honest move and also the persuasive one: the user sees before tapping that
there are 32 trips behind it, so the filter can't disappoint them.

### 4.3 Turn thin supply into the feature: "Watch a destination"

The real user need isn't filtering — it's *"I want to go to Japan; tell me when someone posts a
Japan trip."* With 1.15 trips per destination, **demand capture beats supply filtering.**

A Plus user can watch up to N destinations and gets a push the moment a matching trip is posted.
This inverts the problem: thin supply makes the filter useless but makes the alert *valuable*,
because the user genuinely can't find these trips by browsing.

It also produces exactly the re-engagement hook the paywall plan wants, with content that's real.

**Honest caveat:** at 1.4 new trips/day across 105 destinations, most watches will fire rarely.
Match at country/region level, not city, and set the expectation in the copy ("we'll ping you when
a Japan trip is posted — it might be a while"). Don't ship this until supply recovers or the
matching is wide enough to fire meaningfully.

---

## 5. The "free once, then Plus" mechanic

Your call from the paywall session, and it's the right shape — it just applies better to **Styles**
than Location, since Styles is the dimension that actually returns a good result.

- Every free user gets **one real filtered session**, any dimension, no strings. It must be
  genuinely good: full results, no teasing, no partial blur.
- When they change a filter a second time → paywall, framed around *keeping* something they've
  already felt rather than buying a promise: "You've used your free search."
- Keep the existing `pendingFilters` behaviour — it's already the right pattern.
- Persist the used-free-search flag **server-side** (a column on `users`), not localStorage;
  otherwise it resets on every reinstall and the gate never fires on the users most likely to pay.

Why free-once is right here specifically: the current hard gate asks people to pay for a feature
whose value they cannot assess — and given the inventory numbers above, a meaningful share of
those payers would have been disappointed. Letting them try it first is both fairer and a filter
against selling a bad experience.

---

## 6. Journey positioning

Extends `PAYWALL_STRATEGY.md` §5. One feature owns one moment; one ask per session.

| Moment | Feature | Ask |
|---|---|---|
| Onboarding trial screen | All of Plus, once, as a bundle | Soft |
| Swipes 1–7, first session | Nothing | — |
| Swipe 10 — the wall | **Unlimited swipes** | The trial (shipped) |
| ~4th swipe, return visit, 3+ viewers | **Who viewed you** (feed card) | Passive, swipeable |
| Push, ≤1×/week, 3+ new viewers | **Who viewed you** | Passive |
| 2nd filter change in a session | **Filters** (once supply supports it) | Contextual |
| Trial day 2 / day 3 | — | Reminder, then expiry |

**Collision rules:** the wall always wins; who-viewed never interrupts (card or badge only, never
full-screen); the filter ask is suppressed for 24h after any wall ask; maximum one full-screen
monetization moment per session.

They reinforce rather than compete because they fire on different intents — momentum (wall),
curiosity (who-viewed), control (filters) — and, for most users, on different days.

---

## 7. Measurement

Add:

- `profile_views_card_shown` / `profile_views_card_tapped` `{ viewer_count }`
- `profile_views_push_sent` / `_opened` `{ viewer_count }`
- `filter_free_used` / `filter_gate_hit` `{ dimension }`
- Extend `paywall_viewed` with `surface: 'profile_views_card'`

**Primary funnel:** `profile_views_card_shown` → `_tapped` → `paywall_viewed{trigger:'who-viewed'}`
→ `purchase_completed`.

**Baseline to beat:** 2 conversions, all time, from 476 eligible users.
**Target:** 3–5% of the eligible pool within 30 days (14–24 subscribers).

Same discipline as the wall: **ship to 100%, don't A/B.** At 26–130 signups/day a split test on a
low-single-digit conversion rate reads as noise for months.

---

## 8. Build sequence

**P0 — the whole point, web-only, no store cycle**
1. Profile-views card in the swipe deck (threshold 3+, ≤1 per 48h, suppressed when the wall fired).
2. Profile tab badge for unseen viewers.
3. The new analytics events.

**P1**
4. Weekly who-viewed push (needs `reengagement_sends` from the paywall plan).
5. Country + vibe normalisation backfill, and normalise at write time.

**P2**
6. Free-once filters, server-side flag, framed as keeping what they've felt.
7. Region quick-picks with live counts replacing free-text location.

**P3 — only once supply recovers**
8. "Watch a destination" alerts.

**Not now:** Date and Gender filters. Leave them visible but understand they convert nothing; if
anything, consider hiding Gender until there's inventory behind it.

---

## 9. Risks

- **The real ceiling on all of this is supply and top-of-funnel, not paywall design.** 10 new trips
  in 7 days and falling signups will cap every conversion feature you build. Filters are the
  clearest casualty, but a shrinking feed eventually degrades the swipe wall too — you can't sell
  "unlimited swipes" on a deck that runs dry. This deserves its own session more than feature #3
  does.
- **476 is a stock, not a flow.** Those viewers accumulated over months; once the backlog converts,
  the ongoing rate is what matters (~185 views/day). Expect a spike then a lower plateau.
- **Who-viewed can feel creepy if overplayed.** Keep it factual and infrequent. Blurred faces and a
  real count, never "someone is interested in you 👀".
- **Don't let the card become an ad slot.** The moment the feed contains two non-trip cards, the
  product stops being a trip feed. One card, hard-capped.
