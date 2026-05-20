import { supabase } from './supabase'
import type { TripWithDetails, TripMessage, UserProfile } from './types'

export async function getTrips(): Promise<TripWithDetails[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      creator:users!creator_id(id, name, profile_photo),
      members:trip_members(count)
    `)
    .eq('status', 'planning')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data as TripWithDetails[]) ?? []
}

export async function getTrip(tripId: string): Promise<TripWithDetails | null> {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      creator:users!creator_id(id, name, profile_photo),
      members:trip_members(*, user:users(id, name, profile_photo))
    `)
    .eq('id', tripId)
    .single()

  if (error) throw error
  return data as TripWithDetails
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
