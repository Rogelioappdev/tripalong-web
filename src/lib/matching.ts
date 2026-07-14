import type { UserProfile } from './types'
import type { TripWithDetails } from './types'

// ── Style → vibe translation ──────────────────────────────────────────────────

const TRAVEL_STYLE_MAPPING: Record<string, string[]> = {
  'Backpacker':   ['adventure', 'budget', 'nature'],
  'Spontaneous':  ['adventure', 'party', 'road trip'],
  'Budget':       ['backpacker', 'budget'],
  'Planner':      ['culture', 'spiritual'],
  'Mid-range':    ['culture', 'food', 'beach'],
  'Cultural':     ['culture', 'spiritual', 'food'],
  'Luxury':       ['food', 'beach', 'chill'],
  'Foodie':       ['food', 'culture'],
  'Adventure':    ['adventure', 'nature', 'road trip'],
  'Flexible':     ['chill', 'adventure', 'beach'],
  'Social':       ['party', 'beach'],
  'Night owl':    ['party', 'culture'],
  'Adventurous':  ['adventure', 'nature', 'road trip'],
  'Chill':        ['chill', 'beach', 'nature'],
  'Early riser':  ['nature', 'adventure'],
  'Photographer': ['nature', 'culture'],
  'Wellness':     ['spiritual', 'chill', 'nature'],
  'Creative':     ['culture', 'party'],
  'Energetic':    ['adventure', 'party', 'road trip'],
  'Sports':       ['adventure', 'beach'],
  'Music lover':  ['party', 'culture'],
}

// ── Description keyword → vibe extraction ─────────────────────────────────────

const DESCRIPTION_KEYWORDS: Record<string, string[]> = {
  // Beach / water
  beach: ['beach'], surf: ['beach', 'adventure'], snorkel: ['beach', 'adventure'],
  diving: ['beach', 'adventure'], scuba: ['beach', 'adventure'],
  ocean: ['beach'], sea: ['beach'], island: ['beach'], coast: ['beach'],
  // Adventure / nature
  hike: ['adventure', 'nature'], hiking: ['adventure', 'nature'],
  trek: ['adventure', 'nature'], trekking: ['adventure', 'nature'],
  mountain: ['adventure', 'nature'], camping: ['adventure', 'nature'],
  outdoor: ['adventure', 'nature'], wildlife: ['nature'], jungle: ['nature', 'adventure'],
  waterfall: ['nature', 'adventure'], volcano: ['adventure', 'nature'],
  // Food / culture
  food: ['food'], eat: ['food'], cuisine: ['food'], restaurant: ['food'],
  market: ['food', 'culture'], cooking: ['food'], gastronomy: ['food'],
  'street food': ['food', 'culture'], coffee: ['food', 'chill'],
  culture: ['culture'], museum: ['culture'], temple: ['culture', 'spiritual'],
  history: ['culture'], heritage: ['culture'], art: ['culture'],
  local: ['culture'], architecture: ['culture'], festival: ['culture', 'party'],
  // Party / social
  party: ['party'], nightlife: ['party'], club: ['party'],
  bar: ['party'], music: ['party', 'culture'],
  // Spiritual / wellness
  yoga: ['spiritual', 'chill'], meditation: ['spiritual', 'chill'],
  spiritual: ['spiritual'], retreat: ['spiritual', 'chill'],
  wellness: ['chill', 'spiritual'], spa: ['chill', 'spiritual'],
  // Chill / relaxed
  relax: ['chill'], relaxing: ['chill'], chill: ['chill'],
  slow: ['chill'], peaceful: ['chill'], laid: ['chill'],
  // Road trip
  'road trip': ['road trip'], roadtrip: ['road trip'], drive: ['road trip'],
  // Budget / luxury
  budget: ['budget'], backpack: ['backpacker'], hostel: ['budget'],
  luxury: ['luxury'], resort: ['luxury'], boutique: ['luxury'],
  // Adventure activities
  adventure: ['adventure'], bungee: ['adventure'], zipline: ['adventure'],
  rafting: ['adventure'], skydive: ['adventure'], paraglide: ['adventure'],
}

function extractDescriptionVibes(description: string | null | undefined): string[] {
  if (!description || description.trim().length < 30) return []
  const lower = description.toLowerCase()
  const vibes = new Set<string>()
  Object.entries(DESCRIPTION_KEYWORDS).forEach(([keyword, mapped]) => {
    if (lower.includes(keyword)) mapped.forEach(v => vibes.add(v))
  })
  // Only contribute if description is genuinely specific (≥2 distinct vibes found)
  return vibes.size >= 2 ? Array.from(vibes) : []
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXPERIENCE_LEVELS: Record<string, number> = {
  beginner: 1, intermediate: 2, experienced: 3, expert: 4,
}

function arrayOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0.3
  const setA = new Set(a.map(s => s.toLowerCase()))
  const setB = new Set(b.map(s => s.toLowerCase()))
  let matches = 0
  setA.forEach(item => {
    if (setB.has(item)) matches++
    setB.forEach(item2 => { if (item.includes(item2) || item2.includes(item)) matches += 0.5 })
  })
  return Math.min(1, matches / Math.max(setA.size, setB.size))
}

function normalizeStyles(styles: string[]): string[] {
  const out = new Set<string>()
  styles.forEach(s => {
    out.add(s.toLowerCase())
    const mapped = TRAVEL_STYLE_MAPPING[s]
    if (mapped) mapped.forEach(v => out.add(v.toLowerCase()))
  })
  return Array.from(out)
}

function buildUserVibes(profile: UserProfile): Set<string> {
  const styles = [
    ...(profile.travel_styles ?? []),
    ...(profile.travel_pace ? [profile.travel_pace] : []),
    ...(profile.planning_style ? [profile.planning_style] : []),
  ]
  const vibes = new Set<string>()
  styles.forEach(s => {
    vibes.add(s.toLowerCase())
    const mapped = TRAVEL_STYLE_MAPPING[s]
    if (mapped) mapped.forEach(v => vibes.add(v.toLowerCase()))
  })
  return vibes
}

// ── Gender hard filter ─────────────────────────────────────────────────────────
// A trip's group_preference restricts WHO can see/join it, based on the
// viewer's own gender — not the existing members' genders (that was the bug:
// this used to score against member.gender ratios and never even looked at
// group_preference, so gender-restricted trips leaked into every feed).
// 'everyone' and 'mixed' (and null, for legacy rows) are unrestricted.
export function isTripGenderEligible(
  trip: Pick<TripWithDetails, 'group_preference'>,
  userProfile: Pick<UserProfile, 'gender'> | null,
): boolean {
  const pref = trip.group_preference
  if (pref !== 'male' && pref !== 'female') return true
  return !!userProfile?.gender && userProfile.gender === pref
}

// ── Core trip score (no bucket list, uses description keywords) ───────────────

function computeTripScore(userProfile: UserProfile, trip: TripWithDetails): number {
  // Gender hard filter — ineligible trips should never surface, but score them
  // at 0 as a safety net in case one somehow reaches this far.
  if (!isTripGenderEligible(trip, userProfile)) return 0

  let total = 0
  let max = 0

  // 1. Vibe alignment — trip tags + description keywords (60%)
  const userVibes = buildUserVibes(userProfile)
  const tagVibes = (trip.vibes ?? []).map(v => v.toLowerCase())
  const descVibes = extractDescriptionVibes(trip.description)

  // Description enriches the matchable set but can't penalise —
  // denominator stays at tag count so extra desc keywords only help
  const enrichedVibes = new Set([...tagVibes, ...descVibes])
  const matchCount = Array.from(enrichedVibes).filter(v => userVibes.has(v)).length
  const baseCount = Math.max(tagVibes.length, 1)
  total += Math.min(1, matchCount / baseCount) * 60
  max += 60

  // 2. Experience level (25%)
  const adventureVibes = ['adventure', 'road trip', 'nature']
  const relaxedVibes = ['chill', 'beach', 'food']
  const hasAdventure = tagVibes.some(v => adventureVibes.includes(v))
  const hasRelaxed = tagVibes.some(v => relaxedVibes.includes(v))
  const userExp = EXPERIENCE_LEVELS[userProfile.experience_level ?? 'intermediate'] ?? 2
  total += hasAdventure && !hasRelaxed ? (userExp >= 2 ? 25 : 12) : hasRelaxed ? 25 : 20
  max += 25

  // 3. Group size (15%)
  const groupSize = trip.member_count ?? 0
  total += groupSize <= 6 ? 15 : Math.max(6, 15 - (groupSize - 6) * 1.5)
  max += 15

  return Math.min(100, Math.max(0, max > 0 ? Math.round((total / max) * 100) : 50))
}

function computeGroupScore(userProfile: UserProfile, trip: TripWithDetails): number | null {
  const scorable = (trip.members ?? []).filter(
    m => (m.user as any)?.travel_styles?.length || (m.user as any)?.travel_pace
  )
  if (!scorable.length) return null
  const scores = scorable.map(m => memberCompatibility(userProfile, m.user as MemberProfile))
  return Math.min(100, Math.max(0, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)))
}

// ── Public API ────────────────────────────────────────────────────────────────

export type MemberProfile = Pick<UserProfile, 'travel_styles' | 'travel_pace' | 'social_energy' | 'planning_style' | 'experience_level'>

export function memberCompatibility(user: UserProfile, member: MemberProfile): number {
  let score = 0
  let max = 0

  const userNorm = normalizeStyles(user.travel_styles ?? [])
  const memberNorm = normalizeStyles(member.travel_styles ?? [])
  if (userNorm.length && memberNorm.length) {
    score += arrayOverlap(userNorm, memberNorm) * 50; max += 50
  }
  if (user.travel_pace && member.travel_pace) {
    score += user.travel_pace === member.travel_pace ? 25 : 8; max += 25
  }
  if (user.social_energy && member.social_energy) {
    score += user.social_energy === member.social_energy ? 15 : 6; max += 15
  }
  if (user.planning_style && member.planning_style) {
    score += user.planning_style === member.planning_style ? 10 : 5; max += 10
  }

  return max > 0 ? Math.round((score / max) * 100) : 50
}

/** Feed card score — group score when members have data, trip score otherwise. */
export function calculateTripMatch(userProfile: UserProfile | null, trip: TripWithDetails): number {
  if (!userProfile) return 50
  if (!isTripGenderEligible(trip, userProfile)) return 0
  return computeGroupScore(userProfile, trip) ?? computeTripScore(userProfile, trip)
}

/** Full breakdown for the detail modal. */
export function getTripMatchBreakdown(
  userProfile: UserProfile | null,
  trip: TripWithDetails,
): { tripPct: number; groupPct: number | null } {
  if (!userProfile) return { tripPct: 50, groupPct: null }
  if (!isTripGenderEligible(trip, userProfile)) return { tripPct: 0, groupPct: null }
  return {
    tripPct: computeTripScore(userProfile, trip),
    groupPct: computeGroupScore(userProfile, trip),
  }
}

/** Matching vibes shown as pills — enriched with description keywords. */
export function getMatchingVibes(userProfile: UserProfile | null, trip: TripWithDetails): string[] {
  if (!userProfile) return []
  const userVibes = buildUserVibes(userProfile)
  const tagVibes = (trip.vibes ?? []).map(v => v.toLowerCase())
  const descVibes = extractDescriptionVibes(trip.description)
  const allVibes = [...new Set([...tagVibes, ...descVibes])]
  return allVibes
    .filter(v => userVibes.has(v))
    .slice(0, 3)
    .map(v => v.charAt(0).toUpperCase() + v.slice(1))
}
