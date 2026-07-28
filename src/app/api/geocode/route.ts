export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// Geocodes a trip destination → { lat, lng } using the free, keyless Open-Meteo
// Geocoding API (no token / registration). Used on trip creation and by
// scripts/backfill-coords.mjs to populate trips.latitude / trips.longitude.
//
// Trip destinations are free text and often messy ("Denver Colorado camping Aug
// 4-11", "Tokyo and Kyoto", "Havasupai Falls, Arizona"), so we try a ladder of
// progressively looser candidates. Matches are constrained to the trip's country
// so a loose prefix can never drop a pin on the wrong continent; if nothing
// resolves precisely we fall back to the country's centre point.
//
// NOTE: keep normCountry / placeCandidates / resolve in sync with
// scripts/backfill-coords.mjs.

function normCountry(raw?: string | null): string {
  if (!raw) return ''
  const v = String(raw).toLowerCase().replace(/[.\-_,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/\b(usa|u s a|us|united states)\b/.test(v)) return 'united states'
  if (/\b(uk|u k|united kingdom|england|scotland|wales|britain|great britain)\b/.test(v)) return 'united kingdom'
  if (/m[eé]xico|mexico/.test(v)) return 'mexico'
  return v
}

function placeCandidates(destination: string): string[] {
  const out: string[] = []
  const add = (s?: string) => {
    const v = (s || '').trim().replace(/\s+/g, ' ')
    if (v && v.length > 1 && !out.some(o => o.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  const dest = (destination || '').trim()
  add(dest)

  // First segment before any separator (comma, slash, colon, parens, dash, "and", "&", "+", newline).
  const seg = dest.split(/[,/:()\n]|—|–| - | and | & |\+/i)[0].trim()
  add(seg)

  // Strip non-place words (activities, generic geo nouns, months) and punctuation.
  const FILLER = /\b(trips?|road ?trips?|backpacking|camping|hiking|hike|spree|tour|travel(?:ling|ing)?|adventure|wide|state ?wide|nat'?l|national|parks?|beach|falls?|mountains?|the|a|to|in|at|of|after|and|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi
  const cleaned = seg.replace(FILLER, ' ').replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  add(cleaned)

  // Progressively shorter prefixes of the cleaned segment.
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length >= 2) add(words.slice(0, 2).join(' '))
  if (words.length >= 1) add(words[0])

  return out
}

async function fetchMatches(name: string): Promise<any[]> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}` +
    `&count=10&language=en&format=json`
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } }) // coords are stable — cache 30d
  if (!res.ok) return []
  const data = await res.json()
  return data?.results ?? []
}

function toResult(m: any) {
  if (typeof m?.latitude !== 'number' || typeof m?.longitude !== 'number') return null
  return { lat: m.latitude, lng: m.longitude, name: m.name, country: m.country ?? null }
}

async function resolve(destination: string, country?: string) {
  const wanted = normCountry(country)
  for (const cand of placeCandidates(destination)) {
    const matches = await fetchMatches(cand)
    if (matches.length === 0) continue
    // When we know the country, only accept an in-country match (never a
    // same-name place on another continent). Otherwise take the top hit.
    const m = wanted ? matches.find(x => normCountry(x.country) === wanted) : matches[0]
    const r = toResult(m)
    if (r) return r
  }
  // Fallback: the country's own centre point.
  if (wanted) {
    const cm = await fetchMatches(wanted)
    const r = toResult(cm.find(x => normCountry(x.country) === wanted))
    if (r) return r
  }
  return null
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const country = req.nextUrl.searchParams.get('country')?.trim() || undefined
  if (!q) return NextResponse.json({ result: null })

  try {
    return NextResponse.json({ result: await resolve(q, country) })
  } catch (e) {
    console.error('[geocode] error', e)
    return NextResponse.json({ result: null })
  }
}
