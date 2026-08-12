/**
 * Canonical public origin for anything a user might share.
 *
 * Share links must NEVER be built from window.location.origin. Inside the
 * native app the web content is served from tripalong-web.vercel.app, so a
 * link copied from the app carried that host — and Apple's Universal Links
 * only ever match the domain named in the app's associatedDomains
 * entitlement. A vercel.app link therefore can't open the app on any device,
 * no matter how it's configured; it always falls through to the browser.
 *
 * That is exactly what happened with the first creator share: the link
 * worked, but opened the website for everyone who tapped it, including
 * people who already had the app installed.
 *
 * Preview builds are the one deliberate exception — they point at a
 * branch deployment and sharing a canonical link from there would send a
 * tester to production content.
 */
const CANONICAL_ORIGIN = 'https://tripalong.app'

function isPreviewHost(origin: string): boolean {
  return origin.includes('-git-') || origin.includes('localhost')
}

/** Absolute, shareable URL for a path like `/trip/123`. */
export function shareUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined' && isPreviewHost(window.location.origin)) {
    return `${window.location.origin}${p}`
  }
  return `${CANONICAL_ORIGIN}${p}`
}

export { CANONICAL_ORIGIN }
