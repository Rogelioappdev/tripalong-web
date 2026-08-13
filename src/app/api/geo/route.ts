export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * Best-guess city for the requesting device, from Vercel's edge geolocation.
 *
 * Used to prefill the onboarding location step, which was costing 20% of
 * everyone who reached it — it demanded a typed city search with no skip and
 * no fallback. Prefilling turns the common case into a single confirm tap.
 *
 * Deliberately IP-based rather than navigator.geolocation: device GPS raises
 * an OS permission prompt, which is *more* friction than typing, and a denial
 * leaves the user worse off than before we asked. These headers cost nothing,
 * need no permission, and are already on the request.
 *
 * The result is a guess and is always presented as editable. IP geolocation
 * is wrong for VPNs and can be a whole region off on mobile carrier NAT, so
 * this must never be written to a profile without the user confirming it.
 */
export async function GET(req: NextRequest) {
  // Vercel URL-encodes these (e.g. "Mexico%20City") since headers must be
  // latin-1 — decoding is required, not cosmetic, for any city with a space
  // or an accent.
  const dec = (v: string | null) => {
    if (!v) return null
    try { return decodeURIComponent(v).trim() || null } catch { return v.trim() || null }
  }

  const city = dec(req.headers.get('x-vercel-ip-city'))
  const country = dec(req.headers.get('x-vercel-ip-country'))
  const region = dec(req.headers.get('x-vercel-ip-country-region'))

  return NextResponse.json(
    { city, country, region },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
