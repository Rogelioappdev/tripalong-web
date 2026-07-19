// One-off backfill: geocode existing trips that have no coordinates yet, so
// they show up on the TripAlong World globe (/world). New trips are geocoded
// at creation time; this catches everything created before that existed.
//
// Run once, after applying the 20260715_trip_coordinates.sql migration:
//   node --env-file=.env.local scripts/backfill-coords.mjs
// or inline:
//   NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<key>" node scripts/backfill-coords.mjs
//
// Safe to re-run: it only touches trips still missing coordinates.
// Uses the service-role key (bypasses RLS) and the free, keyless Open-Meteo
// geocoder, throttled to be nice to the free API.
//
// NOTE: keep normCountry / placeCandidates / resolve in sync with
// src/app/api/geocode/route.ts.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/backfill-coords.mjs')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function normCountry(raw) {
  if (!raw) return ''
  const v = String(raw).toLowerCase().replace(/[.\-_,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/\b(usa|u s a|us|united states)\b/.test(v)) return 'united states'
  if (/\b(uk|u k|united kingdom|england|scotland|wales|britain|great britain)\b/.test(v)) return 'united kingdom'
  if (/m[eé]xico|mexico/.test(v)) return 'mexico'
  return v
}

function placeCandidates(destination) {
  const out = []
  const add = (s) => {
    const v = (s || '').trim().replace(/\s+/g, ' ')
    if (v && v.length > 1 && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  const dest = (destination || '').trim()
  add(dest)

  const seg = dest.split(/[,/:()\n]|—|–| - | and | & |\+/i)[0].trim()
  add(seg)

  const FILLER = /\b(trips?|road ?trips?|backpacking|camping|hiking|hike|spree|tour|travel(?:ling|ing)?|adventure|wide|state ?wide|nat'?l|national|parks?|beach|falls?|mountains?|the|a|to|in|at|of|after|and|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi
  const cleaned = seg.replace(FILLER, ' ').replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  add(cleaned)

  const words = cleaned.split(' ').filter(Boolean)
  if (words.length >= 2) add(words.slice(0, 2).join(' '))
  if (words.length >= 1) add(words[0])

  return out
}

async function fetchMatches(name) {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`
  try {
    const res = await fetch(u)
    if (!res.ok) return []
    const data = await res.json()
    return data?.results ?? []
  } catch {
    return []
  }
}

function toResult(m, via) {
  if (typeof m?.latitude !== 'number' || typeof m?.longitude !== 'number') return null
  return { lat: m.latitude, lng: m.longitude, matched: m.name, via }
}

async function resolve(destination, country) {
  const wanted = normCountry(country)
  for (const cand of placeCandidates(destination)) {
    const matches = await fetchMatches(cand)
    await sleep(300) // gentle pacing between lookups
    if (matches.length === 0) continue
    const m = wanted ? matches.find((x) => normCountry(x.country) === wanted) : matches[0]
    const r = toResult(m, cand)
    if (r) return r
  }
  if (wanted) {
    const cm = await fetchMatches(wanted)
    await sleep(300)
    const r = toResult(cm.find((x) => normCountry(x.country) === wanted), `${country} (country)`)
    if (r) return r
  }
  return null
}

async function main() {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, destination, country')
    .is('latitude', null)
    .not('destination', 'is', null)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  console.log(`Found ${trips.length} trip(s) without coordinates.\n`)
  let ok = 0
  let fail = 0

  for (const t of trips) {
    const coords = await resolve(t.destination, t.country)
    if (!coords) {
      fail++
      console.log(`  ✗ no match: ${t.destination} (${t.country ?? '—'})`)
      continue
    }
    const { error: upErr } = await supabase
      .from('trips')
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq('id', t.id)
    if (upErr) {
      fail++
      console.log(`  ! update failed for ${t.destination}: ${upErr.message}`)
    } else {
      ok++
      const exact = coords.via.toLowerCase() === (t.destination || '').trim().toLowerCase()
      console.log(`  ✓ ${t.destination} → ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}${exact ? '' : `  (via "${coords.via}")`}`)
    }
  }

  console.log(`\nDone. ${ok} geocoded, ${fail} failed.`)

  const { count } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .not('latitude', 'is', null)
  if (typeof count === 'number') console.log(`${count} trip(s) are now on the map.`)

  process.exit(0)
}

main()
