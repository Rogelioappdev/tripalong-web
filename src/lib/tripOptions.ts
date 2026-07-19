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

export const SEASONS: string[] = ['Summer 2026', 'Fall 2026', 'Winter 2026', 'Spring 2027']

// Maps each season label to a concrete date window so trip date ranges can be
// tested for overlap when filtering. Northern-hemisphere seasons.
export const SEASON_RANGES: Record<string, { start: string; end: string }> = {
  'Summer 2026': { start: '2026-06-01', end: '2026-08-31' },
  'Fall 2026':   { start: '2026-09-01', end: '2026-11-30' },
  'Winter 2026': { start: '2026-12-01', end: '2027-02-28' },
  'Spring 2027': { start: '2027-03-01', end: '2027-05-31' },
}
