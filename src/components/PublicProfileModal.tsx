'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfile, getTrip, getOrCreateDM, recordProfileView } from '@/lib/queries'
import { BlockReportSheet } from './BlockReportSheet'
import { getFlag } from '@/lib/countries'
import { TripDetailModal } from './TripDetailModal'
import { haptic } from '@/lib/haptics'
import type { UserProfile, TripWithDetails } from '@/lib/types'

interface PublicProfileModalProps {
  userId: string
  onClose: () => void
  locked?: boolean
  onRevealRequest?: () => boolean
  onSendMessageLocked?: () => void
}

const TRAVEL_STYLES = [
  { id: 'luxury', label: 'Luxury', icon: '✨' },
  { id: 'backpacking', label: 'Backpacking', icon: '🎒' },
  { id: 'relaxed', label: 'Relaxed', icon: '🏖️' },
  { id: 'cultural', label: 'Cultural', icon: '🏛️' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'adventure', label: 'Adventure', icon: '🏔️' },
  { id: 'party', label: 'Party', icon: '🎉' },
  { id: 'foodie', label: 'Foodie', icon: '🍜' },
]

const PACE_OPTIONS    = [{ id: 'slow', label: 'Slow & Steady', emoji: '🐢' }, { id: 'balanced', label: 'Balanced', emoji: '⚖️' }, { id: 'fast', label: 'Go Go Go!', emoji: '🚀' }]
const PLANNING_OPT    = [{ id: 'planner', label: 'Planner', emoji: '📋' }, { id: 'spontaneous', label: 'Spontaneous', emoji: '🎲' }, { id: 'flexible', label: 'Flexible', emoji: '🤸' }]
const PERSONALITY_OPT = [{ id: 'introvert', label: 'Introvert', emoji: '🌙' }, { id: 'extrovert', label: 'Extrovert', emoji: '☀️' }, { id: 'ambivert', label: 'Ambivert', emoji: '🌗' }]
const EXPERIENCE_OPT  = [{ id: 'beginner', label: 'Beginner', emoji: '🌱' }, { id: 'intermediate', label: 'Intermediate', emoji: '🌿' }, { id: 'experienced', label: 'Experienced', emoji: '🌳' }, { id: 'expert', label: 'Expert', emoji: '🌍' }]

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 400

function label(opts: { id: string; label: string; emoji: string }[], id: string | null | undefined) {
  if (!id) return null
  const o = opts.find(x => x.id === id)
  return o ? `${o.emoji} ${o.label}` : null
}

function PrefTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginBottom: 3 }}>{title}</p>
      <p className="text-white font-medium text-sm">{value}</p>
    </div>
  )
}

// ── Full-screen photo lightbox ──────────────────────────────────────────────
interface LightboxProps {
  photos: string[]
  initialIndex: number
  onClose: () => void
}

function PhotoLightbox({ photos, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [direction, setDirection] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) navigate(index - 1, -1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) navigate(index + 1, 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, photos.length, onClose])

  const navigate = (next: number, dir: number) => {
    setDirection(dir)
    setIndex(next)
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      if (index < photos.length - 1) navigate(index + 1, 1)
    } else if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      if (index > 0) navigate(index - 1, -1)
    }
  }

  if (!mounted) return null

  const content = (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Top bar */}
      <div
        className="flex items-center justify-between shrink-0 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 12 }}
      >
        {photos.length > 1 ? (
          <span className="text-white font-semibold text-sm" style={{ opacity: 0.6 }}>
            {index + 1} / {photos.length}
          </span>
        ) : <span />}
        <button
          onClick={() => { haptic(8); onClose() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.15)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Swipeable image area */}
      <motion.div
        className="flex-1 overflow-hidden relative"
        drag={photos.length > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'pan-y' } as React.CSSProperties}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            className="absolute inset-0 flex items-center justify-center"
            custom={direction}
            initial={{ x: direction * 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
          >
            <img
              src={photos[index]}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Dots */}
      {photos.length > 1 && (
        <div
          className="flex justify-center gap-2 shrink-0"
          style={{ paddingTop: 16, paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        >
          {photos.map((_, i) => (
            <button key={i} onClick={() => { haptic(4); navigate(i, i > index ? 1 : -1) }}>
              <div
                className="rounded-full transition-all duration-200"
                style={{ width: i === index ? 24 : 8, height: 8, backgroundColor: i === index ? '#F0EBE3' : 'rgba(255,255,255,0.3)' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}

// ── Main modal ──────────────────────────────────────────────────────────────
export function PublicProfileModal({ userId, onClose, locked = false, onRevealRequest, onSendMessageLocked }: PublicProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [photoDirection, setPhotoDirection] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showBlockReport, setShowBlockReport] = useState(false)
  const router = useRouter()
  const heroPtrRef = useRef({ x: 0, y: 0 })
  const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null)
  const [dmLoading, setDmLoading] = useState(false)
  const [revealed, setRevealed] = useState(!locked)

  const isLocked = locked && !revealed

  const handleReveal = () => {
    haptic(14)
    if (onRevealRequest?.()) {
      setRevealed(true)
    }
  }

  const handleSendMessage = async () => {
    if (dmLoading || !currentUserId) return
    setDmLoading(true)
    try {
      const convId = await getOrCreateDM(userId)
      onClose()
      router.push(`/dm/${convId}`)
    } catch (e) {
      console.error('DM error', e)
    } finally {
      setDmLoading(false)
    }
  }

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setCurrentUserId(uid)
      if (uid && uid !== userId) recordProfileView(userId)
    })
  }, [userId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    setPhotoIndex(0)
    setSavedTrips([])
    getProfile(userId).then(p => { setProfile(p); setLoading(false) })
    supabase
      .from('saved_trips')
      .select('trip:trips!trip_id(id, destination, cover_image)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setSavedTrips((data ?? []).map((r: any) => r.trip).filter(Boolean)))
  }, [userId])

  if (!mounted) return null

  const navigatePhoto = (next: number, dir: number) => {
    setPhotoDirection(dir)
    setPhotoIndex(next)
  }

  const handleHeroDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const allPhotos = profile?.photos?.length ? profile.photos : profile?.profile_photo ? [profile.profile_photo] : []
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      if (photoIndex < allPhotos.length - 1) navigatePhoto(photoIndex + 1, 1)
    } else if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      if (photoIndex > 0) navigatePhoto(photoIndex - 1, -1)
    }
  }

  const content = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
        style={{ backgroundColor: '#000', borderRadius: '20px 20px 0 0', height: '100dvh' }}
      >
        {loading || !profile ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : (() => {
          const allPhotos = profile.photos?.length ? profile.photos : profile.profile_photo ? [profile.profile_photo] : []
          const mainPhoto = allPhotos[photoIndex] ?? null
          const travelStyles = profile.travel_styles ?? []
          const languages = profile.languages ?? []
          const placesVisited = profile.places_visited ?? []
          const bucketList = profile.bucket_list ?? []

          return (
            <>
              {/* ── Hero ── */}
              <div className="relative shrink-0" style={{ height: '45dvh' }}>

                {/* Photo with slide animation */}
                <AnimatePresence initial={false} custom={photoDirection} mode="popLayout">
                  {mainPhoto ? (
                    <motion.img
                      key={photoIndex}
                      src={mainPhoto}
                      alt={profile.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      custom={photoDirection}
                      initial={{ x: photoDirection * 60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: photoDirection * -60, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.8 }}
                      draggable={false}
                    />
                  ) : (
                    <motion.div
                      key="placeholder"
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: '#111' }}
                    >
                      <span className="text-white font-bold" style={{ fontSize: 64 }}>{profile.name?.[0]?.toUpperCase()}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Blur overlay — only when locked, fades out on reveal */}
                <AnimatePresence>
                  {isLocked && (
                    <motion.div
                      key="blur-overlay"
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      style={{
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                      } as React.CSSProperties}
                    />
                  )}
                </AnimatePresence>

                {/* Gradient */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, rgba(0,0,0,0.95) 100%)' }} />

                {/* Swipe + tap drag layer — sits above gradient, below close button */}
                {allPhotos.length > 0 && (
                  <motion.div
                    className="absolute inset-0"
                    drag={allPhotos.length > 1 ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.12}
                    onDragEnd={handleHeroDragEnd}
                    onPointerDown={(e) => { heroPtrRef.current = { x: e.clientX, y: e.clientY } }}
                    onPointerUp={(e) => {
                      const dx = Math.abs(e.clientX - heroPtrRef.current.x)
                      const dy = Math.abs(e.clientY - heroPtrRef.current.y)
                      if (dx < 6 && dy < 6) setLightboxOpen(true)
                    }}
                    style={{ touchAction: 'pan-y', cursor: 'pointer' } as React.CSSProperties}
                  />
                )}

                {/* Photo dots */}
                {allPhotos.length > 1 && (
                  <div className="absolute flex justify-center gap-1.5 pointer-events-none" style={{ bottom: 88, left: 0, right: 0 }}>
                    {allPhotos.map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-200"
                        style={{ width: i === photoIndex ? 24 : 8, height: 8, backgroundColor: i === photoIndex ? '#F0EBE3' : 'rgba(255,255,255,0.35)' }}
                      />
                    ))}
                  </div>
                )}

                {/* Chevron-down close — z-index keeps it above drag layer */}
                <button
                  onClick={() => { haptic(8); onClose() }}
                  className="absolute flex items-center justify-center active:scale-90 transition-transform"
                  style={{ top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', border: '0.5px solid rgba(255,255,255,0.15)', zIndex: 10 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Verified badge */}
                {profile.is_verified && (
                  <div className="absolute flex items-center gap-1 rounded-full px-3 py-1.5" style={{ top: 56, right: 16, backgroundColor: 'rgba(240,235,227,0.18)', border: '0.5px solid rgba(240,235,227,0.35)', zIndex: 10 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="text-white text-xs font-semibold">Verified</span>
                  </div>
                )}

                {/* Name / age / location */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pointer-events-none" style={{ zIndex: 5 }}>
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-white font-bold" style={{ fontSize: 36 }}>{profile.name}</span>
                    {profile.age && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 28, fontWeight: 300 }}>{profile.age}</span>}
                  </div>
                  {(profile.city || profile.country) && (
                    <div className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#F0EBE3" strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke="#F0EBE3" strokeWidth="2"/></svg>
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="px-6 pt-6 pb-6 flex flex-col gap-7">

                  {/* Bio */}
                  {profile.bio && (
                    <div>
                      <p className="text-white font-semibold text-lg mb-3">About</p>
                      <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 15, lineHeight: '26px' }}>{profile.bio}</p>
                    </div>
                  )}

                  {/* Travel Style */}
                  {travelStyles.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>✨</span>
                        <p className="text-white font-semibold text-lg">Travel Style</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {travelStyles.map((s, i) => {
                          const st = TRAVEL_STYLES.find(x => x.id === s)
                          return (
                            <span key={i} className="font-medium rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3', fontSize: 14 }}>
                              {st ? `${st.icon} ${st.label}` : s}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Travel Preferences */}
                  {(profile.gender || profile.travel_with || profile.social_energy || profile.travel_pace || profile.planning_style) && (
                    <div>
                      <p className="text-white font-semibold text-lg mb-3">Travel Preferences</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.gender && <PrefTile title="Gender" value={profile.gender === 'male' ? '👨 Man' : profile.gender === 'female' ? '👩 Woman' : '🌟 Non-binary'} />}
                        {profile.travel_with && <PrefTile title="Travels With" value={profile.travel_with === 'everyone' ? '🌍 Everyone' : profile.travel_with === 'female' ? '👩 Women Only' : '👨 Men Only'} />}
                        {label(PERSONALITY_OPT, profile.social_energy) && <PrefTile title="Personality" value={label(PERSONALITY_OPT, profile.social_energy)!} />}
                        {label(PACE_OPTIONS, profile.travel_pace) && <PrefTile title="Daily Pace" value={label(PACE_OPTIONS, profile.travel_pace)!} />}
                        {label(PLANNING_OPT, profile.planning_style) && <PrefTile title="Planning Style" value={label(PLANNING_OPT, profile.planning_style)!} />}
                      </div>
                    </div>
                  )}

                  {/* Experience Level */}
                  {label(EXPERIENCE_OPT, profile.experience_level) && (
                    <div className="flex items-center rounded-2xl px-4 py-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <span className="mr-2">🏆</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Experience Level</span>
                      <span className="text-white font-semibold text-sm ml-auto">{label(EXPERIENCE_OPT, profile.experience_level)}</span>
                    </div>
                  )}

                  {/* Places Visited */}
                  {placesVisited.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>🗺️</span>
                        <p className="text-white font-semibold text-base">Places Visited</p>
                        <span className="ml-auto text-sm font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                          {placesVisited.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {placesVisited.slice(0, 10).map((p, i) => (
                          <span key={i}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white"
                            style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <span>{getFlag(p) || '🌍'}</span>
                            <span>{p}</span>
                          </span>
                        ))}
                        {placesVisited.length > 10 && (
                          <span className="rounded-full px-3 py-1.5 text-sm"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                            +{placesVisited.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {languages.length > 0 && (
                    <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">🗣️</span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Languages</span>
                      </div>
                      <p className="text-white font-medium text-sm">{languages.join(', ')}</p>
                    </div>
                  )}

                  {/* Bucket List */}
                  {bucketList.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>✨</span>
                        <p className="text-white font-semibold text-base">Dream Destinations</p>
                        <span className="ml-auto text-sm font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(240,235,227,0.1)', color: 'rgba(240,235,227,0.6)' }}>
                          {bucketList.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bucketList.slice(0, 10).map((p, i) => (
                          <span key={i}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white"
                            style={{ background: 'rgba(240,235,227,0.08)' }}>
                            <span>{getFlag(p) || '✈️'}</span>
                            <span>{p}</span>
                          </span>
                        ))}
                        {bucketList.length > 10 && (
                          <span className="rounded-full px-3 py-1.5 text-sm"
                            style={{ background: 'rgba(240,235,227,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                            +{bucketList.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Saved Adventures */}
                  {savedTrips.length > 0 && (
                    <div>
                      <p className="uppercase font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '1.4px' }}>Saved Adventures</p>
                      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-6 px-6">
                        {savedTrips.map((t: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => getTrip(t.id).then(trip => { if (trip) setSelectedTrip(trip) })}
                            className="relative rounded-2xl overflow-hidden shrink-0 flex items-end active:scale-[0.97] transition-transform"
                            style={{ width: 110, height: 150, backgroundColor: '#111' }}
                          >
                            {t.cover_image && <img src={t.cover_image} alt={t.destination} className="absolute inset-0 w-full h-full object-cover" />}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />
                            <p className="relative text-white font-bold text-xs p-2.5 leading-tight" style={{ letterSpacing: -0.2 }}>{t.destination}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              <div
                className="px-4 pt-3 shrink-0"
                style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
              >
                {isLocked ? (
                  <>
                    {/* Unlock to Reveal — primary CTA */}
                    <button
                      type="button"
                      onClick={handleReveal}
                      className="w-full font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mb-3"
                      style={{ backgroundColor: '#F0EBE3', color: '#000', padding: '14px' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="black" strokeWidth="2"/>
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="black" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Unlock to Reveal
                      <span className="font-medium opacity-50 text-xs">· 1 free</span>
                    </button>
                    {/* Send Message — opens paywall */}
                    <button
                      type="button"
                      onClick={() => { haptic(8); onSendMessageLocked?.() }}
                      className="w-full font-semibold text-sm rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'rgba(240,235,227,0.06)', border: '1px solid rgba(240,235,227,0.12)', color: 'rgba(240,235,227,0.55)', padding: '13px' }}
                    >
                      Send Message
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { haptic(10); handleSendMessage() }}
                      disabled={dmLoading || !currentUserId || currentUserId === userId}
                      className="w-full font-semibold text-sm rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '1px solid rgba(240,235,227,0.15)', color: '#F0EBE3', padding: '13px' }}
                    >
                      {dmLoading ? 'Opening...' : 'Send Message'}
                      {!dmLoading && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#F0EBE3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    {currentUserId && currentUserId !== userId && (
                      <button
                        type="button"
                        onClick={() => { haptic(8); setShowBlockReport(true) }}
                        className="w-full text-center text-xs mt-3 py-1 transition-opacity active:opacity-60"
                        style={{ color: 'rgba(255,255,255,0.22)' }}
                      >
                        Block or Report {profile.name}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Block / Report sheet */}
              <AnimatePresence>
                {showBlockReport && (
                  <BlockReportSheet
                    userId={userId}
                    userName={profile.name}
                    userPhoto={profile.profile_photo}
                    onClose={() => setShowBlockReport(false)}
                    onBlocked={() => { setShowBlockReport(false); onClose() }}
                  />
                )}
              </AnimatePresence>

              {/* Lightbox */}
              {lightboxOpen && (
                <PhotoLightbox
                  photos={allPhotos}
                  initialIndex={photoIndex}
                  onClose={() => setLightboxOpen(false)}
                />
              )}

              {/* Trip detail — z-[90] wrapper elevates it above this modal's z-[70] */}
              {selectedTrip && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
                  <TripDetailModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
