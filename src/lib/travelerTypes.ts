// Single source of truth for the "traveler type" identity labels — shown
// during onboarding (pick up to 2) and on the public profile. Modeled on a
// competitor's own "what type of traveler are you?" screen, adapted from
// their generic categories to TripAlong's trip-based framing (see
// tripalong_nomadtable_screens.md, screen 9) — trip length/style rather than
// abstract traveler categories, since that's what actually differentiates who
// someone would want as a trip companion here.

export type TravelerType = { value: string; label: string; emoji: string; desc: string }

export const TRAVELER_TYPES: TravelerType[] = [
  { value: 'weekend', label: 'Weekend Tripper', emoji: '🎒', desc: 'Quick trips whenever I can get away' },
  { value: 'long_term', label: 'Long-Term Traveler', emoji: '🌍', desc: 'Weeks or months on the road' },
  { value: 'digital_nomad', label: 'Digital Nomad', emoji: '💻', desc: 'Working remotely while I travel' },
  { value: 'backpacker', label: 'Backpacker', emoji: '🥾', desc: 'Budget-conscious, go where the wind takes me' },
  { value: 'luxury', label: 'Luxury Traveler', emoji: '✨', desc: 'I like my trips comfortable' },
  { value: 'first_timer', label: 'First-Timer', emoji: '🌱', desc: 'New to solo travel, excited to start' },
]

export const MAX_TRAVELER_TYPES = 2
