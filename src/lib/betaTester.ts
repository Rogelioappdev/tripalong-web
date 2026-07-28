import type { UserProfile } from './types'

// Gate for in-progress features, opted into via the hidden member code in
// Settings -> About. Check this wherever a not-yet-released feature should
// only be visible to whoever has it turned on, e.g.:
//   if (isBetaTester(profile)) { ...new feature... }
export function isBetaTester(profile: UserProfile | null | undefined): boolean {
  return !!profile?.is_beta_tester
}
