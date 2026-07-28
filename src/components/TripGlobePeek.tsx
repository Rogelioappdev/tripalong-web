'use client'

import { motion } from 'framer-motion'
import { resizedImage, resizedAvatar } from '@/lib/imageUrl'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails } from '@/lib/types'

type Person = { id?: string; name?: string | null; profile_photo?: string | null }

// Compact overview that floats up when a globe pin is tapped — essentials only,
// with a "Learn more" button that opens the full TripDetailModal. Keeps the
// globe visible behind it so it feels like browsing, not a full takeover.

function formatWhen(trip: TripWithDetails): string {
  if (trip.is_flexible_dates || (!trip.start_date && !trip.end_date)) return 'Flexible dates'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const s = trip.start_date ? new Date(trip.start_date).toLocaleDateString('en-US', opts) : ''
  const e = trip.end_date ? new Date(trip.end_date).toLocaleDateString('en-US', opts) : ''
  if (s && e) return `${s} – ${e}`
  return s || e || 'Flexible dates'
}

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] ?? ''

// Human "who's going" line — the social-proof hook. Uses real names when we
// have them, falls back to a count, and invites the first joiner on empty trips.
function goingLine(names: string[], going: number): string {
  if (going === 0) return 'Be the first to join this trip'
  if (names.length === 0) return `${going} ${going === 1 ? 'traveler' : 'travelers'} going`
  if (names.length === 1) {
    return going === 1 ? `${names[0]} is going` : `${names[0]} + ${going - 1} more going`
  }
  if (going <= 3 && names.length <= 3) {
    if (names.length === 2) return `${names[0]} & ${names[1]} are going`
    return `${names[0]}, ${names[1]} & ${names[2]} are going`
  }
  return `${names[0]}, ${names[1]} & ${going - 2} others are going`
}

// Overlapping traveler avatar — real photo, or a colored initial as a fallback.
function MemberAvatar({ person, index }: { person: Person; index: number }) {
  const photo = person.profile_photo
  const initial = firstName(person.name).charAt(0).toUpperCase() || '?'
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center"
      style={{
        width: 28,
        height: 28,
        marginLeft: index === 0 ? 0 : -8,
        border: '1.5px solid #0c0c0c',
        background: '#2a2a2a',
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11,
        fontWeight: 600,
        zIndex: 10 - index,
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resizedAvatar(photo, 80)} alt="" className="w-full h-full object-cover ta-avatar" />
      ) : (
        initial
      )}
    </div>
  )
}

export function TripGlobePeek({
  trip,
  onClose,
  onLearnMore,
}: {
  trip: TripWithDetails
  onClose: () => void
  onLearnMore: () => void
}) {
  const going = trip.member_count ?? 0
  const cap = trip.max_group_size
  const vibes = (trip.vibes ?? []).slice(0, 4)

  // The actual going party: host + confirmed ('in') members, host first, deduped.
  // Ignores pending/requested members so the pile matches who's really committed.
  const inMembers = (trip.members ?? []).filter(m => m.status === 'in')
  const creatorInMembers = inMembers.some(m => m.user_id === trip.creator_id)
  const goingPeople: Person[] = [
    ...(trip.creator && !creatorInMembers ? [trip.creator as Person] : []),
    ...inMembers.map(m => m.user as Person),
  ].filter(p => p && (p.name || p.profile_photo))
  const avatars = goingPeople.slice(0, 4)
  const names = goingPeople.map(p => firstName(p.name)).filter(Boolean)
  const spotsLeft = cap ? cap - going : null
  // Only surface scarcity when it's real — no manufactured urgency.
  const urgency =
    spotsLeft != null && spotsLeft > 0 && spotsLeft <= 3
      ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`
      : null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => { if (info.offset.y > 80) onClose() }}
        className="w-full max-w-md mx-3 rounded-3xl overflow-hidden"
        style={{ marginBottom: 92, background: '#0c0c0c', border: '0.5px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 44px rgba(0,0,0,0.6)' }}
      >
        {/* Cover */}
        <div className="relative" style={{ height: 116 }}>
          {trip.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resizedImage(trip.cover_image, 640)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: '#111' }}>🌍</div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.05))' }} />
          <div className="absolute left-4 right-4" style={{ bottom: 10 }}>
            <h2 className="text-[#F0EBE3] text-lg font-semibold leading-tight">{trip.destination}</h2>
            {trip.country && <p className="text-white/60 text-xs mt-0.5">{trip.country}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute flex items-center justify-center rounded-full"
            style={{ top: 10, right: 10, width: 30, height: 30, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 13 }}
          >
            ✕
          </button>
        </div>

        {/* Essentials */}
        <div className="px-4 py-3.5">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-white/70 text-xs mb-3">
            <span>{formatWhen(trip)}</span>
            {trip.budget_level && (
              <>
                <span className="text-white/25">·</span>
                <span className="capitalize">{trip.budget_level}</span>
              </>
            )}
          </div>

          {vibes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {vibes.map((v) => (
                <span
                  key={v}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
                >
                  {v}
                </span>
              ))}
            </div>
          )}

          {/* Who's going — real faces + scarcity, the actual reason people join
              a group trip. Replaces the old destination mini-map (which just
              re-showed a dot they'd already seen on the globe). */}
          <div
            className="rounded-2xl mb-3.5 px-3.5 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between mb-2" style={{ minHeight: 28 }}>
              <div className="flex items-center">
                {avatars.length > 0 ? (
                  <>
                    {avatars.map((p, i) => (
                      <MemberAvatar key={p.id ?? i} person={p} index={i} />
                    ))}
                    {going > avatars.length && (
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 28, height: 28, marginLeft: -8,
                          border: '1.5px solid #0c0c0c', background: '#1c1c1c',
                          color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600, zIndex: 1,
                        }}
                      >
                        +{going - avatars.length}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-white/40 text-xs">No one’s joined yet</span>
                )}
              </div>
              {urgency && (
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: 'rgba(245,180,90,0.14)', color: '#F0BE7A' }}
                >
                  {urgency}
                </span>
              )}
            </div>
            <p className="text-[#F0EBE3] text-[13px] font-medium leading-tight">
              {goingLine(names, going)}
            </p>
            {trip.creator?.name && (
              <p className="text-white/45 text-[11px] mt-1">Hosted by {firstName(trip.creator.name)}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => { haptic(10); onLearnMore() }}
            className="w-full rounded-2xl font-semibold text-sm active:opacity-80 transition-opacity"
            style={{ background: '#F0EBE3', color: '#0a0a0a', padding: '13px 0' }}
          >
            Learn more
          </button>
        </div>
      </motion.div>
    </div>
  )
}
