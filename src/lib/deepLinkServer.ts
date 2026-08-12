import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Shared server-side pieces of deferred deep linking.
 *
 * See supabase/migrations/20260812_deep_link_clicks.sql for why this
 * technique exists and where it's expected to fail.
 */

/**
 * The client's address as Vercel sees it.
 *
 * x-forwarded-for is a chain — "client, proxy1, proxy2" — and the client is
 * the FIRST entry. Taking the last (or the whole string) would key every
 * match on a shared proxy address, which would match strangers to each
 * other's trips.
 */
export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || null
}

/**
 * Salted hash of an address. We never store the address itself: this table
 * maps network identity to browsing activity, so the raw value would be the
 * most sensitive thing in the database for the least reason.
 *
 * The salt is a server-only secret. Without one, an unsalted SHA-256 of an
 * IP is trivially reversible — the entire IPv4 space is 4 billion hashes,
 * which is minutes of compute.
 */
export function hashIp(ip: string): string {
  const salt = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

/**
 * How long a click stays claimable. Long enough to cover App Store download,
 * first launch and a full onboarding run; short enough that we aren't
 * matching someone to a link they tapped this morning.
 */
export const CLAIM_WINDOW_MINUTES = 180

/** Coarse device shape sent by the client, normalised and length-capped. */
export interface DeviceHint {
  platform: string | null
  tz: string | null
  lang: string | null
  screen: string | null
}

const cap = (v: unknown, n: number) => {
  const s = String(v ?? '').trim().slice(0, n)
  return s || null
}

export function deviceHint(body: any): DeviceHint {
  return {
    platform: cap(body?.platform, 40),
    tz: cap(body?.tz, 60),
    lang: cap(body?.lang, 20),
    screen: cap(body?.screen, 20),
  }
}

/**
 * Score a candidate click against the device now asking to claim it.
 *
 * IP equality is already guaranteed by the query, so this only breaks ties
 * between several people behind one address. Language and timezone are the
 * useful signals; screen size is weakest because every iPhone of a given
 * model matches, and the browser and the WebView can report it differently.
 *
 * Note we do NOT compare user-agent. Safari and the in-app WebView send
 * different UA strings for the same device, so requiring a UA match would
 * reject exactly the case this whole system is built for.
 */
export function matchScore(row: any, hint: DeviceHint): number {
  let score = 0
  if (hint.lang && row.lang === hint.lang) score += 3
  if (hint.tz && row.tz === hint.tz) score += 3
  if (hint.platform && row.platform === hint.platform) score += 2
  if (hint.screen && row.screen === hint.screen) score += 1
  return score
}
