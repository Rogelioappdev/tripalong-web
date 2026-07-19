// Pure, React-free trip filtering engine shared by TripAlong World (now) and
// the swipe feed (later). Both surfaces already fetch trips and filter them
// client-side, so this slots in with no query or schema changes.

import type { TripWithDetails } from './types'
import { SEASON_RANGES, VIBES } from './tripOptions'

export type FilterDimension = 'location' | 'seasons' | 'styles' | 'genders' | 'ageRange'

export type TripFilters = {
  location: string | null            // free-text place query (destination/country)
  seasons: string[]                  // season labels, e.g. ['Summer 2026']
  dateRange: [string, string] | null // custom calendar range [fromISO, toISO]; '' = open bound
  styles: string[]                   // vibe values, matched against trip.vibes
  genders: string[]                  // group_preference values: female|male|mixed|everyone
  ageRange: [number, number] | null  // null = any age
}

export const AGE_MIN = 18
export const AGE_MAX = 65 // slider tops out here; treated as "65+"

export const EMPTY_FILTERS: TripFilters = {
  location: null,
  seasons: [],
  dateRange: null,
  styles: [],
  genders: [],
  ageRange: null,
}

// True when two inclusive numeric/date ranges overlap.
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

function tripMatchesDate(
  trip: TripWithDetails,
  seasons: string[],
  dateRange: [string, string] | null,
): boolean {
  if (seasons.length === 0 && !dateRange) return true
  // Flexible / undated trips are "whenever" — always pass a date filter.
  if (trip.is_flexible_dates || (!trip.start_date && !trip.end_date)) return true
  const s = trip.start_date ? new Date(trip.start_date).getTime() : NaN
  const e = trip.end_date ? new Date(trip.end_date).getTime() : s
  const start = Number.isNaN(s) ? e : s
  const end = Number.isNaN(e) ? s : e
  if (Number.isNaN(start)) return true // unparseable → don't hide it

  const seasonHit = seasons.some(label => {
    const r = SEASON_RANGES[label]
    return !!r && overlaps(start, end, new Date(r.start).getTime(), new Date(r.end).getTime())
  })
  const rangeHit = dateRange
    ? overlaps(
        start, end,
        dateRange[0] ? new Date(dateRange[0]).getTime() : -Infinity,
        dateRange[1] ? new Date(dateRange[1]).getTime() : Infinity,
      )
    : false
  // Pass if the trip matches any active date criterion (seasons OR custom range).
  return seasonHit || rangeHit
}

function tripMatchesAge(trip: TripWithDetails, range: [number, number] | null): boolean {
  if (!range) return true
  // A trip with no stated age range welcomes everyone → always passes.
  if (trip.age_min == null && trip.age_max == null) return true
  const lo = trip.age_min ?? AGE_MIN
  const hi = trip.age_max ?? 99
  return overlaps(lo, hi, range[0], range[1])
}

export function applyTripFilters(trips: TripWithDetails[], f: TripFilters): TripWithDetails[] {
  const q = f.location?.trim().toLowerCase() || null
  const styleSet = f.styles.length ? new Set(f.styles) : null
  const genderSet = f.genders.length ? new Set(f.genders) : null

  return trips.filter(trip => {
    if (q) {
      const hay = `${trip.destination ?? ''} ${trip.country ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (genderSet && !genderSet.has(trip.group_preference ?? 'everyone')) return false
    if (styleSet) {
      const vibes = trip.vibes ?? []
      if (!vibes.some(v => styleSet.has(v))) return false
    }
    if (!tripMatchesDate(trip, f.seasons, f.dateRange)) return false
    if (!tripMatchesAge(trip, f.ageRange)) return false
    return true
  })
}

export function isDimensionActive(f: TripFilters, dim: FilterDimension): boolean {
  switch (dim) {
    case 'location': return !!f.location?.trim()
    case 'seasons': return f.seasons.length > 0 || f.dateRange != null
    case 'styles': return f.styles.length > 0
    case 'genders': return f.genders.length > 0
    case 'ageRange': return f.ageRange != null
    default: return false
  }
}

export function activeFilterCount(f: TripFilters): number {
  return (['location', 'seasons', 'styles', 'genders', 'ageRange'] as FilterDimension[])
    .filter(d => isDimensionActive(f, d)).length
}

const GENDER_SHORT: Record<string, string> = {
  everyone: 'Any', female: 'Women', male: 'Men', mixed: 'Mixed',
}

// Short value shown on an active chip; null when the dimension is unset (chip
// shows its plain label instead).
export function chipValueLabel(dim: FilterDimension, f: TripFilters): string | null {
  switch (dim) {
    case 'location':
      return f.location?.trim() || null
    case 'seasons': {
      if (f.dateRange) {
        const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const [lo, hi] = f.dateRange
        if (lo && hi) return `${fmt(lo)} – ${fmt(hi)}`
        if (lo) return `From ${fmt(lo)}`
        if (hi) return `Until ${fmt(hi)}`
      }
      if (f.seasons.length === 0) return null
      return f.seasons.length === 1
        ? f.seasons[0].replace(' 20', " '") // "Summer 2026" → "Summer '26"
        : `${f.seasons.length} seasons`
    }
    case 'styles': {
      if (f.styles.length === 0) return null
      if (f.styles.length === 1) return VIBES.find(v => v.value === f.styles[0])?.label ?? '1 style'
      return `${f.styles.length} styles`
    }
    case 'genders':
      if (f.genders.length === 0) return null
      return f.genders.length === 1
        ? GENDER_SHORT[f.genders[0]] ?? f.genders[0]
        : `${f.genders.length} groups`
    case 'ageRange':
      if (!f.ageRange) return null
      return f.ageRange[1] >= AGE_MAX ? `${f.ageRange[0]}+` : `${f.ageRange[0]}–${f.ageRange[1]}`
    default:
      return null
  }
}
