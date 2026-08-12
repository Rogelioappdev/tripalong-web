/**
 * Client half of deferred deep linking.
 *
 * Flow across the App Store boundary:
 *   1. Browser, no app: someone taps a shared trip link, then "Get the app".
 *      captureDeepLink() records the trip against this device, then we send
 *      them to the App Store.
 *   2. App installed, first launch: claimDeepLink() asks whether this device
 *      tapped anything recently, and stashes the answer.
 *   3. Onboarding finishes: takePendingTrip() hands it over and clears it,
 *      so they land on that trip instead of the generic feed.
 */

const PENDING_KEY = 'tripalong.pendingDeepLinkTrip'
const CLAIM_ATTEMPTED_KEY = 'tripalong.deepLinkClaimAttempted'

export const APP_STORE_URL =
  'https://apps.apple.com/us/app/tagalong-find-trips-together/id6758787857'

/** Coarse device shape. Must be gathered identically on both sides. */
function hint() {
  return {
    platform: typeof navigator !== 'undefined' ? navigator.platform || null : null,
    tz: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null }
    })(),
    lang: typeof navigator !== 'undefined' ? navigator.language || null : null,
    // Orientation-independent, so a rotated device still matches itself.
    screen: typeof window !== 'undefined'
      ? `${Math.min(screen.width, screen.height)}x${Math.max(screen.width, screen.height)}`
      : null,
  }
}

/**
 * Remember this trip for after the install, then hand back control. Awaited
 * before navigating to the App Store — if the request is still in flight when
 * the page unloads it may never reach us, and the whole feature depends on
 * this one write. keepalive covers the unload race anyway.
 */
export async function captureDeepLink(tripId: string): Promise<void> {
  try {
    await fetch('/api/deep-link/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId, ...hint() }),
      keepalive: true,
    })
  } catch {
    // Best-effort: a failed capture costs a personalised first screen, not
    // the install. Never block the App Store hand-off on it.
  }
}

/**
 * Ask whether this device tapped a trip link before the app existed on it.
 * Safe to call on every boot — it only ever runs once per install, and the
 * server claims the row so a repeat can't be handed the same click.
 */
export async function claimDeepLink(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    if (localStorage.getItem(CLAIM_ATTEMPTED_KEY)) return null
    localStorage.setItem(CLAIM_ATTEMPTED_KEY, '1')

    const res = await fetch('/api/deep-link/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hint()),
    })
    const { trip_id } = await res.json()
    if (!trip_id) return null

    localStorage.setItem(PENDING_KEY, trip_id)
    return trip_id
  } catch {
    return null
  }
}

/** Read and clear the pending trip. Clears even on read so it can't re-fire. */
export function takePendingTrip(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = localStorage.getItem(PENDING_KEY)
    if (id) localStorage.removeItem(PENDING_KEY)
    return id
  } catch {
    return null
  }
}

/**
 * Live check for the native WebView bridge.
 *
 * Deliberately not the isNativeApp constant from lib/native-app: that is
 * evaluated once at module load and documents itself as unreliable on the
 * very first page of a fresh WebView session — which is precisely when the
 * claim runs. Reading window each time avoids being frozen at false.
 */
export function inNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ReactNativeWebView
}

/** iOS Safari/Chrome on a phone or tablet — i.e. can we send them to the App Store. */
export function isIosWeb(): boolean {
  if (typeof navigator === 'undefined') return false
  if (inNativeApp()) return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; the touch-point check separates a
  // real iPad from a desktop Safari that would have nowhere to go.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return /iPhone|iPod|iPad/.test(ua) || iPadOS
}
