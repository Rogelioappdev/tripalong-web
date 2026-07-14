'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createProfile, updateProfile } from '@/lib/queries'
import { normalizeImageToJpeg } from '@/lib/image'
import { haptic } from '@/lib/haptics'
import { NotificationPrompt } from '@/components/NotificationPrompt'
import { MIN_PROFILE_PHOTOS } from '@/lib/profileCompleteness'

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.full_name) setName(data.user.user_metadata.full_name)
      else if (data.user?.user_metadata?.name) setName(data.user.user_metadata.name)
    })
  }, [])

  const currentYear = new Date().getFullYear()
  const age = birthYear
    ? currentYear - parseInt(birthYear) - (
        birthMonth && birthDay
          ? new Date(currentYear, parseInt(birthMonth) - 1, parseInt(birthDay)) > new Date() ? 1 : 0
          : 0
      )
    : null
  const ageValid = age !== null && age >= 16

  const handlePhotoUpload = async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Please sign in again.'); return }
      const uploaded: string[] = []
      for (const file of files.slice(0, MIN_PROFILE_PHOTOS + 3 - photos.length)) {
        // Normalize to a web-safe JPEG first (fixes HEIC/odd-format black photos).
        const jpeg = await normalizeImageToJpeg(file)
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
        const { error: uploadError } = await supabase.storage.from('avatars')
          .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        uploaded.push(`${publicUrl}?t=${Date.now()}`)
      }
      setPhotos(prev => [...prev, ...uploaded])
    } catch (e: any) {
      setError(e?.message ?? 'Photo upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (url: string) => setPhotos(prev => prev.filter(p => p !== url))

  const handleComplete = async () => {
    if (photos.length < MIN_PROFILE_PHOTOS) return
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      await createProfile(user.id, user.email ?? '', name.trim(), age!)
      await updateProfile(user.id, { profile_photo: photos[0], photos })
      setUserId(user.id)
      setShowNotificationPrompt(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    // Step 0: Name + Birthday
    <div key="step0" className="flex flex-col gap-6">
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">Step 1 of 2</p>
        <h1 className="text-white font-extrabold text-3xl leading-tight mb-1">
          Almost there.
        </h1>
        <p className="text-white/38 text-sm">Let your travel crew know who's coming.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Your name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What should they call you?"
            className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
            autoFocus
          />
        </div>

        <div>
          <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Birthday</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={birthDay}
              onChange={e => setBirthDay(e.target.value)}
              className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]"
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
              ))}
            </select>
            <select
              value={birthMonth}
              onChange={e => setBirthMonth(e.target.value)}
              className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]"
            >
              <option value="">Month</option>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <select
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]"
            >
              <option value="">Year</option>
              {Array.from({ length: 80 }, (_, i) => currentYear - 16 - i).map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          {birthYear && !ageValid && (
            <p className="text-red-400 text-xs mt-2">Must be 16 or older to use TripAlong</p>
          )}
        </div>
      </div>

      <button
        onClick={() => { haptic(8); setDirection(1); setStep(1) }}
        disabled={!name.trim() || name.trim().length < 2 || !ageValid}
        className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform mt-2"
        style={{ backgroundColor: '#F0EBE3', color: '#000' }}
      >
        Continue →
      </button>
    </div>,

    // Step 1: Photos
    <div key="step1" className="flex flex-col gap-6">
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">Step 2 of 2</p>
        <h1 className="text-white font-extrabold text-3xl leading-tight mb-1">
          Put a face to<br />your adventure.
        </h1>
        <p className="text-white/38 text-sm">
          Add at least {MIN_PROFILE_PHOTOS} photos — profiles with photos get 3× more connections.
        </p>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map(url => (
          <div key={url} className="aspect-[3/4] rounded-2xl overflow-hidden relative">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { haptic(6); removePhoto(url) }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < MIN_PROFILE_PHOTOS + 3 && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="aspect-[3/4] rounded-2xl border-2 border-dashed flex items-center justify-center active:scale-[0.97] transition-transform"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            ) : (
              <span className="text-2xl text-white/35">+</span>
            )}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.currentTarget.value = ''; handlePhotoUpload(fs) }}
      />

      <p className="text-xs text-center" style={{ color: photos.length < MIN_PROFILE_PHOTOS ? '#F0EBE3' : 'rgba(48,209,88,0.8)' }}>
        {photos.length < MIN_PROFILE_PHOTOS
          ? `Add ${MIN_PROFILE_PHOTOS - photos.length} more photo${MIN_PROFILE_PHOTOS - photos.length === 1 ? '' : 's'} to continue (${photos.length}/${MIN_PROFILE_PHOTOS})`
          : `✓ ${photos.length} photos added`}
      </p>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-3 mt-auto">
        <button
          onClick={() => { haptic(10); handleComplete() }}
          disabled={photos.length < MIN_PROFILE_PHOTOS || loading}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          {loading ? 'Setting up...' : "Let's go →"}
        </button>
      </div>
    </div>,
  ]

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div
        className="flex-1 flex flex-col max-w-sm mx-auto w-full px-6 min-h-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 36px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}
      >
        {step > 0 && (
          <button
            onClick={() => { haptic(6); setDirection(-1); setStep(0) }}
            className="text-white/28 text-sm mb-6 self-start active:opacity-60 transition-opacity"
          >
            ← Back
          </button>
        )}

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex flex-col h-full"
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showNotificationPrompt && userId && (
        // Travel DNA (gender, travel style, etc.) is still required before the
        // profile counts as complete — send them there next, not straight to feed.
        <NotificationPrompt userId={userId} onDone={() => router.replace('/travel-dna')} />
      )}
    </main>
  )
}
