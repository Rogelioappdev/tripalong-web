import { supabase } from './supabase'
import type { TripWithDetails, TripMessage, UserProfile } from './types'

export async function getTrips(): Promise<TripWithDetails[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // Exclude trips from blocked users
  let blockedIds: string[] = []
  if (userId) {
    const { data: blocks } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)
    blockedIds = (blocks ?? []).map((b: any) => b.blocked_id as string)
  }

  let query = supabase
    .from('trips')
    .select(`
      *,
      creator:users!creator_id(id, name, profile_photo),
      members:trip_members(
        id, trip_id, user_id, status, created_at,
        user:users(id, name, profile_photo, gender)
      ),
      saves:saved_trips(count)
    `)
    .eq('status', 'planning')
    .order('created_at', { ascending: false })
    .limit(50)

  if (blockedIds.length > 0) {
    query = query.not('creator_id', 'in', `(${blockedIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((trip: any) => ({
    ...trip,
    member_count: trip.members?.length ?? 0,
    save_count: (trip.saves?.[0]?.count ?? 0) as number,
  })) as TripWithDetails[]
}

export async function getTrip(tripId: string): Promise<TripWithDetails | null> {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      creator:users!creator_id(id, name, profile_photo),
      members:trip_members(
        id, trip_id, user_id, status, created_at,
        user:users(id, name, profile_photo, gender)
      ),
      saves:saved_trips(count)
    `)
    .eq('id', tripId)
    .single()

  if (error) throw error
  return {
    ...data,
    member_count: (data as any).members?.length ?? 0,
    save_count: ((data as any).saves?.[0]?.count ?? 0) as number,
  } as TripWithDetails
}

export async function joinTrip(tripId: string, userId: string) {
  // 1. Upsert trip member
  const { error: memberError } = await supabase
    .from('trip_members')
    .upsert({ trip_id: tripId, user_id: userId, status: 'in' }, { onConflict: 'trip_id,user_id' })
  if (memberError) throw memberError

  // 2. Add to trip chat
  const { error: chatError } = await supabase.rpc('ensure_trip_chat_member', { p_trip_id: tripId })
  if (chatError) throw chatError

  // 3. Auto-save the trip
  await supabase
    .from('saved_trips')
    .upsert({ trip_id: tripId, user_id: userId }, { onConflict: 'trip_id,user_id' })
}

export async function getTripMembership(tripId: string, userId: string) {
  const { data } = await supabase
    .from('trip_members')
    .select('status')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()
  return data
}

export async function getTripChat(tripId: string) {
  const { data, error } = await supabase
    .from('trip_chats')
    .select('*')
    .eq('trip_id', tripId)
    .single()
  if (error) throw error
  return data
}

export async function getChatMessages(chatId: string): Promise<TripMessage[]> {
  const { data, error } = await supabase
    .from('trip_messages')
    .select('*, sender:users(id, name, profile_photo)')
    .eq('trip_chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return (data as TripMessage[]) ?? []
}

export async function sendMessage(chatId: string, senderId: string, content: string) {
  const { error } = await supabase
    .from('trip_messages')
    .insert({ trip_chat_id: chatId, sender_id: senderId, content, type: 'text' })
  if (error) throw error
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as UserProfile
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>) {
  const { error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

export async function createTrip(data: {
  creator_id: string
  destination: string
  country: string
  title: string
  description: string | null
  cover_image: string | null
  images: string[]
  vibes: string[]
  pace: 'slow' | 'balanced' | 'fast'
  budget_level: string | null
  group_preference: 'everyone' | 'male' | 'female'
  max_group_size: number
  is_flexible_dates: boolean
  start_date: string | null
  end_date: string | null
  status: 'planning'
}) {
  const { error } = await supabase.from('trips').insert(data)
  if (error) throw error
}

export async function getUserTripChats(userId: string) {
  const { data, error } = await supabase
    .from('trip_chat_members')
    .select(`
      trip_chat_id,
      trip_chat:trip_chats(
        id,
        trip:trips(id, destination, country, cover_image)
      )
    `)
    .eq('user_id', userId)

  if (error) throw error
  return data ?? []
}

export async function getLastTripMessage(chatId: string) {
  const { data } = await supabase
    .from('trip_messages')
    .select('content, created_at')
    .eq('trip_chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function getDMConversations(userId: string) {
  const { data, error } = await supabase
    .from('direct_conversations')
    .select(`
      id, created_at,
      participant1:users!participant1_id(id, name, profile_photo),
      participant2:users!participant2_id(id, name, profile_photo)
    `)
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map((conv: any) => ({
    ...conv,
    other_user: conv.participant1?.id === userId ? conv.participant2 : conv.participant1,
  }))
}

export async function getDMMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:users(id, name, profile_photo)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error
  return data ?? []
}

export async function sendDMMessage(conversationId: string, senderId: string, content: string) {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
  if (error) throw error
}

export async function saveTrip(tripId: string, userId: string) {
  const { error } = await supabase
    .from('saved_trips')
    .upsert({ trip_id: tripId, user_id: userId }, { onConflict: 'trip_id,user_id' })
  if (error) throw error
}

export async function getUserSavedTripIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('saved_trips')
    .select('trip_id')
    .eq('user_id', userId)
  return (data ?? []).map((d: any) => d.trip_id)
}

export async function getUserJoinedTripIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', userId)
  return (data ?? []).map((d: any) => d.trip_id)
}

export async function createProfile(userId: string, email: string, name: string, age: number) {
  const { error } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email,
      name,
      age,
      photos: [],
      travel_styles: [],
      places_visited: [],
      bucket_list: [],
      languages: [],
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}
