# TripAlong — agent briefing

Read this before doing anything. It's the stuff that isn't discoverable from the
code and that has already cost real time or real breakage.

---

## What TripAlong is

A travel-companion swipe app. Users post trips, other users swipe and join,
everyone lands in a group chat. Monetisation is a subscription (TripAlong+),
no ads. Launched July 2026. ~3,400 users, ~17 active subscribers.

**Two repos, and the relationship between them is the single most important
thing to understand:**

| Repo | What it is |
|---|---|
| `~/Desktop/tripalong-web` | Next.js 16 App Router + Supabase. The actual product. |
| `~/Desktop/tripalong-app` | Expo SDK 56 native app. A **thin WebView wrapper** around the web app. |

The native app renders almost no UI of its own — it loads the deployed web app
in a WebView and bridges to native for purchases, push, haptics and auth. So:

- **Most "app" bugs are web bugs**, fixable with a Vercel deploy, no build,
  no App Store review.
- Native JS changes (anything in `src/` or `App.tsx`) ship via **EAS Update
  (OTA)** — no review.
- Only native config/entitlements (`app.json`, plugins, capabilities) need a
  real **EAS build + App Store review**.

Work out which of those three buckets a task falls into before planning it.
Getting this wrong turns a 10-minute fix into a week of review.

---

## Environment and workflow

**Deploying web:** `cd ~/Desktop/tripalong-web && vercel deploy --prod --yes`

The git-push deploy webhook is unreliable — always deploy explicitly. Watch for
`"readyState": "READY"`. Vercel runs `next build`, which typechecks; a type
error shows up as `Failed to type check` and the deploy aborts.

**Local tooling hangs.** `npx tsc --noEmit` routinely exceeds 5–7 minutes in
both repos, and dev servers hang. Do not try to test locally. Let the Vercel
build be your typecheck. The user tests on-device against production.

**Database:** Supabase MCP tools. Project id `tnstvbxngubfuxatggem`.
`execute_sql` for reads and data fixes, `apply_migration` for DDL. Also keep a
matching `.sql` file in `supabase/migrations/` for the record.

**Secrets:** `vercel env pull` returns **empty strings for every secret** in
this project — they're redacted, not unset. Never conclude a variable is
missing based on a pulled `.env`. `ADMIN_SECRET` guards `/api/admin/*`; ask the
user for the value when you need it.

**Browser automation:** screenshots frequently come back **fully black** on
this app — a capture artifact, not a broken page. Never diagnose from a black
screenshot. Verify through the DOM with `javascript_tool` instead
(`getComputedStyle`, `getBoundingClientRect`). Also note the tab is often
backgrounded, so `document.hidden` is true and animations/timers are throttled
— layout still computes, but opacity/animation state will look wrong.

---

## Non-negotiable constraints

**The WebView host allowlist.** `tripalong-app/src/lib/webBaseUrl.ts` restricts
which hosts the WebView may load. This exists because `WebViewScreen` injects
live Supabase session tokens into every page load — any reachable host can read
them from JS storage. Keep it an **exact-match list**. Never make it a suffix
match: `endsWith('tripalong.app')` also accepts `eviltripalong.app`.

**⚠️ Do not add a redirect from `tripalong-web.vercel.app` to `tripalong.app`.**
Production builds load the vercel host. On 2026-08-12 a 307 redirect was set on
that domain, the redirect target wasn't in the allowlist, and the WebView
silently refused to navigate — `onShouldStartLoadWithRequest` returning false
isn't an error, so `onError` never fired, `app_ready` never arrived, and the
splash never hid. **Every install hard-hung on the splash screen.** The
redirect was removed via the Vercel API. An OTA that allowlists both hosts is
committed but not yet shipped; until it ships, re-adding that redirect takes
the whole app down again, silently.

**Creator tables** (`creator_codes`, `creator_referrals`, `creator_commissions`,
`creators`, `creator_access_codes`, `deep_link_clicks`) have RLS enabled with
**no policies** — service-role only, all access through server routes. Never
touch them from the client.

**Comp codes are stored as SHA-256 hashes only.** The raw code is never written
to the database. Generate it, hand it to the user, store only the hash. It
cannot be recovered — if lost, revoke the row and mint a new one.

**The creator portal must never expose** individual user data or TripAlong's own
revenue. Aggregates only, enforced server-side.

---

## Traps that have already bitten

- **Typed analytics.** `track()` takes a key of `EventProps` in
  `src/lib/analytics.ts`. A new event name fails the build until you add it to
  that type.
- **Hooks before early returns.** New hook calls must go above any
  `return null` in a component, or you get a Rules-of-Hooks crash.
- **`isNativeApp` from `lib/native-app` is a module constant** evaluated once at
  load, and it can freeze at `false` on the very first page of a fresh WebView
  session. For anything running on first load, check
  `(window as any).ReactNativeWebView` live instead.
- **Metro doesn't typecheck.** In `tripalong-app`, a bad import ships silently.
  `getPathFromDeepLink` was imported by `App.tsx` and did not exist for an
  unknown length of time; the call threw and a `.catch()` swallowed it, killing
  every deep link. Run `npx tsc --noEmit` there when touching native (in the
  background — it's slow).
- **`getTrialStatus()` in `lib/trial.ts` is hard-stubbed** to `'active'`. Six
  call sites depend on the stub. Don't "fix" it without tracing all six —
  unstubbing resurrects an old no-card trial and walls real users.
- **`subscription_expires_at` is never read by `hasPlus()`.** The
  `/api/cron/expire-comps` job is the only thing that ends a comp. Don't
  "fix" this in `hasPlus()`.
- **Apple takes 30%, not 15%.** Not enrolled in the Small Business Program (as
  far as we know — see open threads). Real commission rows show
  `net/gross = 0.6999`. Any economics assuming 85% takehome is wrong.
- **Share links must never use `window.location.origin`.** Inside the app that's
  the vercel host. Use `shareUrl()` from `src/lib/shareUrl.ts`.

---

## How the user works

Direct, fast-moving, types quickly with typos — read through them. Wants an
agent that **executes rather than advises**: investigate, then do the thing,
then report what you actually verified. Don't present a menu of options when
one is clearly right; recommend and proceed.

But: **verify before claiming**. This project has burned multiple agents (me
included) asserting something worked based on a `curl 200` or a screenshot.
Check the actual behaviour, and say plainly when you haven't.

Deploys and DB writes to production are expected and fine. **Ask first** for
anything that reaches users irreversibly — pushing an EAS Update, submitting a
build, sending email/push to real users.

---

## Open threads as of 2026-08-13

- **iPad App Store rejection** (guideline 4, build 1.5 (82)). Fixed on the web
  and deployed. Awaiting a Resolution Center reply — no new binary needed,
  since the splash is web content.
- **OTA not yet pushed.** `tripalong-app` commit `1cf4039` fixes the WebView
  allowlist and adds the missing `getPathFromDeepLink`. Typechecked, committed,
  **not shipped**. Only published update is runtime `18.4` (build 76);
  `app.json` is now `18.5`, so a new update targets build 82 only.
- **`associatedDomains` missing from `app.json`** — Universal Links have never
  worked. The AASA file is served correctly but the app never claims the
  domain. Needs a real build. Note `EXPO_NO_CAPABILITY_SYNC: "1"` on the
  production profile will block EAS from auto-enabling the capability.
- **Small Business Program status unknown.** RevenueCat reports 70% takehome,
  but App Store Connect proceeds imply ~86%. Decisive check is the
  **Partner Share Percentage** column (70 or 85) in a downloaded financial
  report. If 85, `FALLBACK_TAKEHOME` in the RevenueCat webhook goes back to
  0.85 and existing commission rows need recomputing (both are unpaid).
- **Deferred deep linking just shipped** (web-only, fingerprint matching).
  Measure `deep_link_trip_opened` against capture volume to get the real match
  rate before trusting it.
- **Two commission rows were written from one purchase.** Needs raw RevenueCat
  event inspection before any real payout.
- **Six creator comp codes issued** and unredeemed. The `note` field on
  `creator_access_codes` is the only record of who got which code.
- **Android is unstarted** — no Play products, no `google-services.json`, no
  submit config.
