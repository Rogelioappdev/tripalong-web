export type UserProfile = {
  id: string
  email: string
  name: string
  age: number | null
  bio: string | null
  profile_photo: string | null
  photos: string[]
  country: string | null
  city: string | null
  gender: 'male' | 'female' | 'other' | null
  travel_styles: string[]
  travel_pace: 'slow' | 'balanced' | 'fast' | null
  travel_with: 'male' | 'female' | 'everyone' | null
  social_energy: 'introvert' | 'extrovert' | 'ambivert' | null
  planning_style: 'planner' | 'spontaneous' | 'flexible' | null
  experience_level: 'beginner' | 'intermediate' | 'experienced' | 'expert' | null
  places_visited: string[]
  bucket_list: string[]
  languages: string[]
  instagram_handle: string | null
  subscription_tier: 'free' | 'plus' | 'pro'
  subscription_status: string | null
  stripe_customer_id: string | null
  subscription_expires_at: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export type Trip = {
  id: string
  creator_id: string
  title: string
  description: string | null
  destination: string
  country: string
  cover_image: string | null
  images: string[]
  start_date: string | null
  end_date: string | null
  is_flexible_dates: boolean
  vibes: string[]
  pace: 'slow' | 'balanced' | 'fast' | null
  group_preference: 'male' | 'female' | 'everyone' | 'mixed' | null
  max_group_size: number
  budget_level: string | null
  age_min: number | null
  age_max: number | null
  status: 'planning' | 'confirmed' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export type TripMemberWithUser = {
  id: string
  trip_id: string
  user_id: string
  status: 'in' | 'maybe' | 'out'
  created_at: string
  user: Pick<UserProfile, 'id' | 'name' | 'profile_photo' | 'gender'>
}

export type TripWithDetails = Trip & {
  creator: Pick<UserProfile, 'id' | 'name' | 'profile_photo'>
  members: TripMemberWithUser[]
  member_count: number
  save_count: number
}

export type TripMember = {
  id: string
  trip_id: string
  user_id: string
  status: 'in' | 'maybe' | 'out'
  created_at: string
  user?: UserProfile
}

export type TripChat = {
  id: string
  trip_id: string
  name: string
  created_at: string
}

export type DirectConversation = {
  id: string
  participant1_id: string
  participant2_id: string
  created_at: string
  other_user?: Pick<UserProfile, 'id' | 'name' | 'profile_photo'>
  last_message?: string
  last_message_at?: string
}

export type DMMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  type: 'text' | 'image'
  reply_to_id: string | null
  created_at: string
  sender?: Pick<UserProfile, 'id' | 'name' | 'profile_photo'>
  reply_to?: { id: string; content: string; sender?: { name: string } } | null
  reactions?: MessageReaction[]
}

export type MessageReaction = {
  id: string
  user_id: string
  emoji: string
}

export type TripMessage = {
  id: string
  trip_chat_id: string
  sender_id: string
  content: string
  type: 'text' | 'image' | 'system'
  reply_to_id: string | null
  is_edited: boolean
  created_at: string
  sender?: Pick<UserProfile, 'id' | 'name' | 'profile_photo'>
  reply_to?: { id: string; content: string; sender?: { name: string } } | null
  reactions?: MessageReaction[]
}

export type ChatMemberReadPosition = {
  user_id: string
  last_read_at: string | null
  user: Pick<UserProfile, 'name' | 'profile_photo'>
}
