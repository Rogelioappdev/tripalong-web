'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createHangalong, getDestinationPhotos } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import type { ActivityType, WhenLabel } from '@/lib/types'

interface Props {
  onClose: () => void
  onCreated: () => void
}

const ACTIVITIES: { type: ActivityType; emoji: string; label: string }[] = [
  { type: 'hike',      emoji: '🥾', label: 'Hike' },
  { type: 'road_trip', emoji: '🚗', label: 'Road Trip' },
  { type: 'beach',     emoji: '🏖️', label: 'Beach' },
  { type: 'climbing',  emoji: '🧗', label: 'Climbing' },
  { type: 'urban',     emoji: '🌆', label: 'Urban' },
  { type: 'day_trip',  emoji: '🚌', label: 'Day Trip' },
]

const WHEN_OPTIONS: { value: WhenLabel; label: string; sub: string }[] = [
  { value: 'today',        label: 'Today',        sub: 'Happening today' },
  { value: 'tonight',      label: 'Tonight',      sub: 'Evening plans' },
  { value: 'this_weekend', label: 'This Weekend', sub: 'Sat or Sun' },
  { value: 'this_week',    label: 'This Week',    sub: 'Next 7 days' },
]

const SLIDES = [
  {
    icon: '📍',
    title: "You're live on the feed",
    body: "Your hangout is showing to people near you right now. Anyone can tap in and join.",
  },
  {
    icon: '💬',
    title: 'Group chat is ready',
    body: "Everyone who joins lands in your hangout chat. Coordinate details, share your location, and get the vibe going.",
  },
  {
    icon: '🔔',
    title: "You'll know when they join",
    body: "You'll get notified the moment someone joins. Check your group chat in Messages.",
  },
]

export function CreateHangModal({ onClose, onCreated }: Props) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [activity, setActivity] = useState<ActivityType | null>(null)
  const [when, setWhen] = useState<WhenLabel | null>(null)
  const [description, setDescription] = useState('')
  const [maxPeople, setMaxPeople] = useState(4)
  const [coverImage, setCoverImage] = useState('')
  const [coverPhotos, setCoverPhotos] = useState<string[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'form' | 'created' | 'slides'>('form')
  const [slideIdx, setSlideIdx] = useState(0)
  const [chatId, setChatId] = useState<string | null>(null)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    const query = [location.trim(), activity ? ACTIVITIES.find(a => a.type === activity)?.label : ''].filter(Boolean).join(' ')
    if (!query) { setCoverPhotos([]); setCoverImage(''); return }
    fetchTimerRef.current = setTimeout(async () => {
      setPhotosLoading(true)
      try {
        const photos = await getDestinationPhotos(query)
        setCoverPhotos(photos)
        if (photos.length > 0) setCoverImage(prev => prev && photos.includes(prev) ? prev : photos[0])
        else setCoverImage('')
      } finally {
        setPhotosLoading(false)
      }
    }, 500)
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current) }
  }, [location, activity])

  const activityEmoji = ACTIVITIES.find(a => a.type === activity)?.emoji ?? '🌄'
  const isValid = !!(title.trim() && location.trim() && activity && when)

  const handleCreate = async () => {
    if (!isValid) return
    setLoading(true)
    setError('')
    try {
      const result = await createHangalong({
        title: title.trim(),
        description: description.trim() || undefined,
        activity_type: activity!,
        location_name: location.trim(),
        when_label: when!,
        max_people: maxPeople,
        photo_url: coverImage || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['hangalongs'] })
      queryClient.invalidateQueries({ queryKey: ['my-hangalongs'] })
      queryClient.invalidateQueries({ queryKey: ['tripChats'] })
      haptic(18)
      if (result?.chatId) setChatId(result.chatId)
      setPhase('created')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const nextSlide = useCallback(() => {
    haptic(8)
    if (slideIdx < SLIDES.length - 1) {
      setSlideIdx(i => i + 1)
    } else {
      onCreated()
      if (chatId) {
        onClose()
        router.push(`/chat/${chatId}`)
      } else {
        onClose()
      }
    }
  }, [slideIdx, chatId, onClose, onCreated, router])

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
            className="absolute inset-0 z-[90]"
            style={{ backgroundColor: '#050505' }}
          >
            {/* ── Celebration screen ── */}
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
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, opacity: 0.1 }}>
                      {activityEmoji}
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.82) 80%, rgba(0,0,0,0.96) 100%)' }} />

                  {/* Live badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.55, ease: 'easeOut' }}
                    style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 20px)', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, backgroundColor: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '7px 16px', backdropFilter: 'blur(12px)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#30D158', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Hangout is live</span>
                    </div>
                  </motion.div>

                  {/* Title + location */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 28px calc(env(safe-area-inset-bottom) + 36px)' }}>
                    <motion.p
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0, duration: 0.55, ease: 'easeOut' }}
                      style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 500, marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}
                    >
                      {location}
                    </motion.p>
                    <motion.h1
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8, duration: 0.7, type: 'spring', stiffness: 160, damping: 22 }}
                      style={{ color: '#fff', fontSize: 52, fontWeight: 900, letterSpacing: '-2px', lineHeight: 0.95, marginBottom: 20 }}
                    >
                      {title}
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5, duration: 0.6, ease: 'easeOut' }}
                      style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}
                    >
                      Your hangout is live. {activityEmoji}
                    </motion.p>
                  </div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.2, duration: 0.6 }}
                    style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 32px)', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 500, pointerEvents: 'none' }}
                  >
                    Tap anywhere to continue
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── How it works slides ── */}
            <AnimatePresence>
              {phase === 'slides' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex flex-col z-10"
                >
                  {coverImage && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(22px) brightness(0.45) saturate(1.1)', transform: 'scale(1.08)' }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.95) 100%)' }} />

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 'calc(env(safe-area-inset-top) + 52px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)', paddingLeft: 28, paddingRight: 28 }}>
                    {/* Progress dots */}
                    <div className="flex gap-1.5 justify-center mb-10">
                      {SLIDES.map((_, i) => (
                        <div key={i} className="rounded-full transition-all duration-300"
                          style={{ width: i === slideIdx ? 20 : 6, height: 6, backgroundColor: i === slideIdx ? '#fff' : 'rgba(255,255,255,0.2)' }} />
                      ))}
                    </div>

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

                        <button
                          type="button"
                          onClick={nextSlide}
                          className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
                          style={{ background: 'linear-gradient(135deg, #F0EBE3 0%, #ddd4ca 100%)', color: '#000' }}
                        >
                          {slideIdx < SLIDES.length - 1 ? 'Next →' : chatId ? 'Open Group Chat →' : "Let's go →"}
                        </button>
                        {slideIdx < SLIDES.length - 1 && (
                          <button
                            type="button"
                            onClick={() => { haptic(4); onCreated(); onClose() }}
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

      {/* ── Form sheet ── */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        className="relative w-full sm:max-w-lg sm:rounded-3xl flex flex-col overflow-hidden"
        style={{ backgroundColor: '#0d0d0d', borderRadius: '28px 28px 0 0', height: '95dvh' }}
      >
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">

          {/* Hero */}
          <div className="relative shrink-0" style={{ height: 220 }}>
            {coverImage ? (
              <img src={coverImage} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 48 }}>{activityEmoji}</span>
                <p className="text-white/25 text-xs font-medium">Enter a location to load photos</p>
              </div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.88) 100%)' }} />

            {/* Floating header */}
            <div className="absolute top-0 left-0 right-0 flex items-center px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)', paddingBottom: 12 }}>
              <button
                onClick={() => { haptic(8); onClose() }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-white font-bold text-base">Create Hangout</span>
            </div>

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <p className="text-white font-extrabold text-[28px] leading-tight tracking-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
                {title || 'Your hangout...'}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="px-5 pt-6 pb-4 flex flex-col gap-7">

            {/* ACTIVITY */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>Activity</p>
              <div className="grid grid-cols-3 gap-2.5">
                {ACTIVITIES.map(a => (
                  <button
                    key={a.type}
                    onClick={() => { haptic(8); setActivity(a.type) }}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
                    style={activity === a.type
                      ? { backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  >
                    <span style={{ fontSize: 24 }}>{a.emoji}</span>
                    <span className="text-xs font-semibold" style={{ color: activity === a.type ? 'white' : 'rgba(255,255,255,0.45)' }}>
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* TITLE */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>Title</p>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Sunrise hike at Runyon Canyon"
                maxLength={80}
                className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* LOCATION */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>Location</p>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Griffith Park area, LA"
                maxLength={60}
                className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* COVER PHOTO */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>Cover Photo</p>
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
                      style={{ width: 88, height: 60, border: coverImage === photo ? '2.5px solid white' : '2.5px solid transparent' }}
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
                  {location.trim() ? 'No photos found — try a different location' : 'Enter a location above to load photos'}
                </p>
              )}
            </div>

            {/* WHEN */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>When</p>
              <div className="flex flex-col gap-2">
                {WHEN_OPTIONS.map(w => (
                  <button
                    key={w.value}
                    onClick={() => { haptic(8); setWhen(w.value) }}
                    className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                    style={when === w.value
                      ? { backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="text-left">
                      <p className="text-white font-semibold text-sm">{w.label}</p>
                      <p className="text-white/35 text-xs mt-0.5">{w.sub}</p>
                    </div>
                    {when === w.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* GROUP SIZE */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>Group</p>
              <div className="flex items-center rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                <span className="text-white/55 text-sm">Max people</span>
                <div className="flex items-center gap-4 ml-auto">
                  <button onClick={() => { haptic(4); setMaxPeople(p => Math.max(2, p - 1)) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>−</button>
                  <span className="text-white font-bold text-base w-5 text-center">{maxPeople}</span>
                  <button onClick={() => { haptic(4); setMaxPeople(p => Math.min(12, p + 1)) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>+</button>
                </div>
              </div>
            </div>

            {/* DESCRIPTION */}
            <div>
              <p className={label} style={{ marginBottom: 12 }}>
                Description <span className="normal-case text-white/25 tracking-normal font-medium"> — optional</span>
              </p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="What to expect, skill level, what to bring..."
                maxLength={300}
                className="w-full rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none resize-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {error && <p className="text-red-400 text-sm -mt-3">{error}</p>}
            <div style={{ height: 4 }} />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="px-5 pt-4 shrink-0" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          <button
            onClick={() => { haptic(18); handleCreate() }}
            disabled={!isValid || loading}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]"
            style={isValid && !loading
              ? { backgroundColor: 'rgba(255,255,255,0.9)', color: '#0d0d0d' }
              : { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}
          >
            {loading ? 'Posting...' : 'Post Hangout'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
