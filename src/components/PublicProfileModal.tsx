'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfile, getTrip, getOrCreateDM, recordProfileView } from '@/lib/queries'
import { BlockReportSheet } from './BlockReportSheet'
import { getFlag } from '@/lib/countries'
import { TripDetailModal } from './TripDetailModal'
import { haptic } from '@/lib/haptics'
import { hasPlus } from '@/lib/trial'
import { useSwipeDownDismiss } from '@/lib/useSwipeDownDismiss'
import { resizedImage } from '@/lib/imageUrl'
import type { UserProfile, TripWithDetails } from '@/lib/types'

interface PublicProfileModalProps {
  userId: string
  onClose: () => void
  locked?: boolean
  onRevealRequest?: () => boolean
  onSendMessageLocked?: () => void
  onAuthRequired?: () => void
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

  // Same preload-adjacent-photos fix as the hero swipe above. Loads the
  // original, un-resized photo — see the note by the <img> below for why.
  useEffect(() => {
    if (photos.length < 2) return
    ;[index - 1, index + 1].forEach(i => {
      if (i < 0 || i >= photos.length) return
      const img = new window.Image()
      img.src = photos[i]
    })
  }, [index, photos])

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
        style={{ touchAction: 'none' } as React.CSSProperties}
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
              // Full-screen, object-contain viewer: load the original photo
              // rather than resizedImage's width-only transform. Verified live
              // that Supabase's transform endpoint ignores height when only
              // width is set (ignores requested proportions, returns the
              // source's untouched original height) — for a fixed-aspect crop
              // (avatars) that's fixed by requesting an explicit square height,
              // but here we don't know each photo's true aspect ratio up
              // front, and getting it wrong makes object-contain shrink the
              // whole image down to a narrow sliver to avoid "cropping" a
              // photo that was never actually the reported shape. Uploads are
              // already capped at ~1440px, so this isn't a meaningful
              // bandwidth cost for a "view this person's actual photo" screen.
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
export function PublicProfileModal({ userId, onClose, locked = false, onRevealRequest, onSendMessageLocked, onAuthRequired }: PublicProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  // Single source of truth for the photo list (profile photo first, then the
  // rest deduped). Both the swipe handler and the render use this — previously
  // they computed it differently, so the swipe boundary was wrong and you
  // couldn't reach every photo without opening the fullscreen lightbox.
  const allPhotos = useMemo(() => {
    if (!profile) return [] as string[]
    const base = profile.profile_photo?.split('?')[0]
    return [
      ...(profile.profile_photo ? [profile.profile_photo] : []),
      ...(profile.photos ?? []).filter(p => p.split('?')[0] !== base),
    ]
  }, [profile])
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showBlockReport, setShowBlockReport] = useState(false)
  const router = useRouter()
  const heroRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [heroWidth, setHeroWidth] = useState(0)
  const carouselX = useMotionValue(0)
  // Deterministic gesture arbitration for the photo carousel: the browser +
  // Framer's own `drag` prop negotiating "is this a horizontal swipe or a
  // vertical scroll" via touch-action was unreliable (jitter, misreads,
  // direction-dependent misfires) because touch-action has to commit to an
  // axis at touchstart, before any movement data exists. This tracks the
  // gesture manually instead: wait for a few pixels of movement, THEN decide
  // the axis from actual delta, and only ever drive one of (carousel X) or
  // (page scroll) for the rest of that gesture — never both.
  const carouselGestureRef = useRef<{
    startX: number
    startY: number
    startCarouselX: number
    startScrollTop: number
    locked: 'x' | 'y' | null
    lastX: number
    lastT: number
    velocityX: number
  } | null>(null)
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

  // Swipe down on the hero to dismiss — disabled while a nested overlay
  // (lightbox, block/report sheet, trip detail) is on top. Must run before the
  // `!mounted` early return below so hook order stays stable across renders.
  useSwipeDownDismiss(heroRef, onClose, !lightboxOpen && !showBlockReport && !selectedTrip)

  // Preload the neighboring photos so swiping to them is instant instead of
  // waiting on a fresh network fetch mid-gesture — this was the actual cause
  // of "photos take so long to load" while sliding.
  useEffect(() => {
    if (allPhotos.length < 2) return
    ;[photoIndex - 1, photoIndex + 1].forEach(i => {
      if (i < 0 || i >= allPhotos.length) return
      const img = new window.Image()
      img.src = resizedImage(allPhotos[i], 900, 78)
    })
  }, [photoIndex, allPhotos])

  // Track the hero's width so the carousel track can be positioned in real
  // pixels (needed for drag constraints/snapping) instead of guessing at %.
  // useLayoutEffect so it's measured before paint — no flash of a wrongly
  // sized first slide. Depends on `loading`/`profile` because the hero <div>
  // heroRef points at doesn't exist until the loading spinner is replaced by
  // real content — without that dependency this ran once against a null ref
  // and heroWidth stayed 0 forever, which pinned dragConstraints to
  // {left: 0, right: 0} and made the carousel completely unswipeable.
  useLayoutEffect(() => {
    const el = heroRef.current
    if (!el) return
    const update = () => setHeroWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading, profile])

  // Drive the carousel to the current photo — real drag-follow while
  // swiping (Instagram-style), spring-snap to the target index otherwise.
  useEffect(() => {
    const controls = animate(carouselX, -photoIndex * heroWidth, { type: 'spring', stiffness: 420, damping: 42 })
    return () => controls.stop()
  }, [photoIndex, heroWidth, carouselX])

  if (!mounted) return null

  const CAROUSEL_LOCK_THRESHOLD = 8 // px of movement before committing to an axis

  const handleCarouselPointerDown = (e: React.PointerEvent) => {
    if (allPhotos.length === 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    carouselGestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCarouselX: carouselX.get(),
      startScrollTop: sheetRef.current?.scrollTop ?? 0,
      locked: null,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocityX: 0,
    }
  }

  const handleCarouselPointerMove = (e: React.PointerEvent) => {
    const g = carouselGestureRef.current
    if (!g) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY

    if (!g.locked) {
      if (Math.abs(dx) < CAROUSEL_LOCK_THRESHOLD && Math.abs(dy) < CAROUSEL_LOCK_THRESHOLD) return
      // Committed once — the rest of this gesture stays on this axis no
      // matter how the finger wobbles afterward, so it can't flip mid-swipe.
      g.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }

    if (g.locked === 'x') {
      e.preventDefault()
      if (allPhotos.length > 1 && heroWidth) {
        const min = -(allPhotos.length - 1) * heroWidth
        const raw = g.startCarouselX + dx
        // Light rubber-band past the first/last photo instead of a hard stop.
        const clamped = raw > 0 ? raw * 0.3 : raw < min ? min + (raw - min) * 0.3 : raw
        carouselX.set(clamped)
      }
      const dt = e.timeStamp - g.lastT
      if (dt > 0) g.velocityX = ((e.clientX - g.lastX) / dt) * 1000
      g.lastX = e.clientX
      g.lastT = e.timeStamp
    } else if (g.locked === 'y' && sheetRef.current) {
      sheetRef.current.scrollTop = g.startScrollTop - dy
    }
  }

  const handleCarouselPointerUp = () => {
    const g = carouselGestureRef.current
    carouselGestureRef.current = null
    if (!g) return

    if (!g.locked) {
      // Never crossed the lock threshold — it was a tap, not a swipe.
      if (!isLocked) setLightboxOpen(true)
      return
    }

    if (g.locked === 'x' && heroWidth) {
      const settledPosition = -carouselX.get() + (g.velocityX < -VELOCITY_THRESHOLD ? heroWidth * 0.4 : g.velocityX > VELOCITY_THRESHOLD ? -heroWidth * 0.4 : 0)
      const nextIndex = Math.max(0, Math.min(allPhotos.length - 1, Math.round(settledPosition / heroWidth)))
      setPhotoIndex(nextIndex)
    }
  }

  const handleCarouselPointerCancel = () => { carouselGestureRef.current = null }

  const content = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        ref={sheetRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        className="relative w-full sm:max-w-lg flex flex-col overflow-y-auto overflow-x-hidden overscroll-y-none"
        style={{ backgroundColor: '#000', borderRadius: '20px 20px 0 0', height: '100dvh' }}
      >
        {loading || !profile ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : (() => {
          const mainPhoto = allPhotos[photoIndex] ?? null
          const travelStyles = profile.travel_styles ?? []
          const languages = profile.languages ?? []
          const placesVisited = profile.places_visited ?? []
          const bucketList = profile.bucket_list ?? []
          const contentBlur: React.CSSProperties = isLocked
            ? { filter: 'blur(7px)', userSelect: 'none', pointerEvents: 'none', transition: 'filter 1.1s ease-out 0.2s' }
            : { filter: 'blur(0px)', transition: 'filter 1.1s ease-out 0.2s' }

          return (
            <>
              {/* ── Hero ── */}
              <div ref={heroRef} className="relative shrink-0 w-full overflow-hidden" style={{ height: '66dvh', backgroundColor: '#111' }}>

                {/* Carousel track — one flex row of full-width slides, dragged
                    1:1 with the finger (Instagram-style) instead of crossfading.
                    Gesture axis (swipe photos vs. scroll the page) is decided
                    manually in handleCarouselPointer* — see carouselGestureRef
                    above for why: touch-action has to commit to an axis before
                    any movement data exists, which kept misreading swipes as
                    scrolls (and vice versa) depending on exactly where/how the
                    gesture started. touchAction: 'none' hands 100% of this
                    element's touch handling to that manual logic. */}
                {mainPhoto ? (
                  <motion.div
                    className="absolute inset-y-0 left-0 flex h-full"
                    style={{ x: carouselX, touchAction: 'none' }}
                    onPointerDown={handleCarouselPointerDown}
                    onPointerMove={handleCarouselPointerMove}
                    onPointerUp={handleCarouselPointerUp}
                    onPointerCancel={handleCarouselPointerCancel}
                  >
                    {allPhotos.map((photo, i) => (
                      <div key={photo} className="relative shrink-0 h-full" style={{ width: heroWidth || '100%' }}>
                        <img
                          src={resizedImage(photo, 900, 78)}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                          // Only the current + adjacent slides need to be eager —
                          // the rest can wait until they're swiped near.
                          loading={Math.abs(i - photoIndex) <= 1 ? 'eager' : 'lazy'}
                        />
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold" style={{ fontSize: 64 }}>{profile.name?.[0]?.toUpperCase()}</span>
                  </div>
                )}

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

                {/* Light top-only gradient — just enough for the close button
                    to stay legible. */}
                <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: '22%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)' }} />

                {/* Bottom gradient fades all the way to solid black so the
                    photo blends smoothly into the page below it instead of
                    cutting hard from image to flat black at the seam. */}
                <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '45%', background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)' }} />

                {/* Photo dots */}
                {allPhotos.length > 1 && (
                  <div className="absolute flex justify-center gap-1.5 pointer-events-none" style={{ bottom: 10, left: 0, right: 0, zIndex: 6 }}>
                    {allPhotos.map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-200"
                        style={{ width: i === photoIndex ? 24 : 8, height: 8, backgroundColor: i === photoIndex ? '#F0EBE3' : 'rgba(255,255,255,0.4)' }}
                      />
                    ))}
                  </div>
                )}

                {/* Chevron-down close — z-index keeps it above the carousel track */}
                <button
                  onClick={() => { haptic(8); onClose() }}
                  className="absolute flex items-center justify-center active:scale-90 transition-transform"
                  style={{ top: 'calc(env(safe-area-inset-top) + 16px)', left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', border: '0.5px solid rgba(255,255,255,0.15)', zIndex: 10 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Name / age / verified / location — liquid-glass card
                    overlaid bottom-left on the photo, so the photo still
                    fills the frame instead of getting pushed down by text.
                    pointer-events-none so a swipe starting on this card (a
                    real chunk of the photo, right where a thumb often lands)
                    passes through to the carousel's drag layer underneath
                    instead of being captured by this plain div and falling
                    back to native page scroll. */}
                <div className="absolute pointer-events-none" style={{ left: 16, bottom: 34, right: 20, zIndex: 6 }}>
                  <div
                    className="inline-flex flex-col rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor: 'rgba(20,20,20,0.35)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      border: '0.5px solid rgba(255,255,255,0.2)',
                      boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
                    } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold" style={{ fontSize: 22 }}>{profile.name}</span>
                      {profile.age && <span className="text-white font-bold" style={{ fontSize: 22 }}>{profile.age}</span>}
                      {profile.is_verified && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="11" fill="#3B82F6"/>
                          <path d="M8 12.5l2.5 2.5L16 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {hasPlus(profile) && (
                        <span
                          className="font-bold rounded-full px-2.5 py-1"
                          style={{ backgroundColor: 'rgba(240,235,227,0.16)', border: '0.5px solid rgba(240,235,227,0.4)', color: '#F0EBE3', fontSize: 11, letterSpacing: 0.2 }}
                        >
                          TripAlong+
                        </span>
                      )}
                    </div>
                    {(profile.city || profile.country) && (
                      <div className="flex items-center gap-1 mt-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="rgba(255,255,255,0.65)" strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke="rgba(255,255,255,0.65)" strokeWidth="2"/></svg>
                        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Body — flows under the hero now; the whole sheet scrolls
                  as one page instead of pinning the photo in place. ── */}
              <div className="shrink-0">
                <div className="px-6 pt-6 pb-6 flex flex-col gap-7">

                  {/* Bio + Instagram */}
                  {(profile.bio || (profile.instagram_handle && currentUserId)) && (
                    <div>
                      {profile.bio && (
                        <>
                          <p className="text-white font-semibold text-lg mb-3">About</p>
                          <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 15, lineHeight: '26px', ...contentBlur }}>{profile.bio}</p>
                        </>
                      )}
                      {profile.instagram_handle && currentUserId && (
                        <a
                          href={`https://instagram.com/${profile.instagram_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70 transition-opacity"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: profile.bio ? 12 : 0 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
                          @{profile.instagram_handle}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Travel Style */}
                  {travelStyles.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>✨</span>
                        <p className="text-white font-semibold text-lg">Travel Style</p>
                      </div>
                      <div className="flex flex-wrap gap-2" style={contentBlur}>
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
                      <div className="flex flex-wrap gap-2" style={contentBlur}>
                        {profile.gender && <PrefTile title="Gender" value={profile.gender === 'male' ? '👨 Male' : profile.gender === 'female' ? '👩 Female' : '🌟 Other'} />}
                        {profile.travel_with && <PrefTile title="Travels With" value={profile.travel_with === 'everyone' ? '🌍 Everyone' : profile.travel_with === 'female' ? '👩 Women Only' : '👨 Men Only'} />}
                        {label(PERSONALITY_OPT, profile.social_energy) && <PrefTile title="Personality" value={label(PERSONALITY_OPT, profile.social_energy)!} />}
                        {label(PACE_OPTIONS, profile.travel_pace) && <PrefTile title="Daily Pace" value={label(PACE_OPTIONS, profile.travel_pace)!} />}
                        {label(PLANNING_OPT, profile.planning_style) && <PrefTile title="Planning Style" value={label(PLANNING_OPT, profile.planning_style)!} />}
                      </div>
                    </div>
                  )}

                  {/* Experience Level */}
                  {label(EXPERIENCE_OPT, profile.experience_level) && (
                    <div className="flex items-center rounded-2xl px-4 py-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)', ...contentBlur }}>
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
                      <div className="flex flex-wrap gap-2" style={contentBlur}>
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
                      <p className="text-white font-medium text-sm" style={contentBlur}>{languages.join(', ')}</p>
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
                      <div className="flex flex-wrap gap-2" style={contentBlur}>
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
                      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-6 px-6" style={contentBlur}>
                        {savedTrips.map((t: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => getTrip(t.id).then(trip => { if (trip) setSelectedTrip(trip) })}
                            className="relative rounded-2xl overflow-hidden shrink-0 flex items-end active:scale-[0.97] transition-transform"
                            style={{ width: 110, height: 150, backgroundColor: '#111' }}
                          >
                            {t.cover_image && <img src={resizedImage(t.cover_image, 400, 70)} alt={t.destination} className="absolute inset-0 w-full h-full object-cover" />}
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
                ) : !currentUserId ? (
                  <button
                    type="button"
                    onClick={() => { haptic(8); onAuthRequired?.() }}
                    className="w-full font-semibold text-sm rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#F0EBE3', color: '#000', padding: '14px' }}
                  >
                    Sign in to message
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { haptic(10); handleSendMessage() }}
                      disabled={dmLoading || currentUserId === userId}
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
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
