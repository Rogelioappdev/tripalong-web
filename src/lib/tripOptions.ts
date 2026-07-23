// Single source of truth for the trip attribute vocabularies used across trip
// creation AND discovery filters (TripAlong World now, the feed later). These
// used to be private consts inside CreateTripModal; sharing them keeps the
// create form and the filter UI from ever drifting apart.

export type TripVibe = { value: string; label: string; emoji: string }

export const VIBES: TripVibe[] = [
  { value: 'adventure', label: 'Adventure', emoji: '🏕️' },
  { value: 'chill', label: 'Chill', emoji: '😊' },
  { value: 'nature', label: 'Nature', emoji: '🌿' },
  { value: 'cultural', label: 'Culture', emoji: '🏛️' },
  { value: 'foodie', label: 'Food', emoji: '🍜' },
  { value: 'party', label: 'Party', emoji: '🎉' },
  { value: 'beach', label: 'Beach', emoji: '🏖️' },
  { value: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { value: 'road trip', label: 'Road Trip', emoji: '🚗' },
  { value: 'backpacking', label: 'Backpacking', emoji: '🎒' },
]

export const GROUP_PREFS: { value: string; label: string; emoji: string }[] = [
  { value: 'everyone', label: 'Any', emoji: '🌍' },
  { value: 'female', label: 'Women only', emoji: '👩' },
  { value: 'male', label: 'Men only', emoji: '👨' },
  { value: 'mixed', label: 'Mixed', emoji: '🤝' },
]

// Northern-hemisphere season windows, keyed by the year the season starts in.
// Winter spans into the following year, so its end date rolls over.
type SeasonDef = {
  name: string
  startMonth: number; startDay: number
  endMonth: number; endDay: number
  endYearOffset: number
}
const SEASON_DEFS: SeasonDef[] = [
  { name: 'Spring', startMonth: 3,  startDay: 1, endMonth: 5,  endDay: 31, endYearOffset: 0 },
  { name: 'Summer', startMonth: 6,  startDay: 1, endMonth: 8,  endDay: 31, endYearOffset: 0 },
  { name: 'Fall',   startMonth: 9,  startDay: 1, endMonth: 11, endDay: 30, endYearOffset: 0 },
  { name: 'Winter', startMonth: 12, startDay: 1, endMonth: 2,  endDay: 28, endYearOffset: 1 },
]

const pad2 = (n: number) => String(n).padStart(2, '0')
const isoDate = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`

// Rolling window of upcoming seasons computed from the current date, so the
// list never silently runs out of future options (it used to be hardcoded
// literals that expired in ~9 months). Includes the season we're currently in.
function buildRollingSeasons(count: number, now: Date): {
  labels: string[]
  ranges: Record<string, { start: string; end: string }>
} {
  const labels: string[] = []
  const ranges: Record<string, { start: string; end: string }> = {}
  for (let year = now.getFullYear(); labels.length < count; year++) {
    for (const def of SEASON_DEFS) {
      if (labels.length >= count) break
      const endYear = year + def.endYearOffset
      const end = new Date(endYear, def.endMonth - 1, def.endDay, 23, 59, 59)
      if (end.getTime() < now.getTime()) continue // season already fully over
      const label = `${def.name} ${year}`
      labels.push(label)
      ranges[label] = {
        start: isoDate(year, def.startMonth, def.startDay),
        end: isoDate(endYear, def.endMonth, def.endDay),
      }
    }
  }
  return { labels, ranges }
}

const rolling = buildRollingSeasons(5, new Date())

export const SEASONS: string[] = rolling.labels

// Maps each season label to a concrete date window so trip date ranges can be
// tested for overlap when filtering.
export const SEASON_RANGES: Record<string, { start: string; end: string }> = rolling.ranges
