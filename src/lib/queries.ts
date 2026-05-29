import { supabase } from './supabase'
import type { TripWithDetails, TripMessage, UserProfile, ChatMemberReadPosition } from './types'

export async function getTrips(): Promise<TripWithDetails[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // Fetch main trips with members (no saves — saved_trips may not exist)
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      creator:users!creator_id(id, name, profile_photo),
      members:trip_members(
        user_id,
        user:users(id, name, profile_photo)
      )
    `)
    .eq('status', 'planning')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('getTrips error:', error)
    throw error
  }

  // Fetch save counts + blocked IDs in parallel, silently skip failures
  let saveCounts: Record<string, number> = {}
  let blockedIds: string[] = []
  await Promise.all([
    (async () => {
      try {
        const { data: saves } = await supabase.from('saved_trips').select('trip_id')
        if (saves) saves.forEach((s: any) => { saveCounts[s.trip_id] = (saveCounts[s.trip_id] ?? 0) + 1 })
      } catch {}
    })(),
    (async () => {
      if (userId) blockedIds = await getBlockedUserIds()
    })(),
  ])

  const blockedSet = new Set(blockedIds)
  return (data ?? [])
    .filter((trip: any) => !blockedSet.has(trip.creator_id))
    .map((trip: any) => ({
      ...trip,
      member_count: trip.members?.length ?? 0,
      save_count: saveCounts[trip.id] ?? 0,
    })) as TripWithDetails[]
}

export async function getTrip(tripId: string): Promise<TripWithDetails | null> {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      creator:users!creator_id(id, name, profile_photo),
      members:trip_members(
        user_id,
        user:users(id, name, profile_photo)
      )
    `)
    .eq('id', tripId)
    .single()

  if (error) throw error
  return {
    ...(data as any),
    member_count: (data as any).members?.length ?? 0,
    save_count: 0,
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

// Adds the current user to a trip's group chat without needing to be a trip member.
// Uses a SECURITY DEFINER RPC to bypass the trip_chats RLS (which only allows
// members to read the chat ID) — mirrors how the iOS app handles this.
export async function joinTripChat(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_trip_chat_as_guest', { p_trip_id: tripId })
  if (error) throw error
  if (!data.success) throw new Error(data.error)
  return data.chat_id as string
}

const MSG_SELECT = `
  *,
  sender:users(id, name, profile_photo),
  reply_to:trip_messages!reply_to_id(id, content, sender:users(name)),
  reactions:message_reactions(id, user_id, emoji)
`

export async function getChatMessages(chatId: string, limit = 50): Promise<TripMessage[]> {
  const { data, error } = await supabase
    .from('trip_messages')
    .select(MSG_SELECT)
    .eq('trip_chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as TripMessage[]).reverse()
}

export async function getOlderChatMessages(chatId: string, before: string, limit = 30): Promise<TripMessage[]> {
  const { data, error } = await supabase
    .from('trip_messages')
    .select(MSG_SELECT)
    .eq('trip_chat_id', chatId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as TripMessage[]).reverse()
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  content: string,
  replyToId?: string | null,
  type: 'text' | 'image' = 'text',
) {
  const payload: Record<string, unknown> = { trip_chat_id: chatId, sender_id: senderId, content, type }
  if (replyToId) payload.reply_to_id = replyToId
  const { error } = await supabase.from('trip_messages').insert(payload)
  if (error) throw error
}

const CHAT_IMAGES_BASE = 'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/chat-images'

export async function uploadChatImage(chatId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${chatId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false })
  if (error) throw error
  return `${CHAT_IMAGES_BASE}/${path}`
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('trip_messages').delete().eq('id', messageId)
  if (error) throw error
}

export async function toggleReaction(messageId: string, emoji: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  // upsert: if row exists the unique constraint fires, so we check first
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', uid)
    .eq('emoji', emoji)
    .maybeSingle()
  if (existing) {
    await supabase.from('message_reactions').delete().eq('id', existing.id)
  } else {
    await supabase.from('message_reactions').insert({ message_id: messageId, user_id: uid, emoji })
  }
}

export async function getChatMemberReadPositions(chatId: string): Promise<ChatMemberReadPosition[]> {
  const { data, error } = await supabase
    .from('trip_chat_members')
    .select('user_id, last_read_at, user:users(name, profile_photo)')
    .eq('trip_chat_id', chatId)
  if (error) return []
  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    last_read_at: row.last_read_at,
    user: row.user,
  })) as ChatMemberReadPosition[]
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
  age_min: number | null
  age_max: number | null
  status: 'planning'
}) {
  const { error } = await supabase.from('trips').insert(data)
  if (error) throw error
}

export async function getUserTripChats(_userId: string) {
  const { data, error } = await supabase.rpc('get_my_trip_chats')
  if (error) return []
  return (data ?? []).map((row: any) => ({
    trip_chat_id: row.trip_chat_id,
    trip_chat: {
      id: row.trip_chat_id,
      trip: {
        id: row.trip_id,
        destination: row.destination,
        country: row.country,
        cover_image: row.cover_image,
      },
    },
    last_message: row.last_message ?? null,
    last_message_at: row.last_message_at ?? null,
    unread_count: Number(row.unread_count ?? 0),
    is_muted: row.is_muted ?? false,
  }))
}

export async function getTripChatMuted(chatId: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return false
  const { data } = await supabase
    .from('trip_chat_members')
    .select('is_muted')
    .eq('trip_chat_id', chatId)
    .eq('user_id', uid)
    .single()
  return (data as any)?.is_muted ?? false
}

export async function setTripChatMuted(chatId: string, muted: boolean) {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase
    .from('trip_chat_members')
    .update({ is_muted: muted })
    .eq('trip_chat_id', chatId)
    .eq('user_id', uid)
}

export async function markTripChatRead(chatId: string) {
  await supabase
    .from('trip_chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('trip_chat_id', chatId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
}

export async function markDMRead(conversationId: string) {
  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
}

export async function getUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_total_unread_count')
  if (error) return 0
  return Number(data ?? 0)
}

export async function getDMConversations(_userId: string) {
  const [dmsResult, blockedIds] = await Promise.all([
    supabase.rpc('get_my_dms'),
    getBlockedUserIds(),
  ])
  if (dmsResult.error) return []
  const blockedSet = new Set(blockedIds)
  return (dmsResult.data ?? [])
    .filter((row: any) => !blockedSet.has(row.other_user_id))
    .map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_message: row.last_message ?? null,
      last_message_at: row.last_message_at ?? null,
      unread_count: Number(row.unread_count ?? 0),
      other_user: {
        id: row.other_user_id,
        name: row.other_user_name,
        profile_photo: row.other_user_photo,
      },
    }))
}

export async function getOrCreateDM(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { other_user_id: otherUserId })
  if (error) throw error
  return data as string
}

const DM_MSG_SELECT = `
  *,
  sender:users(id, name, profile_photo),
  reactions:message_reactions(id, user_id, emoji),
  reply_to:messages!reply_to_id(id, content, sender:users(name))
`

export async function getDMMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(DM_MSG_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return ((data ?? []) as any[]).reverse()
}

export async function getOlderDMMessages(conversationId: string, before: string, limit = 30) {
  const { data, error } = await supabase
    .from('messages')
    .select(DM_MSG_SELECT)
    .eq('conversation_id', conversationId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as any[]).reverse()
}

export async function sendDMMessage(
  conversationId: string,
  senderId: string,
  content: string,
  replyToId?: string | null,
  type: 'text' | 'image' = 'text',
) {
  const payload: Record<string, unknown> = { conversation_id: conversationId, sender_id: senderId, content, type }
  if (replyToId) payload.reply_to_id = replyToId
  const { error } = await supabase.from('messages').insert(payload)
  if (error) throw error
}

export async function deleteDMMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  if (error) throw error
}

export async function uploadDMImage(conversationId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `dm/${conversationId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false })
  if (error) throw error
  return `${CHAT_IMAGES_BASE}/${path}`
}

export async function searchDMMessages(conversationId: string, query: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(DM_MSG_SELECT)
    .eq('conversation_id', conversationId)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) return []
  return (data ?? []) as any[]
}

export async function getDMOtherLastRead(conversationId: string, myUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('conversation_members')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .neq('user_id', myUserId)
    .single()
  return (data as any)?.last_read_at ?? null
}

// ── Block / Report ────────────────────────────────────────────────────────

export async function blockUser(blockedId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('blocked_users').upsert({ blocker_id: uid, blocked_id: blockedId })
}

export async function unblockUser(blockedId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('blocked_users').delete().eq('blocker_id', uid).eq('blocked_id', blockedId)
}

export async function isUserBlocked(blockedId: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return false
  const { data } = await supabase
    .from('blocked_users').select('id').eq('blocker_id', uid).eq('blocked_id', blockedId).maybeSingle()
  return !!data
}

export async function getBlockedUserIds(): Promise<string[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return []
  const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid)
  return (data ?? []).map((r: any) => r.blocked_id)
}

export async function reportUser(reportedId: string, reason: string, details?: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('user_reports').insert({ reporter_id: uid, reported_id: reportedId, reason, details: details ?? null })
  // Fire-and-forget — email admin, don't block on delivery
  supabase.functions.invoke('report-notify', {
    body: { reporter_id: uid, reported_id: reportedId, reason, details: details ?? null },
  }).catch(() => {})
}

export async function getSavedTrips(userId: string): Promise<TripWithDetails[]> {
  const { data, error } = await supabase
    .from('saved_trips')
    .select(`
      trip:trips(
        *,
        creator:users!creator_id(id, name, profile_photo),
        members:trip_members(user_id, status, user:users(id, name, profile_photo))
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? [])
    .map((row: any) => row.trip)
    .filter(Boolean)
    .map((trip: any) => ({ ...trip, member_count: trip.members?.length ?? 0, save_count: 0 })) as TripWithDetails[]
}

export async function getMyTrips(userId: string): Promise<TripWithDetails[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select(`
      status,
      trip:trips(
        *,
        creator:users!creator_id(id, name, profile_photo),
        members:trip_members(user_id, status, user:users(id, name, profile_photo))
      )
    `)
    .eq('user_id', userId)
  if (error) throw error
  const seen = new Set<string>()
  const trips: TripWithDetails[] = []
  for (const row of data ?? []) {
    const trip = (row as any).trip
    if (!trip || seen.has(trip.id)) continue
    seen.add(trip.id)
    trips.push({ ...trip, member_count: trip.members?.length ?? 0, save_count: 0 } as TripWithDetails)
  }
  return trips
}

export async function unsaveTrip(tripId: string, userId: string) {
  const { error } = await supabase
    .from('saved_trips')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function leaveTrip(tripId: string, userId: string) {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getChatImages(chatId: string): Promise<{ id: string; content: string }[]> {
  const { data, error } = await supabase
    .from('trip_messages')
    .select('id, content')
    .eq('trip_chat_id', chatId)
    .eq('type', 'image')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) return []
  return (data ?? []) as { id: string; content: string }[]
}

export async function searchChatMessages(chatId: string, query: string): Promise<TripMessage[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('trip_messages')
    .select(MSG_SELECT)
    .eq('trip_chat_id', chatId)
    .eq('type', 'text')
    .ilike('content', `%${query.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return []
  return ((data ?? []) as TripMessage[]).reverse()
}

export async function getTripInfoByChatId(chatId: string): Promise<TripWithDetails | null> {
  try {
    const { data, error } = await supabase
      .from('trip_chats')
      .select('trip_id')
      .eq('id', chatId)
      .single()
    if (error || !data) {
      console.error('[getTripInfoByChatId] trip_chats lookup failed:', error?.message)
      return null
    }
    return await getTrip((data as any).trip_id)
  } catch (e: any) {
    console.error('[getTripInfoByChatId] error:', e?.message ?? e)
    return null
  }
}

export async function leaveTripFromChat(tripId: string, chatId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', uid)
  await supabase.from('trip_chat_members').delete().eq('trip_chat_id', chatId).eq('user_id', uid)
}

export async function updateTripMemberStatus(tripId: string, userId: string, status: 'in' | 'maybe') {
  const { error } = await supabase
    .from('trip_members')
    .update({ status })
    .eq('trip_id', tripId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function saveTrip(tripId: string, userId: string) {
  const { error } = await supabase
    .from('saved_trips')
    .upsert({ trip_id: tripId, user_id: userId }, { onConflict: 'trip_id,user_id' })
  if (error) throw error
}

export async function getUserSavedTripIds(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('saved_trips')
      .select('trip_id')
      .eq('user_id', userId)
    return (data ?? []).map((d: any) => d.trip_id)
  } catch { return [] }
}

const TRIP_IMAGE_CATEGORIES = ['europe', 'asia', 'africa', 'beach', 'city', 'desert', 'latin-america', 'mountain', 'nature', 'winter']
const STORAGE_BASE = 'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/trip-images'

export async function getDestinationPhotos(destination: string): Promise<string[]> {
  if (!destination.trim()) return []
  const normalized = destination.toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  if (!normalized) return []

  const results = await Promise.allSettled(
    TRIP_IMAGE_CATEGORIES.map(async (cat) => {
      const { data } = await supabase.storage
        .from('trip-images')
        .list(`${cat}/${normalized}`, { limit: 10, sortBy: { column: 'name', order: 'asc' } })
      if (!data?.length) return []
      return data
        .filter(f => f.id) // f.id is null for sub-folders, present for actual files
        .slice(0, 8)
        .map(f => `${STORAGE_BASE}/${cat}/${normalized}/${f.name}`)
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

export async function getUserJoinedTripIds(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId)
    return (data ?? []).map((d: any) => d.trip_id)
  } catch { return [] }
}

export async function recordProfileView(viewedUserId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid || uid === viewedUserId) return
  await supabase.from('profile_views').upsert(
    { viewer_id: uid, viewed_user_id: viewedUserId, viewed_at: new Date().toISOString() },
    { onConflict: 'viewer_id,viewed_user_id' }
  )
}

export async function getProfileViewers(limit = 50): Promise<{ id: string; name: string; profile_photo: string | null; viewed_at: string }[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('profile_views')
    .select('viewer_id, viewed_at, viewer:users!viewer_id(id, name, profile_photo)')
    .eq('viewed_user_id', uid)
    .order('viewed_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.viewer_id,
    name: row.viewer?.name ?? 'Unknown',
    profile_photo: row.viewer?.profile_photo ?? null,
    viewed_at: row.viewed_at,
  }))
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
