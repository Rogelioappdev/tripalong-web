'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createProfile, updateProfile } from '@/lib/queries'
import { normalizeImageToJpeg } from '@/lib/image'
import { haptic } from '@/lib/haptics'
import { NotificationPrompt } from '@/components/NotificationPrompt'
import { SEASONS } from '@/lib/tripOptions'
import { TripPreviewCard } from '@/components/onboarding/TripPreviewCard'
import { WorldRouteMap } from '@/components/onboarding/WorldRouteMap'
import { TravelDnaStep } from '@/components/onboarding/TravelDnaStep'
import { DNA_DIMENSIONS, EMPTY_DNA, type NewDnaData } from '@/components/onboarding/dnaOptions'

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

const fadeUpVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 30 } },
}

const CTA_STYLE = { backgroundColor: '#F0EBE3', color: '#000' } as const

function QuizContinueButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-auto w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform"
      style={CTA_STYLE}
    >
      {label}
    </button>
  )
}

// Set only by Settings' "Test Onboarding" row (member-code-gated, not reachable
// by a real signup) so this account can preview whatever onboarding is being
// designed, live in the real /onboarding route, without it ever showing to
// an actual new user. Placeholder for now — swap the early-return body below
// for the in-progress design as it's built.
const TEST_MODE_KEY = 'ta_onboarding_test_mode'

export default function OnboardingPage() {
  const router = useRouter()
  const [testMode] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem(TEST_MODE_KEY) === '1')
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── New onboarding prototype (test-mode only) state ──
  // All local — nothing here is persisted to Supabase. See testMode branch below.
  const [newStage, setNewStage] = useState<'welcome' | 'valueprop' | 'quiz' | 'finale'>('welcome')
  const [newDirection, setNewDirection] = useState(1)
  const [quizStep, setQuizStep] = useState(0)
  const [dnaIndex, setDnaIndex] = useState(0)
  const [newName, setNewName] = useState('')
  const [newBirthDay, setNewBirthDay] = useState('')
  const [newBirthMonth, setNewBirthMonth] = useState('')
  const [newBirthYear, setNewBirthYear] = useState('')
  const [newGender, setNewGender] = useState<'' | 'male' | 'female' | 'other'>('')
  const [newCountry, setNewCountry] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newTripDestination, setNewTripDestination] = useState('')
  const [newTripWhen, setNewTripWhen] = useState('')
  const [newBio, setNewBio] = useState('')
  const [newInstagram, setNewInstagram] = useState('')
  const [newDna, setNewDna] = useState<NewDnaData>(EMPTY_DNA)
  const finaleControls = useAnimation()

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

  const newAge = newBirthYear
    ? currentYear - parseInt(newBirthYear) - (
        newBirthMonth && newBirthDay
          ? new Date(currentYear, parseInt(newBirthMonth) - 1, parseInt(newBirthDay)) > new Date() ? 1 : 0
          : 0
      )
    : null
  const newAgeValid = newAge !== null && newAge >= 16

  const QUIZ_TOTAL_UNITS = 3 + DNA_DIMENSIONS.length
  const quizUnitIndex = quizStep < 3 ? quizStep : 3 + dnaIndex
  const quizProgressPct = ((quizUnitIndex + 1) / QUIZ_TOTAL_UNITS) * 100

  const goStage = (stage: typeof newStage, dir: number) => { setNewDirection(dir); setNewStage(stage) }

  const quizNext = () => {
    haptic(8)
    if (quizStep < 2) { setNewDirection(1); setQuizStep(s => s + 1); return }
    if (quizStep === 2) { setNewDirection(1); setQuizStep(3); setDnaIndex(0); return }
    if (dnaIndex < DNA_DIMENSIONS.length - 1) { setNewDirection(1); setDnaIndex(d => d + 1); return }
    goStage('finale', 1)
  }

  const quizBack = () => {
    haptic(6)
    if (quizStep === 3 && dnaIndex > 0) { setNewDirection(-1); setDnaIndex(d => d - 1); return }
    if (quizStep === 0) { goStage('valueprop', -1); return }
    setNewDirection(-1)
    setQuizStep(s => s - 1)
  }

  const canQuizContinue = () => {
    if (quizStep === 0) return newName.trim().length >= 2 && newAgeValid && !!newGender
    if (quizStep === 1) return newCountry.trim().length > 0 && newCity.trim().length > 0
    if (quizStep === 2) return true
    const dim = DNA_DIMENSIONS[dnaIndex]
    const v = newDna[dim.key]
    return Array.isArray(v) ? v.length > 0 : v !== ''
  }

  const toggleDna = (key: keyof NewDnaData, value: string, multi: boolean) => {
    setNewDna(prev => {
      if (multi) {
        const arr = prev[key] as string[]
        return { ...prev, [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
      }
      return { ...prev, [key]: value }
    })
  }

  const enterFeed = async () => {
    haptic(10)
    await finaleControls.start({ scale: 1.5, opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } })
    sessionStorage.removeItem(TEST_MODE_KEY)
    router.push('/feed')
  }

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Please sign in again.'); return }
      // Normalize to a web-safe JPEG first (fixes HEIC/odd-format black photos).
      const jpeg = await normalizeImageToJpeg(file)
      const path = `${user.id}/profile.jpg`
      const { error: uploadError } = await supabase.storage.from('avatars')
        .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust so the new upload replaces any cached image at the same path.
      setPhotoUrl(`${publicUrl}?t=${Date.now()}`)
    } catch (e: any) {
      setError(e?.message ?? 'Photo upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleComplete = async (skipPhoto = false) => {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      await createProfile(user.id, user.email ?? '', name.trim(), age!)
      if (!skipPhoto && photoUrl) {
        await updateProfile(user.id, { profile_photo: photoUrl })
      }
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

    // Step 1: Photo
    <div key="step1" className="flex flex-col gap-6">
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">Step 2 of 2</p>
        <h1 className="text-white font-extrabold text-3xl leading-tight mb-1">
          Put a face to<br />your adventure.
        </h1>
        <p className="text-white/38 text-sm">Profiles with photos get 3× more connections.</p>
      </div>

      {/* Photo picker */}
      <button
        onClick={() => fileRef.current?.click()}
        className="mx-auto w-44 aspect-[3/4] rounded-3xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center gap-3 relative active:scale-[0.97] transition-transform"
        style={{ borderColor: photoUrl ? 'rgba(240,235,227,0.4)' : 'rgba(255,255,255,0.15)' }}
      >
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#30D158' }}>✓</div>
          </>
        ) : uploading ? (
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        ) : (
          <>
            <span className="text-3xl">📷</span>
            <span className="text-white/35 text-sm">Add your photo</span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
      />

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-3 mt-auto">
        <button
          onClick={() => { haptic(10); handleComplete(false) }}
          disabled={!photoUrl || loading}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          {loading ? 'Setting up...' : "Let's go →"}
        </button>
        <button
          onClick={() => { haptic(4); handleComplete(true) }}
          disabled={loading}
          className="w-full py-3 text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Skip for now
        </button>
      </div>
    </div>,
  ]

  if (testMode) {
    const dim = DNA_DIMENSIONS[dnaIndex]
    const quizKey = `quiz-${quizStep}-${dnaIndex}`

    return (
      <main className="bg-black flex flex-col overflow-hidden" style={{ minHeight: '100dvh' }}>
        <div
          className="flex-1 flex flex-col max-w-sm mx-auto w-full px-6 min-h-0"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 36px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
          }}
        >
          {newStage === 'quiz' && (
            <div className="shrink-0">
              <div className="flex items-center justify-between mb-5">
                <button onClick={quizBack} className="text-white/28 text-sm active:opacity-60 transition-opacity">← Back</button>
                <span className="text-white/25 text-xs font-medium">
                  {quizStep < 3 ? `Step ${quizStep + 1} of 4` : `Travel DNA · ${dnaIndex + 1} of ${DNA_DIMENSIONS.length}`}
                </span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full mb-7 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: '#F0EBE3' }}
                  animate={{ width: `${quizProgressPct}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0">
            <AnimatePresence custom={newDirection} mode="wait">
              {newStage === 'welcome' && (
                <motion.div
                  key="welcome"
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="flex flex-col h-full relative"
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 38%, rgba(240,235,227,0.09), transparent 55%)' }}
                  />
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } } }}
                    >
                      <motion.p variants={fadeUpVariants} className="text-white/30 text-xs font-semibold uppercase tracking-[0.22em] mb-5">
                        Welcome to
                      </motion.p>
                      <motion.h1 variants={fadeUpVariants} className="text-white font-extrabold text-5xl tracking-tight mb-5">
                        TripAlong
                      </motion.h1>
                      <motion.p variants={fadeUpVariants} className="text-white/40 text-base leading-relaxed max-w-[260px] mx-auto">
                        Find your people.<br />See the world together.
                      </motion.p>
                    </motion.div>
                  </div>
                  <motion.div
                    className="mt-auto"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65, type: 'spring', stiffness: 300, damping: 28 }}
                  >
                    <button
                      onClick={() => { haptic(8); goStage('valueprop', 1) }}
                      className="w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
                      style={CTA_STYLE}
                    >
                      Get started
                    </button>
                  </motion.div>
                </motion.div>
              )}

              {newStage === 'valueprop' && (
                <motion.div
                  key="valueprop"
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="flex flex-col h-full gap-6"
                >
                  <div>
                    <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-2">The idea</p>
                    <h1 className="text-white font-extrabold text-3xl leading-tight mb-2">A new way of<br />traveling.</h1>
                    <p className="text-white/38 text-sm leading-relaxed">
                      Real trips, real people. Swipe right on a trip, join the group chat, and start planning with people who match your vibe.
                    </p>
                  </div>
                  <div className="flex-1 flex items-center justify-center py-2 min-h-0">
                    <TripPreviewCard />
                  </div>
                  <button
                    onClick={() => { haptic(8); goStage('quiz', 1) }}
                    className="mt-auto w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
                    style={CTA_STYLE}
                  >
                    Continue →
                  </button>
                </motion.div>
              )}

              {newStage === 'quiz' && quizStep === 0 && (
                <motion.div
                  key={quizKey}
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="flex flex-col h-full"
                >
                  <div>
                    <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Let's build your profile.</h1>
                    <p className="text-white/38 text-sm">This is what other travelers will see.</p>
                  </div>

                  <div className="flex flex-col gap-4 mt-6">
                    <div>
                      <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Your name</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="What should they call you?"
                        className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Birthday</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={newBirthDay}
                          onChange={e => setNewBirthDay(e.target.value)}
                          className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                          ))}
                        </select>
                        <select
                          value={newBirthMonth}
                          onChange={e => setNewBirthMonth(e.target.value)}
                          className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]"
                        >
                          <option value="">Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={i} value={String(i + 1)}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={newBirthYear}
                          onChange={e => setNewBirthYear(e.target.value)}
                          className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 80 }, (_, i) => currentYear - 16 - i).map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                      {newBirthYear && !newAgeValid && (
                        <p className="text-red-400 text-xs mt-2">Must be 16 or older to use TripAlong</p>
                      )}
                    </div>

                    <div>
                      <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Gender</label>
                      <div className="flex gap-2">
                        {([
                          { v: 'male' as const, e: '👨', l: 'Male' },
                          { v: 'female' as const, e: '👩', l: 'Female' },
                          { v: 'other' as const, e: '🌟', l: 'Other' },
                        ]).map(g => (
                          <button
                            key={g.v}
                            onClick={() => { haptic(8); setNewGender(g.v) }}
                            className="flex-1 py-3 rounded-2xl text-sm font-semibold border transition-colors"
                            style={newGender === g.v
                              ? { backgroundColor: '#F0EBE3', color: '#000', borderColor: 'transparent' }
                              : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.12)' }}
                          >
                            {g.e} {g.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <QuizContinueButton onClick={quizNext} disabled={!canQuizContinue()} label="Continue →" />
                </motion.div>
              )}

              {newStage === 'quiz' && quizStep === 1 && (
                <motion.div
                  key={quizKey}
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="flex flex-col h-full"
                >
                  <div>
                    <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Where are you based?</h1>
                    <p className="text-white/38 text-sm">Helps travelers nearby find you.</p>
                  </div>

                  <div className="flex flex-col gap-3 mt-6">
                    <input
                      value={newCountry}
                      onChange={e => setNewCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                      autoFocus
                    />
                    <input
                      value={newCity}
                      onChange={e => setNewCity(e.target.value)}
                      placeholder="City"
                      className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                    />
                  </div>

                  <div className="mt-8">
                    <h2 className="text-white font-bold text-lg mb-1">Got a trip coming up?</h2>
                    <p className="text-white/30 text-xs mb-4">Totally optional — you can always add this later.</p>
                    <input
                      value={newTripDestination}
                      onChange={e => setNewTripDestination(e.target.value)}
                      placeholder="Where to?"
                      className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30 mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                      {SEASONS.slice(0, 4).map(s => (
                        <button
                          key={s}
                          onClick={() => { haptic(8); setNewTripWhen(w => w === s ? '' : s) }}
                          className="px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors"
                          style={newTripWhen === s
                            ? { backgroundColor: '#F0EBE3', color: '#000', borderColor: 'transparent' }
                            : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.12)' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <QuizContinueButton onClick={quizNext} disabled={!canQuizContinue()} label="Continue →" />
                </motion.div>
              )}

              {newStage === 'quiz' && quizStep === 2 && (
                <motion.div
                  key={quizKey}
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="flex flex-col h-full"
                >
                  <div>
                    <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Tell your story.</h1>
                    <p className="text-white/38 text-sm">A few words go a long way.</p>
                  </div>

                  <div className="flex flex-col gap-4 mt-6">
                    <div>
                      <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Bio</label>
                      <textarea
                        value={newBio}
                        onChange={e => setNewBio(e.target.value)}
                        placeholder="What's your travel style? What are you looking for?"
                        rows={4}
                        className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30 resize-none"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Instagram</label>
                      <div className="flex items-center gap-2 bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 focus-within:border-white/30">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                          <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
                        </svg>
                        <span className="text-white/35 text-sm select-none">@</span>
                        <input
                          value={newInstagram}
                          onChange={e => setNewInstagram(e.target.value.replace(/^@/, ''))}
                          placeholder="your_username"
                          className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/20"
                        />
                      </div>
                    </div>
                  </div>

                  <QuizContinueButton onClick={quizNext} label="Continue →" />
                </motion.div>
              )}

              {newStage === 'quiz' && quizStep === 3 && (
                <motion.div
                  key={quizKey}
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="flex flex-col h-full"
                >
                  <TravelDnaStep
                    dimension={dim}
                    value={newDna[dim.key]}
                    onToggle={v => toggleDna(dim.key, v, dim.multi)}
                  />
                  <QuizContinueButton
                    onClick={quizNext}
                    disabled={!canQuizContinue()}
                    label={dnaIndex === DNA_DIMENSIONS.length - 1 ? 'Finish →' : 'Next →'}
                  />
                </motion.div>
              )}

              {newStage === 'finale' && (
                <motion.div
                  key="finale"
                  custom={newDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex flex-col h-full items-center text-center"
                >
                  <motion.div animate={finaleControls} className="w-full flex-1 flex flex-col items-center justify-center">
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-white/30 text-xs font-semibold uppercase tracking-[0.22em] mb-2"
                    >
                      Welcome to
                    </motion.p>
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="text-white font-extrabold text-3xl tracking-tight mb-6"
                    >
                      TripAlong
                    </motion.h1>
                    <WorldRouteMap />
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 2.2 }}
                      className="text-white/40 text-sm leading-relaxed max-w-[260px] mx-auto mt-6"
                    >
                      A world of trips is waiting for you{newName.trim() ? `, ${newName.trim()}` : ''}.
                    </motion.p>
                  </motion.div>
                  <motion.button
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.7, type: 'spring', stiffness: 300, damping: 28 }}
                    onClick={enterFeed}
                    className="mt-auto w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
                    style={CTA_STYLE}
                  >
                    Enter TripAlong →
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    )
  }

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
        <NotificationPrompt userId={userId} onDone={() => router.replace('/feed')} />
      )}
    </main>
  )
}
