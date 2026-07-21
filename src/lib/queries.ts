import { supabase } from './supabase'
import type { TripWithDetails, TripMessage, UserProfile, ChatMemberReadPosition, HangalongWithDetails, ActivityType, WhenLabel } from './types'
import { sortTrips, sortHangalongs } from './feedScoring'
import { displayName } from './displayName'
import { sendPushNotification } from './push'
import { isTripGenderEligible } from './matching'

// Best-effort "X joined" push to existing members — never blocks the join
// flow itself, so a push failure can't break joining a trip/hangout.
async function notifyJoin(chatId: string, joinerId: string, joinerName: string, label: string, url: string) {
  try {
    await sendPushNotification({
      chatId,
      senderId: joinerId,
      senderName: joinerName,
      content: `${joinerName} joined ${label}! 🎉`,
      type: 'join',
      url,
    })
  } catch {}
}

// ─── Seen tracking ───────────────────────────────────────────────────────────

export async function markTripSeen(tripId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('user_seen_trips')
    .upsert({ user_id: uid, trip_id: tripId }, { onConflict: 'user_id,trip_id' })
}

export async function markHangalongSeen(hangalongId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('user_seen_hangalongs')
    .upsert({ user_id: uid, hangalong_id: hangalongId }, { onConflict: 'user_id,hangalong_id' })
}

// ─── Daily swipe limit (server-side, UTC-keyed) ────────────────────────────────
// Enforced in Postgres via SECURITY DEFINER functions keyed off auth.uid(), so
// it can't be reset by changing the device timezone or clearing localStorage.
export async function getSwipesToday(): Promise<number> {
  const { data, error } = await supabase.rpc('get_swipes_today')
  if (error) throw error
  return data ?? 0
}

export async function incrementSwipesToday(): Promise<number> {
  const { data, error } = await supabase.rpc('increment_swipes_today')
  if (error) throw error
  return data ?? 0
}

// ─── Trip feed ────────────────────────────────────────────────────────────────

export async function getTrips(): Promise<TripWithDetails[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // Fetch trips, seen IDs, save counts, blocked IDs, and user profile all in parallel
  const [tripsResult, seenResult, savesResult, blockedIds, profile] = await Promise.all([
    supabase
      .from('trips')
      .select(`
        *,
        creator:users!creator_id(id, name, profile_photo),
        members:trip_members(
          user_id,
          status,
          user:users(id, name, profile_photo, travel_styles, travel_pace, social_energy, planning_style, experience_level)
        )
      `)
      .eq('status', 'planning')
      .order('created_at', { ascending: false })
      .limit(100),

    userId
      ? supabase.from('user_seen_trips').select('trip_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),

    (async () => { try { return await supabase.from('saved_trips').select('trip_id').limit(500) } catch { return { data: [] } } })(),

    userId ? getBlockedUserIds() : Promise.resolve([]),

    userId
      ? supabase.from('users').select('age, country, gender, travel_styles, travel_with').eq('id', userId).maybeSingle().then(r => r.data as UserProfile | null)
      : Promise.resolve(null),
  ])

  if (tripsResult.error) {
    console.error('getTrips error:', tripsResult.error)
    throw tripsResult.error
  }

  const seenSet = new Set<string>((seenResult.data ?? []).map((r: any) => r.trip_id))
  const blockedSet = new Set(blockedIds)
  const saveCounts: Record<string, number> = {}
  ;(savesResult.data ?? []).forEach((s: any) => { saveCounts[s.trip_id] = (saveCounts[s.trip_id] ?? 0) + 1 })

  const joinedMemberCount = (trip: any) => {
    const inCount = (trip.members ?? []).filter((m: any) => m.status === 'in').length
    const creatorCounted = (trip.members ?? []).some((m: any) => m.user_id === trip.creator_id && m.status === 'in')
    return inCount + (creatorCounted ? 0 : 1)
  }

  const trips = (tripsResult.data ?? [])
    .filter((trip: any) => {
      if (blockedSet.has(trip.creator_id)) return false
      if (seenSet.has(trip.id)) return false
      // Exclude trips the user already joined
      if (userId && trip.members?.some((m: any) => m.user_id === userId)) return false
      // Gender-restricted trips must never surface to an ineligible viewer
      if (!isTripGenderEligible(trip, profile)) return false
      // Full trips still surface and stay joinable — max_group_size is a soft
      // target, not a hard cap. feedScoring only ranks them slightly lower.
      return true
    })
    .map((trip: any) => ({
      ...trip,
      member_count: joinedMemberCount(trip),
      save_count: saveCounts[trip.id] ?? 0,
    })) as TripWithDetails[]

  return sortTrips(trips, profile)
}

// Trips for the TripAlong World globe (/world). Unlike the swipe feed this is
// "browse everything": it does NOT hide already-seen or already-joined trips,
// so the whole world of active trips stays visible. It still respects blocking
// and gender eligibility. Full trips DO show (joinable — soft capacity). Only
// trips with coordinates appear.
export async function getTripsForMap(): Promise<TripWithDetails[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  const [tripsResult, savesResult, blockedIds, profile] = await Promise.all([
    supabase
      .from('trips')
      .select(`
        *,
        creator:users!creator_id(id, name, profile_photo),
        members:trip_members(
          user_id,
          status,
          user:users(id, name, profile_photo, travel_styles, travel_pace, social_energy, planning_style, experience_level)
        )
      `)
      .eq('status', 'planning')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000),

    (async () => { try { return await supabase.from('saved_trips').select('trip_id').limit(500) } catch { return { data: [] } } })(),

    userId ? getBlockedUserIds() : Promise.resolve([]),

    userId
      ? supabase.from('users').select('age, country, gender, travel_styles, travel_with').eq('id', userId).maybeSingle().then(r => r.data as UserProfile | null)
      : Promise.resolve(null),
  ])

  if (tripsResult.error) {
    console.error('getTripsForMap error:', tripsResult.error)
    throw tripsResult.error
  }

  const blockedSet = new Set(blockedIds)
  const saveCounts: Record<string, number> = {}
  ;(savesResult.data ?? []).forEach((s: any) => { saveCounts[s.trip_id] = (saveCounts[s.trip_id] ?? 0) + 1 })

  const joinedMemberCount = (trip: any) => {
    const inCount = (trip.members ?? []).filter((m: any) => m.status === 'in').length
    const creatorCounted = (trip.members ?? []).some((m: any) => m.user_id === trip.creator_id && m.status === 'in')
    return inCount + (creatorCounted ? 0 : 1)
  }

  return (tripsResult.data ?? [])
    .filter((trip: any) => {
      if (blockedSet.has(trip.creator_id)) return false
      if (!isTripGenderEligible(trip, profile)) return false
      // Full trips still show and stay joinable (soft capacity).
      return true
    })
    .map((trip: any) => ({
      ...trip,
      member_count: joinedMemberCount(trip),
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
        status,
        user:users(id, name, profile_photo, travel_styles, travel_pace, social_energy, planning_style, experience_level)
      )
    `)
    .eq('id', tripId)
    .single()

  if (error) throw error
  const trip = data as any
  const inCount = (trip.members ?? []).filter((m: any) => m.status === 'in').length
  const creatorCounted = (trip.members ?? []).some((m: any) => m.user_id === trip.creator_id && m.status === 'in')
  return {
    ...trip,
    member_count: inCount + (creatorCounted ? 0 : 1),
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
  const { data: chatResult, error: chatError } = await supabase.rpc('ensure_trip_chat_member', { p_trip_id: tripId })
  if (chatError) throw chatError

  // 3. Auto-save the trip
  await supabase
    .from('saved_trips')
    .upsert({ trip_id: tripId, user_id: userId }, { onConflict: 'trip_id,user_id' })

  // 4. Notify existing members someone joined
  const chatId = (chatResult as any)?.chat_id
  if (chatId) {
    Promise.all([
      supabase.from('trips').select('destination').eq('id', tripId).single(),
      supabase.from('users').select('name').eq('id', userId).single(),
    ]).then(([tripRes, userRes]) => {
      const destination = (tripRes.data as any)?.destination ?? 'a trip'
      const joinerName = (userRes.data as any)?.name ?? 'Someone'
      notifyJoin(chatId, userId, joinerName, `your trip to ${destination}`, `/chat/${chatId}`)
    }).catch(() => {})
  }
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

const MSG_SELECT = `
  *,
  sender:users(id, name, profile_photo),
  reply_to:trip_messages!reply_to_id(id, content, sender_id, sender:users(name)),
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
  type: 'text' | 'image' | 'video' = 'text',
) {
  const payload: Record<string, unknown> = { trip_chat_id: chatId, sender_id: senderId, content, type }
  if (replyToId) payload.reply_to_id = replyToId
  const { error } = await supabase.from('trip_messages').insert(payload)
  if (error) throw error
}

const CHAT_IMAGES_BASE = 'https://tnstvbxngubfuxatggem.supabase.co/storage/v1/object/public/chat-images'

// Despite the bucket/URL constant's name, this uploads any chat media file —
// photo or video — the storage bucket doesn't care about content type.
export async function uploadChatMedia(chatId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  // crypto.randomUUID(), not Date.now() — a multi-photo send fires these in
  // parallel (Promise.allSettled(files.map(...))), and two files picked in
  // the same millisecond previously collided on the exact same storage path,
  // so the second upload's URL resolved to whichever file's bytes actually
  // landed there — both messages then rendered the same photo.
  const path = `${chatId}/${crypto.randomUUID()}.${ext}`
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
  // Goes through a SECURITY DEFINER RPC (get_trip_chat_read_positions) rather
  // than a direct table select: RLS on trip_chat_members only exposes the
  // caller's own row, so a REST select returns no co-members and the "who
  // viewed" receipts come back empty. The RPC checks membership then returns
  // every member's last_read_at. See 20260718_chat_read_positions_and_receipts.sql.
  const { data, error } = await supabase.rpc('get_trip_chat_read_positions', { p_chat_id: chatId })
  if (error) return []
  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    last_read_at: row.last_read_at,
    user: { name: row.name, profile_photo: row.profile_photo },
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

// Batched direct read of user names/photos by id. Uses a plain select (like
// getProfile), NOT a PostgREST embed — embedded `users` joins (e.g. the chat's
// sender:users(...)) come back empty on the client, but direct reads work, so
// this is the reliable way to resolve sender names in the chat.
export async function getUsersByIds(
  ids: string[],
): Promise<{ id: string; name: string | null; profile_photo: string | null }[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('users')
    .select('id, name, profile_photo')
    .in('id', unique)
  if (error) return []
  return (data ?? []) as { id: string; name: string | null; profile_photo: string | null }[]
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>) {
  const { error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

// Resolve a destination name → { lat, lng } via the keyless /api/geocode proxy.
// Best-effort: returns null on any failure so trip creation is never blocked.
export async function geocodeDestination(
  destination: string,
  country?: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = destination.trim()
  if (!q) return null
  try {
    const params = new URLSearchParams({ q })
    if (country?.trim()) params.set('country', country.trim())
    const res = await fetch(`/api/geocode?${params.toString()}`)
    if (!res.ok) return null
    const { result } = await res.json()
    if (!result || typeof result.lat !== 'number' || typeof result.lng !== 'number') return null
    return { lat: result.lat, lng: result.lng }
  } catch {
    return null
  }
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
  latitude?: number | null
  longitude?: number | null
}): Promise<string> {
  const { data: inserted, error } = await supabase.from('trips').insert(data).select('id').single()
  if (error) throw error
  const tripId = inserted.id as string

  // Auto-join the creator to their own trip and its group chat, so the chat
  // exists and they're already in it (mirrors joinTrip, minus the "someone
  // joined" self-notification). Without this the creator wasn't a member and
  // the chat didn't exist, so "Open Group Chat" fell back to the inbox.
  await supabase.from('trip_members')
    .upsert({ trip_id: tripId, user_id: data.creator_id, status: 'in' }, { onConflict: 'trip_id,user_id' })
  const { error: chatError } = await supabase.rpc('ensure_trip_chat_member', { p_trip_id: tripId })
  if (chatError) console.error('createTrip: ensure_trip_chat_member failed', chatError)

  return tripId
}

export async function getUserTripChats(_userId: string) {
  const { data, error } = await supabase.rpc('get_my_trip_chats')
  if (error) return []
  return (data ?? []).map((row: any) => ({
    trip_chat_id: row.trip_chat_id,
    trip_chat: {
      id: row.trip_chat_id,
      trip: row.trip_id ? {
        id: row.trip_id,
        destination: row.destination,
        country: row.country,
        cover_image: row.cover_image,
      } : null,
      hangalong: row.hangalong_id ? {
        id: row.hangalong_id,
        title: row.hangalong_title,
        location_name: row.hangalong_location,
        photo_url: row.hangalong_photo,
        activity_type: row.hangalong_activity,
      } : null,
    },
    last_message: row.last_message ?? null,
    last_message_at: row.last_message_at ?? null,
    last_message_sender_id: row.last_message_sender_id ?? null,
    others_read: row.others_read ?? false,
    unread_count: Number(row.unread_count ?? 0),
    is_muted: row.is_muted ?? false,
    is_pinned: row.is_pinned ?? false,
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

export async function setTripChatPinned(chatId: string, pinned: boolean): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase
    .from('trip_chat_members')
    .update({ is_pinned: pinned })
    .eq('trip_chat_id', chatId)
    .eq('user_id', uid)
}

export async function setDMPinned(conversationId: string, pinned: boolean): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase
    .from('conversation_members')
    .update({ is_pinned: pinned })
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
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

// DM mute — mirrors trip-chat mute but on conversation_members. Muting only
// silences push (the DM push RPCs filter is_muted); messages still arrive.
export async function getDMMuted(conversationId: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return false
  const { data } = await supabase
    .from('conversation_members')
    .select('is_muted')
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
    .single()
  return (data as any)?.is_muted ?? false
}

export async function setDMMuted(conversationId: string, muted: boolean) {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase
    .from('conversation_members')
    .update({ is_muted: muted })
    .eq('conversation_id', conversationId)
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
  const rows = (dmsResult.data ?? []).filter((row: any) => !blockedSet.has(row.other_user_id))

  // get_my_dms is a hand-made RPC (not in this repo) and predates is_muted, so
  // it isn't guaranteed to return it. Fetch mute state directly from
  // conversation_members instead of relying on the RPC to expose it.
  const uid = (await supabase.auth.getUser()).data.user?.id
  const mutedMap: Record<string, boolean> = {}
  if (uid && rows.length) {
    const { data: cm } = await supabase
      .from('conversation_members')
      .select('conversation_id, is_muted')
      .eq('user_id', uid)
      .in('conversation_id', rows.map((r: any) => r.id))
    ;(cm ?? []).forEach((r: any) => { mutedMap[r.conversation_id] = !!r.is_muted })
  }

  return rows.map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message: row.last_message ?? null,
    last_message_at: row.last_message_at ?? null,
    last_message_sender_id: row.last_message_sender_id ?? null,
    other_last_read_at: row.other_last_read_at ?? null,
    unread_count: Number(row.unread_count ?? 0),
    is_pinned: row.is_pinned ?? false,
    is_muted: mutedMap[row.id] ?? false,
    other_user: {
      id: row.other_user_id,
      name: row.other_user_name,
      profile_photo: row.other_user_photo,
    },
  }))
}

// Removes the DM from the current user's own list only — deletes their
// conversation_members row (ON DELETE CASCADE, no effect on the conversation,
// messages, or the other participant's membership row).
export async function deleteDMConversation(conversationId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
  if (error) throw error
}

export async function getOrCreateDM(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { other_user_id: otherUserId })
  if (error) throw error
  return data as string
}

const DM_MSG_SELECT = `
  *,
  sender:users(id, name, profile_photo),
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
  type: 'text' | 'image' | 'video' = 'text',
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

// Despite the name, this uploads any DM media file — photo or video.
export async function uploadDMMedia(conversationId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  // Same fix as uploadChatMedia — crypto.randomUUID() instead of Date.now(),
  // which collided when multiple photos uploaded in the same millisecond.
  const path = `dm/${conversationId}/${crypto.randomUUID()}.${ext}`
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
  const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid).limit(1000)
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
        members:trip_members(user_id, status, user:users(id, name, profile_photo, travel_styles, travel_pace, social_energy, planning_style, experience_level))
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
        members:trip_members(user_id, status, user:users(id, name, profile_photo, travel_styles, travel_pace, social_energy, planning_style, experience_level))
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
    if (!(data as any).trip_id) return null
    return await getTrip((data as any).trip_id)
  } catch (e: any) {
    console.error('[getTripInfoByChatId] error:', e?.message ?? e)
    return null
  }
}

export async function getHangInfoByChatId(chatId: string): Promise<HangalongWithDetails | null> {
  try {
    const { data, error } = await supabase
      .from('trip_chats')
      .select('hangalong_id')
      .eq('id', chatId)
      .single()
    if (error || !data || !(data as any).hangalong_id) return null
    const { data: hang, error: hangErr } = await supabase
      .from('hangalongs')
      .select(HANG_SELECT)
      .eq('id', (data as any).hangalong_id)
      .single()
    if (hangErr || !hang) return null
    return { ...(hang as any), member_count: (hang as any).members?.length ?? 0 } as HangalongWithDetails
  } catch (e: any) {
    console.error('[getHangInfoByChatId] error:', e?.message ?? e)
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

  // Chat membership only auto-adds on INSERT (DB trigger), not on this UPDATE
  // path — so flipping an existing row to 'in' (e.g. Maybe → I'm In) used to
  // silently leave the user out of trip_chat_members and their group chat
  // would never appear in Messages. ensure_trip_chat_member is idempotent and
  // ON CONFLICT DO NOTHING under the hood, so this is safe to call every time.
  if (status === 'in') {
    try {
      await supabase.rpc('ensure_trip_chat_member', { p_trip_id: tripId })
    } catch {}
  }
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
        .filter(f => f.id)
        .slice(0, 8)
        .map(f => `${STORAGE_BASE}/${cat}/${normalized}/${f.name}`)
    })
  )

  const storagePhotos = results
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  if (storagePhotos.length > 0) return storagePhotos

  // Fallback: Pexels API for any destination not in our storage
  try {
    const res = await fetch(`/api/photos?q=${encodeURIComponent(destination)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.photos ?? []
  } catch {
    return []
  }
}

export async function getSampleProfiles(count = 4): Promise<{ id: string; name: string; profile_photo: string | null }[]> {
  try {
    const uid = (await supabase.auth.getUser()).data.user?.id
    const { data } = await supabase
      .from('users')
      .select('id, name, profile_photo')
      .not('profile_photo', 'is', null)
      .neq('id', uid ?? '')
      .limit(count + 15)
    if (!data?.length) return []
    return [...data]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
  } catch { return [] }
}

export async function getTravelImages(count = 12): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('trips')
      .select('cover_image')
      .not('cover_image', 'is', null)
      .limit(50)
    if (!data?.length) return []
    return [...data]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((t: any) => t.cover_image as string)
      .filter(Boolean)
  } catch { return [] }
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

export async function getMyViewerCount(): Promise<number> {
  // Real COUNT(*) — unlike getProfileViewers, never capped at a page-size limit.
  const { data, error } = await supabase.rpc('get_my_viewer_count')
  if (error) return 0
  return data ?? 0
}

export async function getProfileViewers(limit = 50): Promise<{ id: string; name: string; profile_photo: string | null; travel_styles: string[]; country: string | null; viewed_at: string }[]> {
  // Uses server-side RPC that checks Plus status in the DB — cannot be bypassed client-side
  const { data, error } = await supabase.rpc('get_my_viewers', { p_limit: limit })
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.viewer_id,
    name: displayName(row.name),
    profile_photo: row.profile_photo ?? null,
    travel_styles: row.travel_styles ?? [],
    country: row.country ?? null,
    viewed_at: row.viewed_at,
  }))
}

// Join counts for the TripAlong World daily join cap: how many trips the user
// has joined total (lifetime, for the free-join grace) and today (for the cap).
// Counts confirmed memberships only ('in'). Head-only count queries — cheap.
export async function getJoinStats(): Promise<{ today: number; lifetime: number }> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return { today: 0, lifetime: 0 }
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const [lifetimeRes, todayRes] = await Promise.all([
    supabase.from('trip_members').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).eq('status', 'in'),
    supabase.from('trip_members').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).eq('status', 'in').gte('joined_at', dayStart.toISOString()),
  ])
  return { lifetime: lifetimeRes.count ?? 0, today: todayRes.count ?? 0 }
}

// ── HangAlong ─────────────────────────────────────────────────────────────

const HANG_SELECT = `
  *,
  creator:users!hangalongs_creator_id_fkey(id, name, profile_photo),
  members:hangalong_members(user_id, user:users(id, name, profile_photo))
`

export async function getHangalong(id: string): Promise<HangalongWithDetails | null> {
  const { data, error } = await supabase
    .from('hangalongs')
    .select(HANG_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return { ...(data as any), member_count: ((data as any).members?.length ?? 0) + 1 } as HangalongWithDetails
}

export async function getHangalongs(): Promise<HangalongWithDetails[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  const now = new Date()

  const [hangsResult, seenResult, profile] = await Promise.all([
    supabase
      .from('hangalongs')
      .select(HANG_SELECT)
      .order('created_at', { ascending: false })
      .limit(100),

    userId
      ? supabase.from('user_seen_hangalongs').select('hangalong_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),

    userId
      ? supabase.from('users').select('age, country, gender, travel_styles, travel_with').eq('id', userId).maybeSingle().then(r => r.data as UserProfile | null)
      : Promise.resolve(null),
  ])

  if (!hangsResult.data) return []

  const seenSet = new Set<string>((seenResult.data ?? []).map((r: any) => r.hangalong_id))

  const hangalongs = (hangsResult.data as any[])
    .filter(h => {
      if (h.creator_id === userId) return false
      if (seenSet.has(h.id)) return false
      // Already a member
      if (userId && h.members?.some((m: any) => m.user_id === userId)) return false
      // Full
      const memberCount = (h.members?.length ?? 0) + 1
      if (memberCount >= h.max_people) return false
      // Expired scheduled hangout
      if (h.scheduled_for && new Date(h.scheduled_for) < now) return false
      return true
    })
    .map(h => ({ ...h, member_count: (h.members?.length ?? 0) + 1 })) as HangalongWithDetails[]

  return sortHangalongs(hangalongs, profile)
}

export async function getMyHangalongs(): Promise<HangalongWithDetails[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return []

  const { data, error } = await supabase
    .from('hangalongs')
    .select(HANG_SELECT)
    .eq('creator_id', uid)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return []

  return (data as any[]).map(h => ({
    ...h,
    member_count: (h.members?.length ?? 0) + 1,
  })) as HangalongWithDetails[]
}

export async function createHangalong(payload: {
  title: string
  description?: string
  activity_type: ActivityType
  location_name: string
  when_label: WhenLabel
  max_people: number
  photo_url?: string
}): Promise<{ hangalongId: string; chatId: string } | null> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return null

  // Create the hangalong
  const { data: hangData, error: hangError } = await supabase
    .from('hangalongs')
    .insert({ ...payload, creator_id: uid })
    .select('id')
    .single()
  if (hangError || !hangData) return null
  const hangalongId = (hangData as any).id

  // Create chat + add creator as member in one SECURITY DEFINER call
  // (direct insert + select fails RLS: can't read back chat until you're a member)
  const { data: chatId, error: chatError } = await supabase.rpc('create_hangalong_chat', { p_hangalong_id: hangalongId })
  if (chatError || !chatId) return { hangalongId, chatId: '' }

  return { hangalongId, chatId }
}

export async function joinHangalong(hangalongId: string, userId: string): Promise<{ ok: boolean; chatId?: string }> {
  const { error } = await supabase
    .from('hangalong_members')
    .insert({ hangalong_id: hangalongId, user_id: userId })
  if (error) return { ok: false }

  // Add joiner to the hangalong's group chat
  const { data: chatData } = await supabase
    .from('trip_chats')
    .select('id')
    .eq('hangalong_id', hangalongId)
    .maybeSingle()
  if (chatData) {
    const chatId = (chatData as any).id
    await supabase.from('trip_chat_members').upsert({ trip_chat_id: chatId, user_id: userId }, { onConflict: 'trip_chat_id,user_id' })

    Promise.all([
      supabase.from('hangalongs').select('title').eq('id', hangalongId).single(),
      supabase.from('users').select('name').eq('id', userId).single(),
    ]).then(([hangRes, userRes]) => {
      const title = (hangRes.data as any)?.title ?? 'your hangout'
      const joinerName = (userRes.data as any)?.name ?? 'Someone'
      notifyJoin(chatId, userId, joinerName, title, `/chat/${chatId}`)
    }).catch(() => {})

    return { ok: true, chatId }
  }
  return { ok: true }
}

export async function getHangalongChatId(hangalongId: string): Promise<string | null> {
  const { data } = await supabase.from('trip_chats').select('id').eq('hangalong_id', hangalongId).maybeSingle()
  return data ? (data as any).id : null
}

export async function leaveHangalong(hangalongId: string, userId: string): Promise<void> {
  await supabase.from('hangalong_members').delete().eq('hangalong_id', hangalongId).eq('user_id', userId)
}

export async function leaveHangalongFromChat(hangalongId: string, chatId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return
  await supabase.from('hangalong_members').delete().eq('hangalong_id', hangalongId).eq('user_id', uid)
  await supabase.from('trip_chat_members').delete().eq('trip_chat_id', chatId).eq('user_id', uid)
}

export async function getUserJoinedHangalongIds(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('hangalong_members')
      .select('hangalong_id')
      .eq('user_id', userId)
    return (data ?? []).map((d: any) => d.hangalong_id)
  } catch { return [] }
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
