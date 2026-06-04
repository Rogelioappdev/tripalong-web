import type { UserProfile } from './types'
import type { TripWithDetails } from './types'

const TRAVEL_STYLE_MAPPING: Record<string, string[]> = {
  'Backpacker': ['Adventure', 'Budget', 'Nature'],
  'Spontaneous': ['Adventure', 'Party', 'Road Trip'],
  'Budget': ['Backpacker', 'Budget'],
  'Planner': ['Culture', 'Spiritual'],
  'Mid-range': ['Culture', 'Food', 'Beach'],
  'Cultural': ['Culture', 'Spiritual', 'Food'],
  'Luxury': ['Food', 'Beach', 'Chill'],
  'Foodie': ['Food', 'Culture'],
  'Adventure': ['Adventure', 'Nature', 'Road Trip'],
  'Flexible': ['Chill', 'Adventure', 'Beach'],
  'Social': ['Party', 'Beach'],
  'Night owl': ['Party', 'Culture'],
  'Adventurous': ['Adventure', 'Nature', 'Road Trip'],
  'Chill': ['Chill', 'Beach', 'Nature'],
  'Early riser': ['Nature', 'Adventure'],
  'Photographer': ['Nature', 'Culture'],
  'Wellness': ['Spiritual', 'Chill', 'Nature'],
  'Creative': ['Culture', 'Party'],
  'Energetic': ['Adventure', 'Party', 'Road Trip'],
  'Sports': ['Adventure', 'Beach'],
  'Music lover': ['Party', 'Culture'],
}

const EXPERIENCE_LEVELS: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  experienced: 3,
  expert: 4,
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

export function getMatchingVibes(userProfile: UserProfile | null, trip: TripWithDetails): string[] {
  if (!userProfile) return []
  const userStyles = [
    ...(userProfile.travel_styles ?? []),
    ...(userProfile.travel_pace ? [userProfile.travel_pace] : []),
    ...(userProfile.planning_style ? [userProfile.planning_style] : []),
  ]
  const userVibes = new Set<string>()
  userStyles.forEach(s => {
    const mapped = TRAVEL_STYLE_MAPPING[s]
    if (mapped) mapped.forEach(v => userVibes.add(v.toLowerCase()))
    userVibes.add(s.toLowerCase())
  })
  const tripVibes = (trip.vibes ?? []).map(v => v.toLowerCase())
  return tripVibes
    .filter(v => userVibes.has(v))
    .slice(0, 2)
    .map(v => v.charAt(0).toUpperCase() + v.slice(1))
}

export function calculateTripMatch(
  userProfile: UserProfile | null,
  trip: TripWithDetails,
): number {
  if (!userProfile) return 50

  let total = 0
  let max = 0

  // 1. Gender preference
  if (userProfile.travel_with && userProfile.travel_with !== 'everyone') {
    const members = trip.members ?? []
    const incompatible = members.filter(m => m.user?.gender && m.user.gender !== userProfile.travel_with)
    const ratio = 1 - incompatible.length / Math.max(members.length, 1)
    if (ratio < 0.5) return Math.round(ratio * 30)
    total += ratio * 20
    max += 20
  }

  // 2. Bucket list includes destination (30%)
  const bucketList = userProfile.bucket_list ?? []
  const dest = trip.destination.toLowerCase()
  const country = trip.country.toLowerCase()
  const inBucketList = bucketList.some(p => {
    const pl = p.toLowerCase()
    return pl.includes(dest) || pl.includes(country) || dest.includes(pl) || country.includes(pl)
  })
  if (inBucketList) {
    total += 30
  } else {
    const visited = (userProfile.places_visited ?? []).some(p => {
      const pl = p.toLowerCase()
      return pl.includes(dest) || pl.includes(country)
    })
    if (visited) total += 10
  }
  max += 30

  // 3. Trip vibes match travel styles (35%)
  const userStyles = [
    ...(userProfile.travel_styles ?? []),
    ...(userProfile.travel_pace ? [userProfile.travel_pace] : []),
    ...(userProfile.planning_style ? [userProfile.planning_style] : []),
  ]
  const userVibes = new Set<string>()
  userStyles.forEach(s => {
    const mapped = TRAVEL_STYLE_MAPPING[s]
    if (mapped) mapped.forEach(v => userVibes.add(v.toLowerCase()))
    userVibes.add(s.toLowerCase())
  })
  const tripVibes = (trip.vibes ?? []).map(v => v.toLowerCase())
  const matchingVibes = tripVibes.filter(v => userVibes.has(v))
  total += (matchingVibes.length / Math.max(tripVibes.length, 1)) * 35
  max += 35

  // 4. Experience (20%)
  const adventureVibes = ['adventure', 'road trip', 'nature']
  const relaxedVibes = ['chill', 'beach', 'food']
  const hasAdventure = tripVibes.some(v => adventureVibes.includes(v))
  const hasRelaxed = tripVibes.some(v => relaxedVibes.includes(v))
  const userExp = EXPERIENCE_LEVELS[userProfile.experience_level ?? 'intermediate'] ?? 2
  if (hasAdventure && !hasRelaxed) {
    total += userExp >= 2 ? 20 : 10
  } else {
    total += hasRelaxed ? 20 : 16
  }
  max += 20

  // 5. Group size preference (15%) — simple heuristic
  const groupSize = trip.member_count ?? 0
  total += groupSize <= 6 ? 15 : Math.max(6, 15 - (groupSize - 6) * 1.5)
  max += 15

  const pct = max > 0 ? Math.round((total / max) * 100) : 50
  return Math.min(100, Math.max(0, pct))
}
