export type DnaOption = { value: string; emoji: string; label: string; desc?: string }

export type DnaDimension = {
  key: 'travel_styles' | 'travel_pace' | 'social_energy' | 'planning_style' | 'experience_level' | 'travel_with'
  title: string
  subtitle: string
  multi: boolean
  options: DnaOption[]
}

export const DNA_DIMENSIONS: DnaDimension[] = [
  {
    key: 'travel_styles',
    title: 'Your travel style',
    subtitle: 'Pick all that apply',
    multi: true,
    options: [
      { value: 'adventure', emoji: '🏔️', label: 'Adventure' },
      { value: 'luxury', emoji: '✨', label: 'Luxury' },
      { value: 'backpacking', emoji: '🎒', label: 'Backpacking' },
      { value: 'cultural', emoji: '🏛️', label: 'Cultural' },
      { value: 'foodie', emoji: '🍜', label: 'Foodie' },
      { value: 'relaxed', emoji: '🌴', label: 'Relaxed' },
      { value: 'party', emoji: '🎉', label: 'Party' },
      { value: 'budget', emoji: '💸', label: 'Budget' },
    ],
  },
  {
    key: 'travel_pace',
    title: 'Daily pace',
    subtitle: 'How do you like to travel day-to-day?',
    multi: false,
    options: [
      { value: 'slow', emoji: '☕', label: 'Slow & Steady', desc: 'Take it easy, soak it all in' },
      { value: 'balanced', emoji: '⚖️', label: 'Balanced', desc: 'Mix of exploring and relaxing' },
      { value: 'fast', emoji: '⚡', label: 'Go Go Go!', desc: 'See and do as much as possible' },
    ],
  },
  {
    key: 'social_energy',
    title: 'Social energy',
    subtitle: 'How do you recharge while traveling?',
    multi: false,
    options: [
      { value: 'introvert', emoji: '🌙', label: 'Introvert', desc: 'I need alone time to recharge' },
      { value: 'extrovert', emoji: '☀️', label: 'Extrovert', desc: 'I thrive around people' },
      { value: 'ambivert', emoji: '🌗', label: 'Ambivert', desc: 'It depends on my mood' },
    ],
  },
  {
    key: 'planning_style',
    title: 'Planning style',
    subtitle: 'How do you approach trip planning?',
    multi: false,
    options: [
      { value: 'planner', emoji: '📋', label: 'The Planner', desc: 'Itinerary ready weeks in advance' },
      { value: 'spontaneous', emoji: '🎲', label: 'Spontaneous', desc: 'Figure it out as we go' },
      { value: 'flexible', emoji: '🤸', label: 'Flexible', desc: 'Light plan, open to changes' },
    ],
  },
  {
    key: 'experience_level',
    title: 'Travel experience',
    subtitle: 'How much have you traveled?',
    multi: false,
    options: [
      { value: 'beginner', emoji: '🌱', label: 'Beginner', desc: 'Just starting out' },
      { value: 'intermediate', emoji: '🌿', label: 'Intermediate', desc: 'A few trips under my belt' },
      { value: 'experienced', emoji: '✈️', label: 'Experienced', desc: 'Been to many countries' },
      { value: 'expert', emoji: '🌍', label: 'Expert', desc: 'The world is my backyard' },
    ],
  },
  {
    key: 'travel_with',
    title: 'Travel group preference',
    subtitle: 'Who do you prefer to travel with?',
    multi: false,
    options: [
      { value: 'everyone', emoji: '🌍', label: 'Everyone', desc: 'Open to all genders' },
      { value: 'female', emoji: '👩', label: 'Women only', desc: 'Prefer women-only groups' },
      { value: 'male', emoji: '👨', label: 'Men only', desc: 'Prefer men-only groups' },
    ],
  },
]

export type NewDnaData = {
  travel_styles: string[]
  travel_pace: string
  social_energy: string
  planning_style: string
  experience_level: string
  travel_with: string
}

export const EMPTY_DNA: NewDnaData = {
  travel_styles: [],
  travel_pace: '',
  social_energy: '',
  planning_style: '',
  experience_level: '',
  travel_with: '',
}
