import type { UserProfile } from './types'

// Single source of truth for what counts as a "complete" profile — used by
// onboarding, the travel-dna editor, the profile page, and the app-wide gate.
// Keep every consumer importing from here rather than re-deriving this list,
// so "complete" never drifts between surfaces.
export const MIN_PROFILE_PHOTOS = 3

export type ProfileCompletenessField =
  | 'name' | 'age' | 'gender' | 'photos' | 'travel_styles'
  | 'travel_pace' | 'social_energy' | 'planning_style' | 'experience_level' | 'travel_with'

export const PROFILE_FIELD_LABELS: Record<ProfileCompletenessField, string> = {
  name: 'Name',
  age: 'Age',
  gender: 'Gender',
  photos: `At least ${MIN_PROFILE_PHOTOS} photos`,
  travel_styles: 'Travel style',
  travel_pace: 'Daily pace',
  social_energy: 'Social energy',
  planning_style: 'Planning style',
  experience_level: 'Travel experience',
  travel_with: 'Travel group preference',
}

type CompletenessInput = Pick<UserProfile,
  | 'name' | 'age' | 'gender' | 'photos' | 'travel_styles'
  | 'travel_pace' | 'social_energy' | 'planning_style' | 'experience_level' | 'travel_with'
> | null | undefined

export function getMissingProfileFields(profile: CompletenessInput): ProfileCompletenessField[] {
  if (!profile) return ['name', 'age', 'gender', 'photos', 'travel_styles', 'travel_pace', 'social_energy', 'planning_style', 'experience_level', 'travel_with']
  const missing: ProfileCompletenessField[] = []
  if (!profile.name?.trim()) missing.push('name')
  if (profile.age == null) missing.push('age')
  if (!profile.gender) missing.push('gender')
  if ((profile.photos?.length ?? 0) < MIN_PROFILE_PHOTOS) missing.push('photos')
  if (!profile.travel_styles || profile.travel_styles.length === 0) missing.push('travel_styles')
  if (!profile.travel_pace) missing.push('travel_pace')
  if (!profile.social_energy) missing.push('social_energy')
  if (!profile.planning_style) missing.push('planning_style')
  if (!profile.experience_level) missing.push('experience_level')
  if (!profile.travel_with) missing.push('travel_with')
  return missing
}

export function isProfileComplete(profile: CompletenessInput): boolean {
  return getMissingProfileFields(profile).length === 0
}
