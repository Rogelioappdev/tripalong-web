'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createTrip, geocodeDestination, getDestinationPhotos, getTripChat } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { VIBES, SEASONS, GROUP_PREFS } from '@/lib/tripOptions'
import { remindNotifications } from '@/lib/notifReminder'

interface CreateTripModalProps {
  onClose: () => void
  userId: string | null
}

const QUICK_DESTINATIONS = [
  { city: 'Bali', country: 'Indonesia' },
  { city: 'Tokyo', country: 'Japan' },
  { city: 'Barcelona', country: 'Spain' },
  { city: 'Santorini', country: 'Greece' },
  { city: 'Marrakech', country: 'Morocco' },
]

const PACES = [
  { value: 'slow', label: 'Relaxed', emoji: '☕' },
  { value: 'balanced', label: 'Balanced', emoji: '⚖️' },
  { value: 'fast', label: 'Fast-paced', emoji: '⚡' },
]

const BUDGETS = [
  { value: 'budget', label: 'Budget', emoji: '💸' },
  { value: 'moderate', label: 'Moderate', emoji: '💳' },
  { value: 'luxury', label: 'Luxury', emoji: '✨' },
]

export function CreateTripModal({ onClose, userId }: CreateTripModalProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [destination, setDestination] = useState('')
  const [country, setCountry] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverPhotos, setCoverPhotos] = useState<string[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [vibes, setVibes] = useState<string[]>([])
  const [pace, setPace] = useState('')
  const [budget, setBudget] = useState('')
  const [groupPref, setGroupPref] = useState('everyone')
  const [groupSize, setGroupSize] = useState(4)
  const [description, setDescription] = useState('')
  const [season, setSeason] = useState('')
  const [flexDates, setFlexDates] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [anyAge, setAnyAge] = useState(true)
  const [minAge, setMinAge] = useState(16)
  const [maxAge, setMaxAge] = useState(45)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'form' | 'created' | 'slides'>('form')
  const [slideIdx, setSlideIdx] = useState(0)
  const [createdTripId, setCreatedTripId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    const trimmed = destination.trim()
    if (!trimmed) {
      setCoverPhotos([])
      setCoverImage('')
      return
    }
    fetchTimerRef.current = setTimeout(async () => {
      setPhotosLoading(true)
      try {
        const photos = await getDestinationPhotos(trimmed)
        setCoverPhotos(photos)
        if (photos.length > 0) setCoverImage(prev => prev && photos.includes(prev) ? prev : photos[0])
        else setCoverImage('')
      } finally {
        setPhotosLoading(false)
      }
    }, 500)
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current) }
  }, [destination])

  const toggleVibe = (v: string) => {
    setVibes(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : prev.length < 3 ? [...prev, v] : prev
    )
  }

  const isValid = !!(destination.trim() && country.trim() && vibes.length > 0 && pace && budget && (season || flexDates || startDate))

  const handleCreate = async () => {
    if (!userId || !isValid) return
    setLoading(true)
    setError('')
    try {
      const dbGroupPref = groupPref === 'mixed' ? 'everyone' : groupPref
      // Best-effort geocode so the trip shows up on the TripAlong World globe.
      // Never blocks creation — a null result just means it isn't plotted yet.
      const coords = await geocodeDestination(destination.trim(), country.trim())
      const tripId = await createTrip({
        creator_id: userId,
        destination: destination.trim(),
        country: country.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        vibes,
        pace: pace as 'slow' | 'balanced' | 'fast',
        budget_level: budget || null,
        group_preference: dbGroupPref as 'everyone' | 'male' | 'female',
        max_group_size: groupSize,
        description: description.trim() || null,
        is_flexible_dates: flexDates || !!season,
        start_date: season ? null : startDate || null,
        end_date: season ? null : endDate || null,
        age_min: anyAge ? null : minAge,
        age_max: anyAge ? null : maxAge,
        status: 'planning',
        title: destination.trim(),
        images: [],
        cover_image: coverImage,
      })
      track('trip_created', { destination: destination.trim(), vibes_count: vibes.length })
      remindNotifications('create-trip')
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      haptic(18)
      setCreatedTripId(tripId)
      setPhase('created')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const SLIDES = [
    {
      icon: '✈️',
      title: "You're live on the feed",
      body: "Your trip is showing to travelers right now. The right co-traveler could swipe right any minute.",
    },
    {
      icon: '🔔',
      title: 'Travelers join instantly',
      body: "When someone vibes with your trip, they join automatically. You'll get a notification and they'll show up in your group chat ready to start planning.",
    },
    {
      icon: '🔗',
      title: 'Share your trip link',
      body: 'Invite specific people by sharing your trip link. Anyone with the link can see your trip and join.',
    },
  ]

  const nextSlide = useCallback(() => {
    haptic(8)
    if (slideIdx < SLIDES.length - 1) {
      setSlideIdx(i => i + 1)
    } else {
      onClose()
      // Open the trip's actual group chat (the creator is auto-joined in
      // createTrip). Fall back to the trip page if the chat lookup hiccups.
      if (createdTripId) {
        getTripChat(createdTripId)
          .then(chat => router.push(`/chat/${chat.id}`))
          .catch(() => router.push(`/trip/${createdTripId}`))
      }
    }
  }, [slideIdx, SLIDES.length, onClose, createdTripId, router])

  const label = 'text-white/50 text-[11px] font-bold uppercase tracking-widest'

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={phase === 'form' ? onClose : undefined} />

      {/* ── Post-creation overlay ── */}
      <AnimatePresence>
      {phase !== 'form' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28 }}
          className="absolute inset-0 z-[90]" style={{ backgroundColor: '#050505' }}>

      {/* ── Created celebration ── */}
      <AnimatePresence>
        {phase === 'created' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-10 overflow-hidden cursor-pointer"
            onClick={() => { haptic(8); setPhase('slides') }}
          >
            {/* Cover photo — sharp, full bleed, Ken Burns zoom */}
            {coverImage ? (
              <motion.div
                initial={{ scale: 1.08 }}
                animate={{ scale: 1.0 }}
                transition={{ duration: 5.5, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${coverImage})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#111' }} />
            )}

            {/* Vignette — dark top for badge, very dark bottom for destination text */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.82) 80%, rgba(0,0,0,0.96) 100%)',
            }} />

            {/* ✓ Trip confirmed badge — top center */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.55, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: 'calc(env(safe-area-inset-top) + 20px)',
                left: 0, right: 0,
                display: 'flex', justifyContent: 'center',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                backgroundColor: 'rgba(0,0,0,0.45)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 999, padding: '7px 16px',
                backdropFilter: 'blur(12px)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#30D158', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>Trip confirmed</span>
              </div>
            </motion.div>

            {/* Destination — bottom, editorial large type. Extra bottom padding
                keeps "Your trip is live" clear of the "Tap anywhere to continue"
                hint below (they used to overlap on the same line). */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 28px calc(env(safe-area-inset-bottom) + 84px)',
            }}>
              {/* Country */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.55, ease: 'easeOut' }}
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 500, marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                {country}
              </motion.p>

              {/* Destination — the hero */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.7, type: 'spring', stiffness: 160, damping: 22 }}
                style={{
                  color: '#ffffff',
                  fontSize: 64,
                  fontWeight: 900,
                  letterSpacing: '-3px',
                  lineHeight: 0.95,
                  marginBottom: 20,
                }}
              >
                {destination}
              </motion.h1>

              {/* "is waiting for you." tagline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.6, ease: 'easeOut' }}
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: 400, letterSpacing: '-0.2px' }}
              >
                Your trip is live. ✈️
              </motion.p>
            </div>

            {/* Tap to continue hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: 'calc(env(safe-area-inset-bottom) + 32px)',
                left: 0, right: 0,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.25)',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '0.02em',
                pointerEvents: 'none',
              }}
            >
              Tap anywhere to continue
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Onboarding slides ── */}
      <AnimatePresence>
        {phase === 'slides' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col z-10"
          >
            {/* Blurred photo background for slides */}
            {coverImage && (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${coverImage})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'blur(22px) brightness(0.45) saturate(1.1)',
                transform: 'scale(1.08)',
              }} />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.95) 100%)',
            }} />

            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', flexDirection: 'column', flex: 1,
              paddingTop: 'calc(env(safe-area-inset-top) + 52px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)',
              paddingLeft: 28, paddingRight: 28,
            }}>
            {/* Progress dots */}
            <div className="flex gap-1.5 justify-center mb-10">
              {SLIDES.map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{
                    width: i === slideIdx ? 20 : 6, height: 6,
                    backgroundColor: i === slideIdx ? '#fff' : 'rgba(255,255,255,0.2)',
                  }} />
              ))}
            </div>

            {/* Slide content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={slideIdx}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                className="flex flex-col flex-1"
              >
                <div className="flex-1 flex flex-col justify-center">
                  <p style={{ fontSize: 52, marginBottom: 24 }}>{SLIDES[slideIdx].icon}</p>
                  <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.7px', lineHeight: 1.15, marginBottom: 14 }}>
                    {SLIDES[slideIdx].title}
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1.6 }}>
                    {SLIDES[slideIdx].body}
                  </p>
                </div>

                {/* Share button on last slide */}
                {slideIdx === SLIDES.length - 1 && createdTripId && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic(8)
                      const url = `${window.location.origin}/trip/${createdTripId}`
                      if (navigator.share) {
                        navigator.share({ title: `Join my trip to ${destination}`, url })
                      } else {
                        navigator.clipboard.writeText(url)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }
                    }}
                    className="w-full py-4 rounded-2xl font-semibold text-base active:scale-[0.98] transition-transform mb-3"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    {copied ? 'Link copied ✓' : 'Share trip link'}
                  </button>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={nextSlide}
                  className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
                >
                  {slideIdx < SLIDES.length - 1 ? 'Next →' : 'Open Group Chat →'}
                </button>
                {slideIdx < SLIDES.length - 1 && (
                  <button
                    type="button"
                    onClick={() => { haptic(4); onClose() }}
                    className="py-3 text-center active:opacity-60 transition-opacity"
                    style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}
                  >
                    Skip
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </motion.div>
      )}
      </AnimatePresence>

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        className="relative w-full sm:max-w-lg sm:rounded-3xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#0d0d0d',
          borderRadius: '28px 28px 0 0',
          height: '95dvh',
        }}
      >
        {/* Scrollable content — min-h-0 required so flex-1 actually bounds within the container */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">

          {/* Hero cover photo — header is overlaid on top */}
          <div className="relative shrink-0" style={{ height: '220px' }}>
            {coverImage ? (
              <img src={coverImage} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-4xl">🌍</span>
                <p className="text-white/25 text-xs font-medium">Type a destination to load photos</p>
              </div>
            )}
            {/* gradient: dark top for header, dark bottom for text */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.88) 100%)' }}
            />

            {/* Floating header */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center px-4"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)', paddingBottom: '12px' }}
            >
              <button
                onClick={() => { haptic(8); onClose() }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-white font-bold text-base">
                Create Trip
              </span>
            </div>

            {/* Destination name overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <p
                className="text-white font-extrabold text-[28px] leading-tight tracking-tight"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}
              >
                {destination || 'Your destination...'}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="px-5 pt-6 pb-4 flex flex-col gap-7">

            {/* DESTINATION */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Destination</p>
              <div className="flex flex-col gap-2 mb-3">
                <input
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="City or destination"
                  className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                />
                <input
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="Country"
                  className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {QUICK_DESTINATIONS.map(d => (
                  <button
                    key={d.city}
                    onClick={() => { haptic(8); setDestination(d.city); setCountry(d.country) }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', border: '0.5px solid rgba(255,255,255,0.12)' }}
                  >
                    {d.city}
                  </button>
                ))}
              </div>
            </div>

            {/* COVER PHOTO */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Cover Photo</p>
              {photosLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  <span className="text-white/35 text-xs">Loading photos...</span>
                </div>
              ) : coverPhotos.length > 0 ? (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {coverPhotos.map((photo, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCoverImage(photo)}
                      className="relative rounded-2xl overflow-hidden shrink-0 active:scale-95 transition-transform"
                      style={{
                        width: '88px',
                        height: '60px',
                        border: coverImage === photo ? '2.5px solid white' : '2.5px solid transparent',
                      }}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      {coverImage === photo && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-white/25 text-xs py-2">
                  {destination.trim() ? 'No photos found for this destination' : 'Enter a destination above to see photos'}
                </p>
              )}
            </div>

            {/* DATES */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Dates</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {SEASONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { haptic(8); setSeason(s === season ? '' : s); setFlexDates(false) }}
                    className="px-3.5 py-2 rounded-full text-xs font-semibold transition-colors"
                    style={season === s
                      ? { backgroundColor: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.28)' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {!season && !flexDates && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wide mb-1.5">Start Date</p>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full rounded-2xl px-3.5 py-3 text-white/70 text-sm outline-none [color-scheme:dark]"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wide mb-1.5">End Date</p>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full rounded-2xl px-3.5 py-3 text-white/70 text-sm outline-none [color-scheme:dark]"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => { haptic(8); setFlexDates(!flexDates); setSeason('') }}
                className="flex items-center gap-2.5 active:opacity-80 transition-opacity"
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                  style={flexDates
                    ? { backgroundColor: 'rgba(255,255,255,0.9)' }
                    : { backgroundColor: 'transparent', border: '1.5px solid rgba(255,255,255,0.3)' }}
                >
                  {flexDates && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-white/55 text-sm">Dates are flexible / TBD</span>
              </button>
            </div>

            {/* VIBES */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className={label}>Vibes</p>
                <span className="text-white/30 text-xs font-semibold">{vibes.length}/3</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {VIBES.map(v => {
                  const selected = vibes.includes(v.value)
                  const maxed = vibes.length >= 3 && !selected
                  return (
                    <button
                      key={v.value}
                      onClick={() => { haptic(8); toggleVibe(v.value) }}
                      disabled={maxed}
                      className="px-3 py-2 rounded-full text-sm font-medium transition-colors"
                      style={selected
                        ? { backgroundColor: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.28)' }
                        : maxed
                        ? { backgroundColor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.18)', border: '0.5px solid rgba(255,255,255,0.06)' }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                    >
                      {v.emoji} {v.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* DAILY PACE */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Daily Pace</p>
              <div className="grid grid-cols-3 gap-2">
                {PACES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => { haptic(8); setPace(p.value) }}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-colors active:scale-95"
                    style={pace === p.value
                      ? { backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-[22px]">{p.emoji}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: pace === p.value ? 'white' : 'rgba(255,255,255,0.45)' }}
                    >
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* GROUP */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Group</p>
              <div
                className="flex items-center mb-3 rounded-2xl px-4 py-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-white/55 text-sm">Max travelers</span>
                <div className="flex items-center gap-4 ml-auto">
                  <button
                    onClick={() => { haptic(4); setGroupSize(s => Math.max(2, s - 1)) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  >−</button>
                  <span className="text-white font-bold text-base w-5 text-center">{groupSize}</span>
                  <button
                    onClick={() => { haptic(4); setGroupSize(s => Math.min(20, s + 1)) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  >+</button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {GROUP_PREFS.map(g => (
                  <button
                    key={g.value + g.label}
                    onClick={() => { haptic(8); setGroupPref(g.value === 'everyone' && g.label === 'Mixed' ? 'mixed' : g.value) }}
                    className="px-3 py-2 rounded-full text-xs font-semibold transition-colors active:scale-95"
                    style={(() => {
                      const active =
                        (g.label === 'Mixed' && groupPref === 'mixed') ||
                        (g.label !== 'Mixed' && groupPref === g.value && groupPref !== 'mixed')
                      return active
                        ? { backgroundColor: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.28)' }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.1)' }
                    })()}
                  >
                    {g.emoji} {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AGE PREFERENCE */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Age Preference</p>
              {/* Any age toggle */}
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3 mb-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
              >
                <div>
                  <p className="text-white/70 text-sm font-medium">Any age</p>
                  <p className="text-white/30 text-xs mt-0.5">Open to all travelers</p>
                </div>
                <button
                  type="button"
                  onClick={() => { haptic(8); setAnyAge(a => !a) }}
                  className="relative transition-colors shrink-0"
                  style={{
                    width: '44px', height: '26px', borderRadius: '13px',
                    backgroundColor: anyAge ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)',
                  }}
                >
                  <div
                    className="absolute top-[3px] transition-all rounded-full"
                    style={{
                      width: '20px', height: '20px',
                      left: anyAge ? 'calc(100% - 23px)' : '3px',
                      backgroundColor: anyAge ? '#111' : 'rgba(255,255,255,0.5)',
                    }}
                  />
                </button>
              </div>

              {/* Age range picker — visible when anyAge is off */}
              {!anyAge && (
                <div
                  className="rounded-2xl px-4 py-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-3">
                    {/* Min age */}
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest">Min age</p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { haptic(4); setMinAge(v => Math.max(16, v - 1)) }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >−</button>
                        <span className="text-white font-bold text-xl w-8 text-center">{minAge}</span>
                        <button
                          type="button"
                          onClick={() => { haptic(4); setMinAge(v => Math.min(maxAge - 1, v + 1)) }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >+</button>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="text-white/20 font-light text-xl pb-1">–</div>

                    {/* Max age */}
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest">Max age</p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { haptic(4); setMaxAge(v => Math.max(minAge + 1, v - 1)) }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >−</button>
                        <span className="text-white font-bold text-xl w-8 text-center">{maxAge}</span>
                        <button
                          type="button"
                          onClick={() => { haptic(4); setMaxAge(v => Math.min(65, v + 1)) }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >+</button>
                      </div>
                    </div>
                  </div>

                  <p className="text-white/25 text-[11px] text-center mt-3">
                    Looking for travelers aged {minAge}–{maxAge}
                  </p>
                </div>
              )}
            </div>

            {/* BUDGET */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>Budget</p>
              <div className="grid grid-cols-3 gap-2">
                {BUDGETS.map(b => (
                  <button
                    key={b.value}
                    onClick={() => { haptic(8); setBudget(b.value) }}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-colors active:scale-95"
                    style={budget === b.value
                      ? { backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-[22px]">{b.emoji}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: budget === b.value ? 'white' : 'rgba(255,255,255,0.45)' }}
                    >
                      {b.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* DESCRIPTION */}
            <div>
              <p className={label} style={{ marginBottom: '12px' }}>
                Description <span className="normal-case text-white/25 tracking-normal font-medium"> — optional</span>
              </p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Tell travelers what makes this trip special..."
                className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none resize-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {error && <p className="text-red-400 text-sm -mt-3">{error}</p>}

            {/* bottom padding for footer */}
            <div style={{ height: '4px' }} />
          </div>
        </div>

        {/* Sticky footer */}
        <div
          className="px-5 pb-6 pt-4 shrink-0"
          style={{
            borderTop: '0.5px solid rgba(255,255,255,0.07)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          }}
        >
          <button
            onClick={() => { haptic(18); handleCreate() }}
            disabled={!isValid || loading || !userId}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]"
            style={isValid && !loading
              ? { backgroundColor: 'rgba(255,255,255,0.9)', color: '#0d0d0d' }
              : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}
          >
            {loading ? 'Creating...' : 'Create Trip'}
          </button>
        </div>


      </motion.div>
    </div>
  )
}
