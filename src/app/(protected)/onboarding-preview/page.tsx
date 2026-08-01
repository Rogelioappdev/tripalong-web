'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createProfile, updateProfile, getActiveUsers30d } from '@/lib/queries'
import { normalizeImageToJpeg } from '@/lib/image'
import { haptic } from '@/lib/haptics'
import { playStampSound } from '@/lib/stampSound'
import { SEASONS, VIBES } from '@/lib/tripOptions'
import { TripPreviewCard } from '@/components/onboarding/TripPreviewCard'
import { WorldRouteMap } from '@/components/onboarding/WorldRouteMap'
import { SplashCarousel } from '@/components/onboarding/SplashCarousel'
import { TravelDnaStep } from '@/components/onboarding/TravelDnaStep'
import { PhotoCropModal } from '@/components/onboarding/PhotoCropModal'
import { CitySearchPicker } from '@/components/onboarding/CitySearchPicker'
import { TripDateRangePicker } from '@/components/onboarding/TripDateRangePicker'
import { DNA_DIMENSIONS, EMPTY_DNA, type NewDnaData, type DnaOption } from '@/components/onboarding/dnaOptions'
import { getFlag } from '@/lib/countries'
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

// 'momentum' step's ring of small bubbles around the big count circle — reuses
// the app's real VIBES list (lib/tripOptions.ts) rather than fabricating fake
// user avatars/photos, same reasoning as SplashCarousel.tsx's activity bubbles
// (see that file's BADGE_COLORS/BADGE_INITIALS comment). 8 of VIBES' 10 entries,
// picked for visual/emoji variety around the ring.
const MOMENTUM_VIBE_VALUES = ['adventure', 'foodie', 'beach', 'nature', 'party', 'backpacking', 'cultural', 'chill'] as const

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
  const [newStage, setNewStage] = useState<'splash' | 'auth' | 'valueprop' | 'quiz' | 'passport' | 'finale'>('splash')
  const [newDirection, setNewDirection] = useState(1)
  // Flat ordered step-key system (replaces an old quizStep+dnaIndex pair).
  // PRE_DNA_STEPS run first, then one screen per DNA_DIMENSIONS entry, then
  // POST_DNA_STEPS. Each batch of onboarding work inserts its own keys into
  // whichever array is appropriate and adds a matching JSX block + a case in
  // canQuizContinue() — the array is the single source of truth for order,
  // progress %, and back/next navigation, so no other function needs touching
  // when a new step is inserted.
  const [stepIndex, setStepIndex] = useState(0)
  const [newHearAbout, setNewHearAbout] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBirthDay, setNewBirthDay] = useState('')
  const [newBirthMonth, setNewBirthMonth] = useState('')
  const [newBirthYear, setNewBirthYear] = useState('')
  const [newGender, setNewGender] = useState<'' | 'male' | 'female' | 'other'>('')
  const [newCountry, setNewCountry] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newTripDestination, setNewTripDestination] = useState('')
  const [newTripWhen, setNewTripWhen] = useState('')
  // Exact-dates alternative to the newTripWhen season chips, via
  // TripDateRangePicker's react-day-picker calendar. ISO YYYY-MM-DD strings
  // (same convention as CreateTripModal's startDate/endDate), '' when unset.
  const [newTripStartDate, setNewTripStartDate] = useState('')
  const [newTripEndDate, setNewTripEndDate] = useState('')
  const [newBio, setNewBio] = useState('')
  const [newInstagram, setNewInstagram] = useState('')
  const [newDna, setNewDna] = useState<NewDnaData>(EMPTY_DNA)
  // 'momentum' step's secondary social-proof count (the screen's PRIMARY
  // message is priming the user for the upcoming Travel DNA questions — see
  // that step's JSX). null = still loading; 0 (or a fetch error, which
  // getActiveUsers30d already collapses to 0) falls back to non-numeric copy
  // so this screen never looks broken before the get_active_users_30d
  // migration has been run in prod. Both null and the fallback render the
  // same generic caption text, so no separate loading UI is needed here.
  const [activeUsers30d, setActiveUsers30d] = useState<number | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newTravelPhotos, setNewTravelPhotos] = useState<string[]>([])
  const [uploadingTravelPhotos, setUploadingTravelPhotos] = useState(false)
  const [rawPhotoFile, setRawPhotoFile] = useState<File | null>(null)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const finaleControls = useAnimation()
  // Drives the passport card's brief "thud" reaction (tiny scale-pulse +
  // shake) the instant the APPROVED stamp finishes slamming down — see the
  // 'passport' stage below. Imperative (via .start()) rather than a plain
  // animate object so it can be fired precisely on stamp impact without
  // fighting the card's own declarative entrance animation.
  const passportImpactControls = useAnimation()

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

  // NOTE: this is the /onboarding-preview copy, reachable only via the hidden
  // Settings > "Are you a TripAlong member?" gate. Unlike the real /onboarding
  // route, it deliberately does NOT auto-skip to 'valueprop' when a session
  // already exists — the whole point of this route is to preview the new
  // splash/auth/birthday/attribution screens as a tester who is, in practice,
  // always already logged in. Prefilling the name from the session is still
  // useful, so that part is kept.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        if (data.user.user_metadata?.full_name) setNewName(data.user.user_metadata.full_name)
        else if (data.user.user_metadata?.name) setNewName(data.user.user_metadata.name)
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
      if (!row || row.age === null) setNewStage('valueprop')
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

  // Reset the inline age-confirmation once any date field changes after the
  // user already confirmed it, so a corrected date gets re-confirmed.
  useEffect(() => { setAgeConfirmed(false) }, [newBirthDay, newBirthMonth, newBirthYear])

  const PRE_DNA_STEPS = ['birthday', 'attribution', 'nameGender', 'photo', 'travelPhotos', 'location', 'bio', 'momentum'] as const
  const POST_DNA_STEPS = [] as const
  type PreDnaStep = typeof PRE_DNA_STEPS[number]
  type PostDnaStep = typeof POST_DNA_STEPS[number]

  const QUIZ_TOTAL_UNITS = PRE_DNA_STEPS.length + DNA_DIMENSIONS.length + POST_DNA_STEPS.length
  const quizProgressPct = ((stepIndex + 1) / QUIZ_TOTAL_UNITS) * 100

  const currentStepKind: 'pre' | 'dna' | 'post' =
    stepIndex < PRE_DNA_STEPS.length ? 'pre'
    : stepIndex < PRE_DNA_STEPS.length + DNA_DIMENSIONS.length ? 'dna'
    : 'post'
  const currentPreDnaStep: PreDnaStep | null = currentStepKind === 'pre' ? PRE_DNA_STEPS[stepIndex] : null
  const currentDnaIndex = currentStepKind === 'dna' ? stepIndex - PRE_DNA_STEPS.length : -1
  const currentPostDnaStep: PostDnaStep | null =
    currentStepKind === 'post' ? POST_DNA_STEPS[stepIndex - PRE_DNA_STEPS.length - DNA_DIMENSIONS.length] : null

  // Fetch the momentum step's real active-user count only when that step is
  // actually on screen (not on every render of the whole page). Guarded with
  // `cancelled` so a resolved fetch never calls setState after the user has
  // swiped away from this step. getActiveUsers30d() already collapses any RPC
  // error to 0, so no separate error state is needed here — a 0 (or a fetch
  // error) both fall through to the non-numeric fallback copy in the JSX below.
  useEffect(() => {
    if (currentPreDnaStep !== 'momentum') return
    let cancelled = false
    getActiveUsers30d().then(count => { if (!cancelled) setActiveUsers30d(count) })
    return () => { cancelled = true }
  }, [currentPreDnaStep])

  const goStage = (stage: typeof newStage, dir: number) => { setNewDirection(dir); setNewStage(stage) }

  // Fired via onAnimationComplete on the passport card's APPROVED stamp
  // (see 'passport' stage below) the instant its drop+bounce animation
  // actually finishes — i.e. the real moment of "impact", not a guessed
  // timeout. Plays the synthesized stamp thud and gives the card itself a
  // tiny, brief scale/shake reaction so the two sell one "thud" together.
  const handlePassportStampImpact = () => {
    playStampSound()
    passportImpactControls.start({
      scale: [1, 1.018, 0.99, 1],
      x: [0, -2, 2, -1, 0],
      transition: { duration: 0.13, ease: 'easeInOut' },
    })
  }

  // Bug fix ("moves down weirdly" on valueprop's Continue tap): the quiz
  // header logo row below is `shrink-0` and sits directly above the
  // AnimatePresence in a fixed-height, overflow-hidden flex column. It used
  // to be conditioned directly on `newStage === 'quiz'`, which flips true the
  // instant Continue is clicked — but AnimatePresence (mode="wait") keeps the
  // outgoing 'valueprop' screen mounted and visibly sliding out for its full
  // 250ms exit transition (goStage('quiz', 1) below is the *only* place that
  // enters 'quiz', so this is where the glitch was reported). Inserting the
  // header instantly shrank the sibling flex-1 region by the header's height,
  // shoving the still-exiting valueprop content down mid-animation. Delaying
  // the header's appearance by that same 250ms lets it show up alongside the
  // next quiz screen's own entrance instead, once the old screen is gone.
  const [quizChromeVisible, setQuizChromeVisible] = useState(false)
  useEffect(() => {
    if (newStage !== 'quiz') { setQuizChromeVisible(false); return }
    const t = setTimeout(() => setQuizChromeVisible(true), 250)
    return () => clearTimeout(t)
  }, [newStage])

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
        goStage('valueprop', 1)
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
      goStage('valueprop', 1)
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
      // The passport screen only ever reads local component state (name,
      // photo, DNA answers, etc.) — none of it depends on the Supabase write
      // this branch skips — so testers using the member-code shortcut should
      // still see it, not get bounced straight to finale.
      goStage('passport', 1)
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
        photos: newTravelPhotos,
        travel_styles: newDna.travel_styles,
        travel_pace: (newDna.travel_pace || null) as UserProfile['travel_pace'],
        social_energy: (newDna.social_energy || null) as UserProfile['social_energy'],
        planning_style: (newDna.planning_style || null) as UserProfile['planning_style'],
        experience_level: (newDna.experience_level || null) as UserProfile['experience_level'],
        travel_with: (newDna.travel_with || null) as UserProfile['travel_with'],
      })
      goStage('passport', 1)
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const quizNext = () => {
    haptic(8)
    if (stepIndex >= QUIZ_TOTAL_UNITS - 1) { finishQuiz(); return }
    setNewDirection(1)
    setStepIndex(s => s + 1)
  }

  const quizBack = () => {
    haptic(6)
    if (stepIndex === 0) { goStage('valueprop', -1); return }
    setNewDirection(-1)
    setStepIndex(s => s - 1)
  }

  // Swipe-right-to-go-back gesture shared by every quiz step's motion.div.
  //
  // This used to be Framer Motion's native `drag="x"` prop with
  // dragConstraints pinning the element back to 0 on release. That caused a
  // real bug: `drag` intercepts pointer gestures across the ENTIRE element,
  // including buttons inside it (e.g. an attribution option, or Continue) —
  // any few px of pointer jitter during an ordinary tap gets read as a tiny
  // drag, and releasing it inside dragConstraints plays an elastic
  // snap-back animation that visually collides with the real slide-out exit
  // transition, which is exactly the "laggy/weird" feel reported after
  // tapping through the attribution screen.
  //
  // Fixed by dropping Framer's `drag` gesture entirely in favor of plain
  // Pointer Events that only ever read coordinates on down/up — no
  // preventDefault, no pointer capture, so button clicks underneath are
  // completely unaffected, and there's no live drag-follow or snap-back
  // animation to collide with anything. We only act on the gesture once it
  // ends, and only if it was mostly horizontal (guards against a vertical
  // scroll/tap being misread as a swipe).
  const QUIZ_SWIPE_BACK_THRESHOLD = 90
  const quizPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const handleQuizPointerDown = (e: React.PointerEvent) => {
    quizPointerStartRef.current = { x: e.clientX, y: e.clientY }
  }
  const handleQuizPointerUp = (e: React.PointerEvent) => {
    const start = quizPointerStartRef.current
    quizPointerStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (dx > QUIZ_SWIPE_BACK_THRESHOLD && Math.abs(dy) < 60) quizBack()
  }
  const quizDragProps = {
    onPointerDown: handleQuizPointerDown,
    onPointerUp: handleQuizPointerUp,
  }

  const canQuizContinue = () => {
    if (currentStepKind === 'pre') {
      switch (currentPreDnaStep) {
        case 'birthday': return newAgeValid && ageConfirmed
        case 'attribution': return newHearAbout !== ''
        case 'nameGender': return newName.trim().length >= 2 && !!newGender
        case 'photo': return true
        case 'travelPhotos': return newTravelPhotos.length >= 3
        case 'location': return newCountry.trim().length > 0 && newCity.trim().length > 0
        case 'bio': return true
        case 'momentum': return true
        default: return true
      }
    }
    if (currentStepKind === 'dna') {
      const dim = DNA_DIMENSIONS[currentDnaIndex]
      const v = newDna[dim.key]
      return Array.isArray(v) ? v.length > 0 : v !== ''
    }
    return true
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

  // Multi-photo grid upload for the 'travelPhotos' step — same avatars bucket
  // and path convention as Profile page's handleGridPhotosUpload (uploads
  // sequentially, appends each public URL as it succeeds).
  const handleTravelPhotosUpload = async (files: File[]) => {
    if (files.length === 0) return
    const remaining = 10 - newTravelPhotos.length
    const toUpload = files.slice(0, Math.max(0, remaining))
    if (toUpload.length === 0) return
    setUploadingTravelPhotos(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Please sign in again.'); return }
      for (const file of toUpload) {
        const jpeg = await normalizeImageToJpeg(file)
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
        const { error: uploadError } = await supabase.storage.from('avatars')
          .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        setNewTravelPhotos(prev => [...prev, publicUrl])
      }
    } catch (e: any) {
      setError(e?.message ?? 'Photo upload failed. Try again.')
    } finally {
      setUploadingTravelPhotos(false)
    }
  }

  const removeTravelPhoto = (url: string) => {
    setNewTravelPhotos(prev => prev.filter(p => p !== url))
  }

  // Object URL for whatever raw file the picker just returned, so the crop
  // modal has something to render. Created/revoked in lockstep with
  // rawPhotoFile so we never leak a blob: URL, whether the user confirms,
  // cancels, or navigates away mid-crop.
  useEffect(() => {
    if (!rawPhotoFile) { setCropImageSrc(null); return }
    const url = URL.createObjectURL(rawPhotoFile)
    setCropImageSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [rawPhotoFile])

  const handlePhotoPicked = (file: File) => {
    setRawPhotoFile(file)
    setShowCropModal(true)
  }

  const handleCropConfirm = (croppedFile: File) => {
    setShowCropModal(false)
    setRawPhotoFile(null)
    handlePhotoUpload(croppedFile)
  }

  const handleCropCancel = () => {
    setShowCropModal(false)
    setRawPhotoFile(null)
  }

  const dim = currentStepKind === 'dna' ? DNA_DIMENSIONS[currentDnaIndex] : DNA_DIMENSIONS[0]
  const quizKey = `quiz-${stepIndex}`

  // 'momentum' step's formatted count — plain digits with thousands separators,
  // no K/M abbreviation (this app is early-stage; that logic isn't needed yet).
  // null (still loading) and 0 (migration not run yet, or genuinely brand new)
  // both fall through to the non-numeric fallback copy in the JSX below, so the
  // screen never looks broken regardless of backend state.
  const activeUsers30dDisplay = activeUsers30d !== null && activeUsers30d > 0 ? activeUsers30d.toLocaleString() : null

  // 'passport' stage's trait pills — pulled straight from the DNA answers just
  // collected, nothing fabricated. Shows up to 2 travel_styles (the multi-select,
  // most "vibe"-defining dimension — closest thing this app has to the
  // competitor passport card's traveler-type pills) plus the single
  // experience_level pick (a nice "well-traveled" flourish that fits the
  // passport metaphor). Falls back gracefully to fewer pills if the user left
  // some DNA answers blank (shouldn't happen since canQuizContinue() requires
  // every dimension, but this stays defensive either way).
  const dnaOption = (key: keyof NewDnaData, value: string): DnaOption | undefined =>
    DNA_DIMENSIONS.find(d => d.key === key)?.options.find(o => o.value === value)
  const passportPills: DnaOption[] = [
    ...newDna.travel_styles.slice(0, 2).map(v => dnaOption('travel_styles', v)),
    dnaOption('experience_level', newDna.experience_level),
  ].filter((o): o is DnaOption => !!o)

  // Real "issued" date for the passport stamp — today, formatted plainly
  // (e.g. "31 JUL 2026"), never a hardcoded placeholder.
  const passportNow = new Date()
  const passportIssuedDate = `${String(passportNow.getDate()).padStart(2, '0')} ${passportNow.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${passportNow.getFullYear()}`

  return (
    <main className="h-[100dvh] overflow-hidden bg-black flex flex-col">
      <div
        className="flex flex-col max-w-sm mx-auto w-full px-6 h-full overflow-hidden"
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
            {/* No visible progress bar / step counter across the quiz at large,
                by design — matches the competitor reference this flow is
                modeled on, which relies on momentum/social-proof interstitials
                rather than a literal progress UI. quizProgressPct is still
                computed above in case a future screen (or A/B test) wants it
                back. The old "← Back" button was replaced by a swipe-right-to-
                go-back drag gesture on each quiz step (see quizDragProps
                below); this small persistent logo mark takes its place at the
                top of the quiz chrome. The one deliberate, narrow exception:
                a thin "Question X of 6" progress bar shown only during the 6
                Travel DNA dimension screens (currentStepKind === 'dna'),
                added per explicit user request — see below. */}
            {quizChromeVisible && !finalizing && (
              <div className="shrink-0 mb-6 flex flex-col gap-3">
                <div className="flex items-center justify-center gap-2">
                  {/* /tagalong-icon.png has generous transparent padding around the
                      mark (see BottomTabBar's use of the same asset), so it's sized
                      up past its visible content to read clearly at this scale —
                      matches the competitor reference's bolder top-of-screen logo
                      treatment (see tripalong_nomadtable_screens.md). Same block
                      renders above every quiz step, so position is identical
                      throughout. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tagalong-icon.png" alt="" className="w-9 h-9 object-contain" />
                  <span className="text-white font-extrabold text-xl tracking-tight">TripAlong</span>
                </div>

                {/* Deliberate, narrow exception to this flow's "no progress bar"
                    rule (see note below on quizProgressPct): shown ONLY for the
                    6 Travel DNA questions (currentStepKind === 'dna'), per
                    explicit user request — those 6 screens are a distinct,
                    countable sub-sequence within the quiz, unlike every other
                    step here. Width is driven off currentDnaIndex/DNA_DIMENSIONS
                    (not the whole-quiz quizProgressPct), and animates between
                    questions with the same spring this file already uses for
                    other settle-into-place transitions (see the quiz CTA button
                    and auth screen above). */}
                {currentStepKind === 'dna' && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: '#F0EBE3' }}
                        animate={{ width: `${((currentDnaIndex + 1) / DNA_DIMENSIONS.length) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                      />
                    </div>
                    <span className="text-white/25 text-[10px] font-semibold tracking-wide">
                      Question {currentDnaIndex + 1} of {DNA_DIMENSIONS.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence custom={newDirection} mode="wait">
                {newStage === 'splash' && (
                  <motion.div
                    key="splash"
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col relative"
                  >
                    <SplashCarousel onContinue={() => goStage('auth', 1)} />
                  </motion.div>
                )}

                {newStage === 'auth' && (
                  <motion.div
                    key="auth"
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col relative overflow-hidden -mx-6 px-6"
                  >
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.14, delayChildren: authShowEmail ? 0.05 : 0.4 } } }}
                      className={authShowEmail ? 'flex-1 flex flex-col items-center justify-center' : 'flex-1 flex flex-col items-center justify-center text-center'}
                    >
                      {authShowEmail ? (
                        <motion.h1 variants={fadeUpVariants} className="text-white font-black tracking-tight text-4xl">
                          TripAlong
                        </motion.h1>
                      ) : (
                        <>
                          <motion.p variants={fadeUpVariants} className="text-white/50 text-xs font-semibold uppercase tracking-[0.22em] mb-2">
                            Welcome to
                          </motion.p>
                          <motion.h1 variants={fadeUpVariants} className="text-white font-black tracking-tight text-5xl mb-4">
                            TripAlong
                          </motion.h1>
                          <motion.p variants={fadeUpVariants} className="text-white/60 text-base leading-relaxed">
                            Find your people.<br />See the world together.
                          </motion.p>
                        </>
                      )}
                    </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 28 }}
                        className="mt-auto flex flex-col gap-2.5"
                      >
                        {/* Honest social-proof pill — no fabricated live number. The `users`
                            table's RLS policy (supabase/migrations/20260606_rls_security.sql,
                            "users_select") only grants SELECT to the `authenticated` role, and
                            this screen renders pre-auth, so a real count isn't safely gettable
                            here without a new anon-safe policy or public stats endpoint. Swap
                            this copy for a real live count if one becomes available. */}
                        {!authShowEmail && (
                          <div className="self-center flex items-center gap-2 bg-white/6 border border-white/12 rounded-full px-3.5 py-2 mb-1">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: '#30D158' }} />
                              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: '#30D158' }} />
                            </span>
                            <span className="text-white/55 text-xs font-medium">Join travelers finding their people right now 🌍</span>
                          </div>
                        )}

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
                            style={{ backgroundColor: 'transparent', color: '#F0EBE3', border: '1.5px solid rgba(240,235,227,0.45)' }}
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
                    <div className="flex-1 flex items-center justify-center py-2 min-h-0 overflow-hidden">
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

                {newStage === 'quiz' && currentPreDnaStep === 'birthday' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
                  >
                    <div>
                      <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">When&apos;s your birthday?</h1>
                      <p className="text-white/38 text-sm">You must be at least 16 to use TripAlong.</p>
                    </div>

                    <div className="mt-7">
                      <label className="text-white/45 text-xs mb-2 block font-semibold uppercase tracking-wider">Date of birth</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <select
                          value={newBirthDay}
                          onChange={e => setNewBirthDay(e.target.value)}
                          className="bg-white/6 border border-white/12 rounded-2xl px-3 py-4 text-white text-sm outline-none [color-scheme:dark]"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                          ))}
                        </select>
                        <select
                          value={newBirthMonth}
                          onChange={e => setNewBirthMonth(e.target.value)}
                          className="bg-white/6 border border-white/12 rounded-2xl px-3 py-4 text-white text-sm outline-none [color-scheme:dark]"
                        >
                          <option value="">Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={i} value={String(i + 1)}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={newBirthYear}
                          onChange={e => setNewBirthYear(e.target.value)}
                          className="bg-white/6 border border-white/12 rounded-2xl px-3 py-4 text-white text-sm outline-none [color-scheme:dark]"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 80 }, (_, i) => currentYear - 16 - i).map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                      {newBirthYear && !newAgeValid && (
                        <p className="text-red-400 text-xs mt-2.5">Must be 16 or older to use TripAlong</p>
                      )}

                      {newAgeValid && !ageConfirmed && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-5 rounded-2xl border border-white/12 bg-white/6 overflow-hidden"
                        >
                          <div className="px-5 py-4 text-center">
                            <p className="text-white font-bold text-sm mb-1.5">Confirm your age</p>
                            <p className="text-white/45 text-xs leading-relaxed">You are {newAge} years old right now. Go back if this is not correct.</p>
                          </div>
                          <div className="flex border-t border-white/10">
                            <button
                              onClick={() => { haptic(6); setNewBirthDay(''); setNewBirthMonth(''); setNewBirthYear('') }}
                              className="flex-1 py-3.5 text-xs font-semibold border-r border-white/10 active:opacity-60 transition-opacity"
                              style={{ color: 'rgba(255,255,255,0.5)' }}
                            >
                              Go back
                            </button>
                            <button
                              onClick={() => { haptic(8); setAgeConfirmed(true) }}
                              className="flex-1 py-3.5 text-xs font-bold active:opacity-60 transition-opacity"
                              style={{ color: '#F0EBE3' }}
                            >
                              It&apos;s correct
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <QuizContinueButton onClick={quizNext} disabled={!canQuizContinue()} label="Continue →" />
                  </motion.div>
                )}

                {newStage === 'quiz' && currentPreDnaStep === 'attribution' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
                  >
                    <div>
                      <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">How did you hear about us?</h1>
                      <p className="text-white/38 text-sm">Help us understand how you found TripAlong.</p>
                    </div>

                    <div className="flex flex-col gap-3 mt-7">
                      {([
                        { v: 'instagram', e: '📸', l: 'Instagram' },
                        { v: 'tiktok', e: '🎵', l: 'TikTok' },
                        { v: 'youtube', e: '▶️', l: 'YouTube Shorts' },
                        { v: 'twitter', e: '✕', l: 'X (Twitter)' },
                        { v: 'reddit', e: '🤖', l: 'Reddit' },
                        { v: 'friend', e: '👥', l: 'A friend' },
                        { v: 'other', e: '🌐', l: 'Other' },
                      ]).map(o => (
                        <button
                          key={o.v}
                          onClick={() => { haptic(8); setNewHearAbout(o.v) }}
                          className="w-full flex items-center gap-3.5 py-5 px-5 rounded-3xl text-sm font-semibold border transition-colors"
                          style={newHearAbout === o.v
                            ? { backgroundColor: '#F0EBE3', color: '#000', borderColor: 'transparent' }
                            : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.12)' }}
                        >
                          <span className="text-xl">{o.e}</span> {o.l}
                        </button>
                      ))}
                    </div>

                    <QuizContinueButton onClick={quizNext} disabled={!canQuizContinue()} label="next" />
                  </motion.div>
                )}

                {newStage === 'quiz' && currentPreDnaStep === 'nameGender' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
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

                {newStage === 'quiz' && currentPreDnaStep === 'photo' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
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
                        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoPicked(f) }}
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

                {newStage === 'quiz' && currentPreDnaStep === 'travelPhotos' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
                  >
                    <div>
                      <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Show off your travels.</h1>
                      <p className="text-white/38 text-sm">Add 3–10 photos of you and your favorite trips — this is what other travelers see on your profile.</p>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-white/40 text-xs font-semibold">{newTravelPhotos.length} of 10 photos</p>
                      <p
                        className="text-xs font-bold"
                        style={{ color: newTravelPhotos.length >= 3 ? '#30D158' : 'rgba(255,255,255,0.35)' }}
                      >
                        {newTravelPhotos.length >= 3 ? '✓ Minimum met' : `${3 - newTravelPhotos.length} more to continue`}
                      </p>
                    </div>

                    {/* A small spinner tucked inside the "+ Add" tile was easy to
                        miss right after the native photo picker hands control
                        back — normalizing + uploading each file sequentially can
                        take a few seconds with no other feedback, which read as
                        "stuck." This banner makes the wait unmistakable. */}
                    {uploadingTravelPhotos && (
                      <div className="mt-3 flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/70 rounded-full animate-spin shrink-0" />
                        <span className="text-white/60 text-xs font-medium">Uploading your photos…</span>
                      </div>
                    )}

                    <div className="flex-1 min-h-0 overflow-y-auto mt-3 -mx-1 px-1">
                      <div className="grid grid-cols-3 gap-1.5">
                        {newTravelPhotos.map(url => (
                          <div key={url} className="aspect-square rounded-2xl overflow-hidden relative">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeTravelPhoto(url)}
                              className="absolute top-1 right-1 z-10 w-7 h-7 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12, lineHeight: 1, border: '1px solid rgba(255,255,255,0.25)' }}
                            >✕</button>
                          </div>
                        ))}
                        {newTravelPhotos.length < 10 && (
                          <label className="aspect-square rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer active:border-white/30 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={e => { const fs = Array.from(e.target.files ?? []); e.currentTarget.value = ''; handleTravelPhotosUpload(fs) }}
                            />
                            {uploadingTravelPhotos ? (
                              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-white/30 text-2xl">+</span>
                                <span className="text-white/20 text-xs">Add</span>
                              </div>
                            )}
                          </label>
                        )}
                      </div>
                    </div>

                    {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}

                    <QuizContinueButton
                      onClick={quizNext}
                      disabled={!canQuizContinue() || uploadingTravelPhotos}
                      label={uploadingTravelPhotos ? 'Uploading…' : 'Continue →'}
                    />
                  </motion.div>
                )}

                {newStage === 'quiz' && currentPreDnaStep === 'location' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
                  >
                    <div>
                      <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">Where are you based?</h1>
                      <p className="text-white/38 text-sm">Helps travelers nearby find you.</p>
                    </div>

                    {/* Scrollable content area — this step's content (especially
                        with the date-range calendar expanded) can run taller
                        than the fixed h-[100dvh] shell allows; without this the
                        calendar rendered off the bottom of the screen with no
                        way to reach it, since the shell itself is overflow-hidden. */}
                    <div className="flex-1 min-h-0 overflow-y-auto mt-6">
                      <CitySearchPicker
                        value={newCity ? `${newCity}${newCountry ? `, ${newCountry}` : ''}` : ''}
                        onSelect={({ city, country }) => { setNewCity(city); setNewCountry(country) }}
                        placeholder="Search for your city"
                        autoFocus
                      />

                      <div className="mt-8">
                        <h2 className="text-white font-bold text-lg mb-1">Got a trip coming up?</h2>
                        <p className="text-white/30 text-xs mb-4">Totally optional — you can always add this later.</p>
                        <CitySearchPicker
                          value={newTripDestination}
                          onSelect={({ city }) => setNewTripDestination(city)}
                          placeholder="Where to?"
                          className="mb-3"
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

                        <TripDateRangePicker
                          startDate={newTripStartDate}
                          endDate={newTripEndDate}
                          onChange={(start, end) => { setNewTripStartDate(start); setNewTripEndDate(end) }}
                        />
                      </div>
                    </div>

                    <QuizContinueButton onClick={quizNext} disabled={!canQuizContinue()} label="Continue →" />
                  </motion.div>
                )}

                {newStage === 'quiz' && currentPreDnaStep === 'bio' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
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

                {newStage === 'quiz' && currentPreDnaStep === 'momentum' && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
                  >
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      {/* Cream circle ringed by 8 small trip-vibe emoji bubbles —
                          same ring as before (reuses the app's real VIBES list,
                          "no fabricated people" rule shared with
                          SplashCarousel.tsx's bubble badges), but the circle's
                          content and the copy below it were reframed: this used
                          to be a pure social-proof momentum interstitial (a big
                          live user count as the headline). It sits directly
                          before the 6 Travel DNA questions, so its job now is
                          priming — telling the user those specific questions
                          feed the matching algorithm and that answering for
                          real (not fast) is what makes their matches good. The
                          real getActiveUsers30d() count still appears, just
                          demoted to a small supporting line under the subtext
                          instead of being the headline. */}
                      <div className="relative w-60 h-60 mb-8 shrink-0">
                        {/* sc-float is SplashCarousel.tsx's own ±8px bob keyframe,
                            reused here (same @keyframes name/timing) so this ring
                            reads as the same "alive" design language as that
                            screen's vibe bubbles rather than a new animation
                            style. Each bubble gets a staggered mount-in (scale+
                            fade, small per-index delay) via Framer Motion, then
                            settles into the CSS float loop — kept subtle (small
                            drift, slow, per-bubble delay offsets) since this is a
                            1-2s beat before 6 real questions, not a showcase. */}
                        <style>{`
                          @keyframes sc-float {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-8px); }
                          }
                          @keyframes momentum-glow {
                            0%, 100% { opacity: 0.35; }
                            50% { opacity: 0.7; }
                          }
                        `}</style>

                        {/* Soft pulsing glow behind the ring — same cream, no new color. */}
                        <div
                          className="absolute inset-0 m-auto w-40 h-40 rounded-full pointer-events-none"
                          style={{
                            backgroundColor: '#F0EBE3',
                            filter: 'blur(28px)',
                            animation: 'momentum-glow 4.5s ease-in-out infinite',
                          }}
                        />

                        {MOMENTUM_VIBE_VALUES.map((value, i) => {
                          const vibe = VIBES.find(v => v.value === value)
                          if (!vibe) return null
                          // Evenly spaced around the ring, starting at 12 o'clock.
                          const angle = (i / MOMENTUM_VIBE_VALUES.length) * 2 * Math.PI - Math.PI / 2
                          const ringRadius = 92
                          const x = Math.cos(angle) * ringRadius
                          const y = Math.sin(angle) * ringRadius
                          return (
                            // Two nested layers on purpose: Framer Motion's spring
                            // (opacity/scale, the entrance) and the CSS sc-float
                            // keyframe (translateY, the idle bob) both animate
                            // `transform` — stacking them on one element lets the
                            // CSS keyframe clobber the in-flight scale spring the
                            // instant its delay elapses. Splitting them onto an
                            // outer (entrance) + inner (float) element keeps both
                            // running independently with no fighting.
                            <motion.div
                              key={vibe.value}
                              initial={{ opacity: 0, scale: 0.4 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 320, damping: 22 }}
                              className="absolute"
                              style={{ left: `calc(50% + ${x}px - 18px)`, top: `calc(50% + ${y}px - 18px)` }}
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.08)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  animation: 'sc-float 3.6s ease-in-out infinite',
                                  animationDelay: `${0.6 + i * 0.22}s`,
                                }}
                              >
                                <span className="text-base">{vibe.emoji}</span>
                              </div>
                            </motion.div>
                          )
                        })}

                        <motion.div
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 22 }}
                          className="absolute inset-0 m-auto w-32 h-32 rounded-full flex items-center justify-center px-3"
                          style={{ backgroundColor: '#F0EBE3' }}
                        >
                          <span className="text-4xl">🧬</span>
                        </motion.div>
                      </div>

                      <h1 className="text-white font-extrabold text-2xl leading-tight mb-2 max-w-[280px]">
                        This is your Travel DNA.
                      </h1>
                      <p className="text-white/38 text-sm max-w-[280px] mb-3">
                        The next 6 questions are what actually match you with people and trips — answer for real, not fast.
                      </p>
                      <p className="text-white/25 text-xs">
                        {activeUsers30dDisplay
                          ? `${activeUsers30dDisplay} travelers were active this month`
                          : 'Travelers are joining trips right now'}
                      </p>
                    </div>

                    <QuizContinueButton onClick={quizNext} disabled={!canQuizContinue()} label="Continue →" />
                  </motion.div>
                )}

                {newStage === 'quiz' && currentStepKind === 'dna' && !finalizing && (
                  <motion.div
                    key={quizKey}
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                    {...quizDragProps}
                  >
                    <TravelDnaStep
                      dimension={dim}
                      value={newDna[dim.key]}
                      onToggle={v => toggleDna(dim.key, v, dim.multi)}
                    />
                    <QuizContinueButton
                      onClick={quizNext}
                      disabled={!canQuizContinue()}
                      label={currentDnaIndex === DNA_DIMENSIONS.length - 1 ? 'Finish →' : 'Next →'}
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

                {newStage === 'passport' && (
                  <motion.div
                    key="passport"
                    custom={newDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="flex-1 flex flex-col"
                  >
                    {/* TripAlong's take on the competitor's "passport celebration"
                        screen (see tripalong_nomadtable_screens.md, "15. Profile
                        created — 'passport' celebration") — same dashed-border
                        passport/visa-stamp metaphor, but reskinned entirely in this
                        app's dark/cream brand (no white/blush-pink) and built from
                        real just-collected state only: newName/newAge, the real
                        cropped photoUrl, newCity/newCountry, a couple of the DNA
                        answers as trait pills, and today's real date for the stamp
                        — nothing here is invented. */}
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center py-2">
                      {/* Outer wrapper: entrance only (the dashed card's own
                          "arrive" motion). Everything below assembles itself
                          piece by piece on top of this, each on its own
                          motion element with a staggered delay, so the
                          passport reads as being built rather than fading in
                          as one unit. The impact "thud" reaction (part of the
                          stamp landing, below) lives on a separate nested
                          motion.div so it can be triggered imperatively
                          without fighting this entrance animation. */}
                      <motion.div
                        initial={{ opacity: 0, y: 18, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.08 }}
                        className="relative w-full max-w-[290px] shrink-0"
                      >
                        <motion.div
                          animate={passportImpactControls}
                          className="relative rounded-[28px] border-2 border-dashed overflow-hidden"
                          style={{ borderColor: 'rgba(240,235,227,0.35)', backgroundColor: '#0d0d0d' }}
                        >
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(240,235,227,0.09), transparent 60%)' }}
                          />

                          {/* Scattered decorative travel emoji, low-opacity — same
                              "decorative, not data" role as the competitor's
                              background emoji, just dark-brand appropriate. */}
                          <span className="absolute text-lg opacity-[0.08]" style={{ top: 10, left: 14 }}>✈️</span>
                          <span className="absolute text-lg opacity-[0.08]" style={{ top: 14, right: 18 }}>🌍</span>
                          <span className="absolute text-lg opacity-[0.08]" style={{ bottom: 14, left: 20 }}>🧭</span>

                          <div className="relative z-10 flex flex-col items-center text-center px-5 pt-5 pb-4">
                            <motion.p
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.28, duration: 0.3 }}
                              className="text-[10px] font-bold tracking-[0.32em]"
                              style={{ color: 'rgba(240,235,227,0.5)' }}
                            >
                              TRIPALONG
                            </motion.p>

                            <motion.div
                              initial={{ opacity: 0, scale: 0.5, y: 6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ type: 'spring', stiffness: 340, damping: 20, delay: 0.42 }}
                              className="relative mt-4 mb-3 w-24 h-24 shrink-0"
                            >
                              <div
                                className="w-24 h-24 rounded-full overflow-hidden border-2"
                                style={{ borderColor: 'rgba(240,235,227,0.4)', backgroundColor: 'rgba(255,255,255,0.06)' }}
                              >
                                {photoUrl ? (
                                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-3xl">🧳</div>
                                )}
                              </div>
                              <span className="absolute -top-1.5 -left-2 text-base">⭐</span>
                              <span className="absolute -bottom-0.5 -left-2.5 text-base">🎒</span>
                              {newCountry && (
                                <div
                                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-sm border-2"
                                  style={{ backgroundColor: '#F0EBE3', borderColor: '#0d0d0d' }}
                                >
                                  {getFlag(newCountry) || '🌍'}
                                </div>
                              )}
                            </motion.div>

                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.58, duration: 0.3 }}
                              className="flex flex-col items-center"
                            >
                              <h2 className="text-white font-extrabold text-xl leading-tight">
                                {newName.trim() || 'Traveler'}{newAge ? `, ${newAge}` : ''}
                              </h2>
                              {(newCity || newCountry) && (
                                <p className="text-white/35 text-xs mt-1">
                                  {[newCity, newCountry].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </motion.div>

                            {/* APPROVED stamp: starts big, high, transparent and
                                off-angle, then slams down into its resting size/
                                position/rotation with a bouncy spring overshoot —
                                the "getting stamped" moment. The instant this
                                animation actually completes (not a guessed
                                timeout), handlePassportStampImpact fires the
                                synthesized thud sound and a tiny shake/pulse on
                                the card itself so the two land together. */}
                            <motion.div
                              initial={{ opacity: 0, scale: 1.9, y: -46, rotate: -27 }}
                              animate={{ opacity: 1, scale: 1, y: 0, rotate: -9 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 14, mass: 0.9, delay: 1 }}
                              onAnimationComplete={handlePassportStampImpact}
                              className="my-4"
                            >
                              <div className="border-2 rounded-xl px-4 py-1.5" style={{ borderColor: 'rgba(240,235,227,0.55)' }}>
                                <p className="font-black text-base tracking-[0.14em] leading-tight" style={{ color: '#F0EBE3' }}>
                                  APPROVED
                                </p>
                                <p className="text-[9px] font-bold tracking-[0.2em] text-center" style={{ color: 'rgba(240,235,227,0.55)' }}>
                                  {passportIssuedDate}
                                </p>
                              </div>
                            </motion.div>

                            {passportPills.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.48, duration: 0.3 }}
                                className="flex flex-wrap justify-center gap-1.5 mb-1"
                              >
                                {passportPills.map(opt => (
                                  <span
                                    key={opt.value}
                                    className="text-[11px] font-semibold rounded-full px-3 py-1"
                                    style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '1px solid rgba(240,235,227,0.22)', color: '#F0EBE3' }}
                                  >
                                    {opt.emoji} {opt.label}
                                  </span>
                                ))}
                              </motion.div>
                            )}

                            {newTravelPhotos.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.64, duration: 0.3 }}
                                className="flex gap-1.5 mt-3"
                              >
                                {newTravelPhotos.slice(0, 4).map(url => (
                                  <div
                                    key={url}
                                    className="w-9 h-9 rounded-lg overflow-hidden border"
                                    style={{ borderColor: 'rgba(240,235,227,0.2)' }}
                                  >
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </motion.div>
                            )}

                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 1.8, duration: 0.3 }}
                              className="w-full flex items-center justify-between mt-4 pt-3 border-t"
                              style={{ borderColor: 'rgba(240,235,227,0.15)' }}
                            >
                              <span className="text-[8px] font-semibold tracking-[0.16em]" style={{ color: 'rgba(240,235,227,0.28)' }}>
                                ISSUED {passportIssuedDate}
                              </span>
                              <span className="text-[8px] font-semibold tracking-[0.16em]" style={{ color: 'rgba(240,235,227,0.28)' }}>
                                TRIPALONG PASSPORT
                              </span>
                            </motion.div>
                          </div>
                        </motion.div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2 }}
                        className="text-center mt-6 shrink-0"
                      >
                        <h1 className="text-white font-extrabold text-2xl leading-tight mb-1.5">Profile created 🎉</h1>
                        <p className="text-white/38 text-sm leading-relaxed max-w-[260px] mx-auto">
                          Stamped and ready. Trips and travelers who match your vibe are just ahead.
                        </p>
                      </motion.div>
                    </div>

                    <motion.button
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 2.2, type: 'spring', stiffness: 300, damping: 28 }}
                      onClick={() => { haptic(8); goStage('finale', 1) }}
                      className="mt-auto w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform shrink-0"
                      style={CTA_STYLE}
                    >
                      Continue →
                    </motion.button>
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

      {/* Rendered outside the AnimatePresence/quiz-step tree above (which is
          mode="wait" and expects exactly one child at a time) since this
          overlay can be visible at the same time as the 'photo' step
          underneath it. It's a fixed, fullscreen overlay, so its position in
          the tree doesn't matter for layout. */}
      {showCropModal && cropImageSrc && (
        <PhotoCropModal
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </main>
  )
}
