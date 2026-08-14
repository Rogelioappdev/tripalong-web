<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TripAlong

**Read `AGENT_ONBOARDING.md` in this repo root before starting any task.** It
covers the workflows, the constraints you must not relax, and the traps that
have already broken production here. Everything below is only the part that is
dangerous to learn late.

**This app has two halves.** `~/Desktop/tripalong-web` is the product;
`~/Desktop/tripalong-app` is a thin Expo WebView wrapper that loads it. Most
"app" bugs are web bugs. Decide which of three paths a change ships on before
planning it: **web deploy** (instant), **EAS Update / OTA** (native JS, no
review), or **EAS build** (native config only, App Store review).

**Deploy with `vercel deploy --prod --yes`.** The git-push webhook is
unreliable. Vercel's build is also your typecheck.

**Don't test locally.** `tsc` and dev servers routinely hang for 5+ minutes in
both repos. The user tests on-device against production.

**⚠️ Never add a redirect from `tripalong-web.vercel.app` to `tripalong.app`.**
Production builds load the vercel host, and the WebView allowlist rejects the
redirect target — this hard-hung every install on the splash screen with no
error anywhere on 2026-08-12. Stays true until the pending OTA ships.

**Verify before claiming.** A `curl 200` is not proof a page works, and
screenshots of this app frequently come back fully black as a capture artifact
— check the DOM instead. Multiple agents have reported success here on
evidence that didn't hold.
