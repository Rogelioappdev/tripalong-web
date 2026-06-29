import type { TripWithDetails, HangalongWithDetails, UserProfile } from './types'

// Maps hangalong activity types to travel_styles keywords
const ACTIVITY_STYLE_MAP: Record<string, string[]> = {
  hike:      ['hiking', 'adventure', 'nature', 'backpacker', 'camping', 'wildlife'],
  beach:     ['beach', 'surfing', 'diving', 'chill', 'wellness'],
  road_trip: ['roadtrip', 'adventure', 'photography'],
  climbing:  ['adventure', 'hiking', 'sports'],
  urban:     ['culture', 'food', 'photography', 'art', 'shopping', 'nightlife'],
  day_trip:  ['adventure', 'culture', 'nature', 'photography'],
  other:     [],
}

const WHEN_URGENCY: Record<string, number> = {
  today:        10,
  tonight:      10,
  this_weekend: 6,
  this_week:    3,
}

function recencyScore(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours < 6)   return 10
  if (ageHours < 24)  return 8
  if (ageHours < 72)  return 5
  if (ageHours < 168) return 2
  return 0
}

function styleOverlap(userStyles: string[], keywords: string[]): number {
  if (!userStyles.length || !keywords.length) return 0
  const lower = userStyles.map(s => s.toLowerCase())
  const matches = keywords.filter(k => lower.some(s => s.includes(k) || k.includes(s)))
  return Math.min(matches.length * 3, 10)
}

export function scoreHangalong(hang: HangalongWithDetails, profile: UserProfile | null): number {
  const urgency  = (WHEN_URGENCY[hang.when_label] ?? 0) * 0.30
  const recency  = recencyScore(hang.created_at) * 0.25
  const activity = styleOverlap(profile?.travel_styles ?? [], ACTIVITY_STYLE_MAP[hang.activity_type] ?? []) * 0.25
  const spots    = (hang.max_people - hang.member_count > 0 ? 5 : 0) * 0.20
  return urgency + recency + activity + spots
}

export function scoreTrip(trip: TripWithDetails, profile: UserProfile | null): number {
  const userStyles = profile?.travel_styles ?? []
  const tripVibes: string[] = (trip as any).vibes ?? []

  // Vibe overlap
  const vibeMatch = styleOverlap(userStyles, tripVibes) * 0.30

  // Age compatibility
  let ageScore = 0
  if (profile?.age) {
    const min: number = (trip as any).age_min ?? 18
    const max: number = (trip as any).age_max ?? 99
    ageScore = (profile.age >= min && profile.age <= max) ? 10 : 0
  }

  // Country match
  const countryMatch = (profile?.country && (trip as any).country &&
    profile.country.toLowerCase() === (trip as any).country.toLowerCase()) ? 10 : 0

  // Spot availability
  const spotsLeft = (trip.max_group_size ?? 99) - (trip.member_count ?? 0)
  const spotsScore = spotsLeft > 0 ? 5 : 0

  // Start date — deprioritize past trips
  const startDate: string | null = (trip as any).start_date
  let dateScore = 5
  if (startDate) {
    const daysUntil = (new Date(startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysUntil < -7)  dateScore = 0   // more than a week in the past
    else if (daysUntil < 0) dateScore = 2 // started but recent
    else if (daysUntil < 30) dateScore = 8 // coming up soon
    else dateScore = 5
  }

  return (
    vibeMatch +
    ageScore      * 0.25 +
    countryMatch  * 0.15 +
    recencyScore(trip.created_at) * 0.20 +
    spotsScore    * 0.10 +
    dateScore     * 0.10
  )
}

export function sortHangalongs(hangs: HangalongWithDetails[], profile: UserProfile | null): HangalongWithDetails[] {
  return [...hangs].sort((a, b) => scoreHangalong(b, profile) - scoreHangalong(a, profile))
}

export function sortTrips(trips: TripWithDetails[], profile: UserProfile | null): TripWithDetails[] {
  return [...trips].sort((a, b) => scoreTrip(b, profile) - scoreTrip(a, profile))
}
