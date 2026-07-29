'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createProfile, updateProfile } from '@/lib/queries'
import { normalizeImageToJpeg } from '@/lib/image'
import { haptic } from '@/lib/haptics'
import { SEASONS } from '@/lib/tripOptions'
import { TripPreviewCard } from '@/components/onboarding/TripPreviewCard'
import { WorldRouteMap } from '@/components/onboarding/WorldRouteMap'
import { TravelDnaStep } from '@/components/onboarding/TravelDnaStep'
import { DNA_DIMENSIONS, EMPTY_DNA, type NewDnaData } from '@/components/onboarding/dnaOptions'
import type { UserProfile } from '@/lib/types'

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

export default function OnboardingPage() {
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [newStage, setNewStage] = useState<'auth' | 'welcome' | 'valueprop' | 'quiz' | 'finale'>('auth')
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
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const finaleControls = useAnimation()

  const isSigninIntent = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'signin'
  const [authShowEmail, setAuthShowEmail] = useState(isSigninIntent)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>(() => isSigninIntent() ? 'signin' : 'signup')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Tiny, unlabeled escape hatch (same access code as Settings' hidden member
  // area) so the flow can be previewed end-to-end without a real account —
  // skips straight past auth into the rest of onboarding. memberPreview also
  // tells finishQuiz to skip the real Supabase writes, since there's no
  // signed-in user to attach them to.
  const [showMemberCode, setShowMemberCode] = useState(false)
  const [memberCode, setMemberCode] = useState('')
  const [memberCodeError, setMemberCodeError] = useState(false)
  const [memberPreview, setMemberPreview] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        if (data.user.user_metadata?.full_name) setNewName(data.user.user_metadata.full_name)
        else if (data.user.user_metadata?.name) setNewName(data.user.user_metadata.name)
        setNewStage('welcome')
      }
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    ;(window as any).__tripalongGoogleSignInResult = async (result: { success: boolean }) => {
      if (!result.success) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: row } = await supabase.from('users').select('age').eq('id', user.id).single()
      if (!row || row.age === null) setNewStage('welcome')
      else router.push('/feed')
    }
    return () => { delete (window as any).__tripalongGoogleSignInResult }
  }, [router])

  const currentYear = new Date().getFullYear()
  const newAge = newBirthYear
    ? currentYear - parseInt(newBirthYear) - (
        newBirthMonth && newBirthDay
          ? new Date(currentYear, parseInt(newBirthMonth) - 1, parseInt(newBirthDay)) > new Date() ? 1 : 0
          : 0
      )
    : null
  const newAgeValid = newAge !== null && newAge >= 16

  const QUIZ_TOTAL_UNITS = 4 + DNA_DIMENSIONS.length
  const quizUnitIndex = quizStep < 4 ? quizStep : 4 + dnaIndex
  const quizProgressPct = ((quizUnitIndex + 1) / QUIZ_TOTAL_UNITS) * 100

  const goStage = (stage: typeof newStage, dir: number) => { setNewDirection(dir); setNewStage(stage) }

  const handleAuthGoogle = () => {
    haptic(8)
    if ((window as any).ReactNativeWebView) {
      ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'google_signin' }))
      return
    }
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleAuthEmailSubmit = async () => {
    if (!authEmail || !authPassword) return
    setAuthError('')
    setAuthLoading(true)
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
        if (error) throw error
        goStage('welcome', 1)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) throw error
        router.push('/feed')
      }
    } catch (e: any) {
      setAuthError(e.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleMemberCodeSubmit = () => {
    if (memberCode.trim().toLowerCase() === 'gertrudis') {
      haptic(10)
      setMemberPreview(true)
      goStage('welcome', 1)
    } else {
      haptic([8, 20, 8])
      setMemberCodeError(true)
    }
  }

  const finishQuiz = async () => {
    setFinalizing(true)
    setLoading(true)
    setError('')
    if (memberPreview) {
      goStage('finale', 1)
      setLoading(false)
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in again.')
      await createProfile(user.id, user.email ?? '', newName.trim(), newAge!)
      await updateProfile(user.id, {
        gender: (newGender || null) as UserProfile['gender'],
        country: newCountry.trim(),
        city: newCity.trim(),
        bio: newBio.trim() || null,
        instagram_handle: newInstagram.trim() || null,
        profile_photo: photoUrl || undefined,
        travel_styles: newDna.travel_styles,
        travel_pace: (newDna.travel_pace || null) as UserProfile['travel_pace'],
        social_energy: (newDna.social_energy || null) as UserProfile['social_energy'],
        planning_style: (newDna.planning_style || null) as UserProfile['planning_style'],
        experience_level: (newDna.experience_level || null) as UserProfile['experience_level'],
        travel_with: (newDna.travel_with || null) as UserProfile['travel_with'],
      })
      goStage('finale', 1)
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const quizNext = () => {
    haptic(8)
    if (quizStep < 3) { setNewDirection(1); setQuizStep(s => s + 1); return }
    if (quizStep === 3) { setNewDirection(1); setQuizStep(4); setDnaIndex(0); return }
    if (dnaIndex < DNA_DIMENSIONS.length - 1) { setNewDirection(1); setDnaIndex(d => d + 1); return }
    finishQuiz()
  }

  const quizBack = () => {
    haptic(6)
    if (quizStep === 4 && dnaIndex > 0) { setNewDirection(-1); setDnaIndex(d => d - 1); return }
    if (quizStep === 0) { goStage('valueprop', -1); return }
    setNewDirection(-1)
    setQuizStep(s => s - 1)
  }

  const canQuizContinue = () => {
    if (quizStep === 0) return newName.trim().length >= 2 && newAgeValid && !!newGender
    if (quizStep === 1) return true
    if (quizStep === 2) return newCountry.trim().length > 0 && newCity.trim().length > 0
    if (quizStep === 3) return true
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

  const dim = DNA_DIMENSIONS[dnaIndex]
  const quizKey = `quiz-${quizStep}-${dnaIndex}`

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div
        className="flex flex-col max-w-sm mx-auto w-full px-6 min-h-screen"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 36px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}
      >
        {!authChecked ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        ) : (
          <>
            {newStage === 'quiz' && !finalizing && (
              <div className="shrink-0">
                <div className="flex items-center justify-between mb-5">
                  <button onClick={quizBack} className="text-white/28 text-sm active:opacity-60 transition-opacity">← Back</button>
                  <span className="text-white/25 text-xs font-medium">
                    {quizStep < 4 ? `Step ${quizStep + 1} of 4` : `Travel DNA · ${dnaIndex + 1} of ${DNA_DIMENSIONS.length}`}
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

            <AnimatePresence custom={newDirection} mode="wait">
                {newStage === 'auth' && (
                  <motion.div
                    key="auth"
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                  >
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }}
                      className={authShowEmail ? 'mt-3' : 'mt-8'}
                    >
                      <motion.p variants={fadeUpVariants} className="text-white/30 text-xs font-semibold uppercase tracking-[0.22em] mb-2">
                        Welcome to
                      </motion.p>
                      <motion.h1 variants={fadeUpVariants} className={`text-white font-extrabold tracking-tight ${authShowEmail ? 'text-2xl mb-2' : 'text-4xl mb-4'}`}>
                        TripAlong
                      </motion.h1>
                      {!authShowEmail && (
                        <motion.p variants={fadeUpVariants} className="text-white/40 text-base leading-relaxed">
                          Find your people.<br />See the world together.
                        </motion.p>
                      )}
                    </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 28 }}
                        className="mt-auto flex flex-col gap-2.5"
                      >
                        <button
                          onClick={handleAuthGoogle}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-black text-base active:scale-[0.98] transition-transform"
                          style={{ backgroundColor: '#F0EBE3' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Continue with Google
                        </button>

                        {!authShowEmail ? (
                          <button
                            onClick={() => { haptic(6); setAuthShowEmail(true) }}
                            className="w-full py-4 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
                            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                          >
                            Continue with Email
                          </button>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <input
                              type="email"
                              placeholder="Email"
                              value={authEmail}
                              onChange={e => setAuthEmail(e.target.value)}
                              className="bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                              autoFocus
                            />
                            <input
                              type="password"
                              placeholder="Password"
                              value={authPassword}
                              onChange={e => setAuthPassword(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAuthEmailSubmit() }}
                              className="bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
                            />
                            {authError && <p className="text-red-400 text-xs">{authError}</p>}
                            <button
                              onClick={handleAuthEmailSubmit}
                              disabled={authLoading || !authEmail || !authPassword}
                              className="w-full py-4 rounded-2xl font-bold text-black text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
                              style={{ backgroundColor: '#F0EBE3' }}
                            >
                              {authLoading ? 'One sec...' : authMode === 'signup' ? 'Create free account' : 'Sign in'}
                            </button>
                            <button
                              onClick={() => setAuthMode(m => m === 'signup' ? 'signin' : 'signup')}
                              className="text-white/28 text-xs text-center py-1 active:opacity-60 transition-opacity"
                            >
                              {authMode === 'signup' ? 'Already have an account? Sign in' : 'No account? Sign up free'}
                            </button>
                          </div>
                        )}

                        {!authShowEmail && (
                          <p className="text-white/18 text-xs text-center pt-1">
                            By continuing you agree to our community guidelines
                          </p>
                        )}

                        {!showMemberCode ? (
                          <button
                            onClick={() => { haptic(4); setShowMemberCode(true) }}
                            className="text-white/10 text-[10px] text-center pt-1 active:opacity-60 transition-opacity"
                          >
                            Are you a TripAlong member?
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={memberCode}
                              onChange={e => { setMemberCode(e.target.value); setMemberCodeError(false) }}
                              onKeyDown={e => { if (e.key === 'Enter') handleMemberCodeSubmit() }}
                              placeholder="Access code"
                              autoCapitalize="none"
                              className="flex-1 bg-white/6 border rounded-xl px-3 py-2 text-white text-xs outline-none"
                              style={{ borderColor: memberCodeError ? '#FF453A' : 'rgba(255,255,255,0.12)' }}
                            />
                            <button
                              onClick={handleMemberCodeSubmit}
                              className="text-white/40 text-xs font-semibold px-3 py-2 active:opacity-60 transition-opacity"
                            >
                              Go
                            </button>
                          </div>
                        )}
                      </motion.div>
                  </motion.div>
                )}

                {newStage === 'welcome' && (
                  <motion.div
                    key="welcome"
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col relative"
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
                    className="flex-1 flex flex-col gap-6"
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
                    className="flex-1 flex flex-col"
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
                    className="flex-1 flex flex-col"
                  >
                    <div>
                      <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Put a face to<br />your adventure.</h1>
                      <p className="text-white/38 text-sm">Profiles with photos get 3× more connections.</p>
                    </div>

                    <div className="flex-1 flex items-center justify-center py-4">
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="w-44 aspect-[3/4] rounded-3xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center gap-3 relative active:scale-[0.97] transition-transform"
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
                    </div>

                    {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}

                    <QuizContinueButton onClick={quizNext} disabled={!photoUrl || uploading} label="Continue →" />
                    <button
                      onClick={() => { haptic(4); quizNext() }}
                      disabled={uploading}
                      className="w-full py-3 text-sm font-medium active:opacity-60 transition-opacity"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      Skip for now
                    </button>
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
                    className="flex-1 flex flex-col"
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

                {newStage === 'quiz' && quizStep === 3 && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
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

                {newStage === 'quiz' && quizStep === 4 && !finalizing && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
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

                {newStage === 'quiz' && finalizing && (
                  <motion.div
                    key="finalizing"
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col items-center justify-center text-center"
                  >
                    {error ? (
                      <>
                        <p className="text-red-400 text-sm mb-5">{error}</p>
                        <button
                          onClick={finishQuiz}
                          className="px-6 py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform mb-3"
                          style={CTA_STYLE}
                        >
                          Try again
                        </button>
                        <button
                          onClick={() => { setFinalizing(false); setError('') }}
                          className="text-white/30 text-xs active:opacity-60 transition-opacity"
                        >
                          ← Back to Travel DNA
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mb-4" />
                        <p className="text-white/40 text-sm">Setting up your profile...</p>
                      </>
                    )}
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
                    className="flex-1 flex flex-col items-center text-center"
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
          </>
        )}
      </div>
    </main>
  )
}
