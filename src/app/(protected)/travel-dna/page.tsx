'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/lib/queries'

type DNAData = {
  gender: string
  travel_styles: string[]
  travel_pace: string
  social_energy: string
  planning_style: string
  experience_level: string
  travel_with: string
}

const STEPS = [
  {
    key: 'gender',
    title: 'How do you identify?',
    subtitle: 'This helps match you with compatible travel crews',
    multi: false,
    options: [
      { value: 'male', emoji: '👨', label: 'Man' },
      { value: 'female', emoji: '👩', label: 'Woman' },
      { value: 'other', emoji: '🌟', label: 'Non-binary' },
    ],
  },
  {
    key: 'travel_styles',
    title: 'Your travel style',
    subtitle: 'Pick all that apply',
    multi: true,
    options: [
      { value: 'adventure', emoji: '🏔️', label: 'Adventure' },
      { value: 'luxury', emoji: '✨', label: 'Luxury' },
      { value: 'backpacking', emoji: '🎒', label: 'Backpacking' },
      { value: 'cultural', emoji: '🏛️', label: 'Cultural' },
      { value: 'foodie', emoji: '🍜', label: 'Foodie' },
      { value: 'relaxed', emoji: '🌴', label: 'Relaxed' },
      { value: 'party', emoji: '🎉', label: 'Party' },
      { value: 'budget', emoji: '💸', label: 'Budget' },
    ],
  },
  {
    key: 'travel_pace',
    title: 'Your daily pace',
    subtitle: 'How do you like to travel day-to-day?',
    multi: false,
    options: [
      { value: 'slow', emoji: '☕', label: 'Slow & Steady', desc: 'Take it easy, soak it all in' },
      { value: 'balanced', emoji: '⚖️', label: 'Balanced', desc: 'Mix of exploring and relaxing' },
      { value: 'fast', emoji: '⚡', label: 'Go Go Go!', desc: 'See and do as much as possible' },
    ],
  },
  {
    key: 'social_energy',
    title: 'Social energy',
    subtitle: 'How do you recharge while traveling?',
    multi: false,
    options: [
      { value: 'introvert', emoji: '🌙', label: 'Introvert', desc: 'I need alone time to recharge' },
      { value: 'extrovert', emoji: '☀️', label: 'Extrovert', desc: 'I thrive around people' },
      { value: 'ambivert', emoji: '🌗', label: 'Ambivert', desc: 'It depends on my mood' },
    ],
  },
  {
    key: 'planning_style',
    title: 'Planning style',
    subtitle: 'How do you approach trip planning?',
    multi: false,
    options: [
      { value: 'planner', emoji: '📋', label: 'The Planner', desc: 'Itinerary ready weeks in advance' },
      { value: 'spontaneous', emoji: '🎲', label: 'Spontaneous', desc: 'Figure it out as we go' },
      { value: 'flexible', emoji: '🤸', label: 'Flexible', desc: 'Light plan, open to changes' },
    ],
  },
  {
    key: 'experience_level',
    title: 'Travel experience',
    subtitle: 'How much have you traveled?',
    multi: false,
    options: [
      { value: 'beginner', emoji: '🌱', label: 'Beginner', desc: 'Just starting out' },
      { value: 'intermediate', emoji: '🌿', label: 'Intermediate', desc: 'A few trips under my belt' },
      { value: 'experienced', emoji: '✈️', label: 'Experienced', desc: 'Been to many countries' },
      { value: 'expert', emoji: '🌍', label: 'Expert', desc: 'The world is my backyard' },
    ],
  },
  {
    key: 'travel_with',
    title: 'Travel group preference',
    subtitle: 'Who do you prefer to travel with?',
    multi: false,
    options: [
      { value: 'everyone', emoji: '🌍', label: 'Everyone', desc: 'Open to all genders' },
      { value: 'female', emoji: '👩', label: 'Women only', desc: 'Prefer women-only groups' },
      { value: 'male', emoji: '👨', label: 'Men only', desc: 'Prefer men-only groups' },
    ],
  },
]

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

export default function TravelDNAPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    }>
      <TravelDNAContent />
    </Suspense>
  )
}

function TravelDNAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from') ?? ''
  const returnTo = fromParam.startsWith('/') ? fromParam : '/feed'

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [dnaComplete, setDnaComplete] = useState(false)
  const [userName, setUserName] = useState('')
  const [data, setData] = useState<DNAData>({
    gender: '',
    travel_styles: [],
    travel_pace: '',
    social_energy: '',
    planning_style: '',
    experience_level: '',
    travel_with: '',
  })
  const [saving, setSaving] = useState(false)

  // Pre-populate with existing profile data
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const profile = await getProfile(user.id)
      if (profile) {
        setUserName(profile.name ?? '')
        setData({
          gender: profile.gender ?? '',
          travel_styles: profile.travel_styles ?? [],
          travel_pace: profile.travel_pace ?? '',
          social_energy: profile.social_energy ?? '',
          planning_style: profile.planning_style ?? '',
          experience_level: profile.experience_level ?? '',
          travel_with: profile.travel_with ?? '',
        })
      }
      setLoaded(true)
    })
  }, [])

  const currentStep = STEPS[step]

  const getValue = (key: string): string | string[] => {
    return data[key as keyof DNAData]
  }

  const isSelected = (key: string, value: string) => {
    const v = getValue(key)
    return Array.isArray(v) ? v.includes(value) : v === value
  }

  const toggle = (key: string, value: string, multi: boolean) => {
    setData(prev => {
      if (multi) {
        const arr = (prev[key as keyof DNAData] as string[])
        return { ...prev, [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
      }
      return { ...prev, [key]: value }
    })
  }

  const canContinue = () => {
    const v = getValue(currentStep.key)
    return Array.isArray(v) ? v.length > 0 : v !== ''
  }

  const goNext = async () => {
    if (step === STEPS.length - 1) {
      setSaving(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await updateProfile(user.id, {
          gender: data.gender as 'male' | 'female' | 'other',
          travel_styles: data.travel_styles,
          travel_pace: data.travel_pace as 'slow' | 'balanced' | 'fast',
          social_energy: data.social_energy as 'introvert' | 'extrovert' | 'ambivert',
          planning_style: data.planning_style as 'planner' | 'spontaneous' | 'flexible',
          experience_level: data.experience_level as 'beginner' | 'intermediate' | 'experienced' | 'expert',
          travel_with: data.travel_with as 'male' | 'female' | 'everyone',
        })
        setDnaComplete(true)
      } finally {
        setSaving(false)
      }
    } else {
      setDirection(1)
      setStep(s => s + 1)
    }
  }

  const goBack = () => {
    if (step === 0) { router.replace(returnTo); return }
    setDirection(-1)
    setStep(s => s - 1)
  }

  const handleShareDNA = async () => {
    const styleLabels = data.travel_styles
      .map(s => STEPS[1].options.find(o => o.value === s)?.label ?? s)
      .join(' · ')
    const text = `My Travel DNA: ${styleLabels} traveler. Find your perfect travel match on TripAlong 🌍✈️`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Travel DNA — TripAlong', text, url: window.location.origin })
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.origin}`)
      }
    } catch {}
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    )
  }

  if (dnaComplete) {
    const styleOptions = STEPS[1].options
    const paceOpt = STEPS.find(s => s.key === 'travel_pace')?.options.find(o => o.value === data.travel_pace)
    const energyOpt = STEPS.find(s => s.key === 'social_energy')?.options.find(o => o.value === data.social_energy)
    const expOpt = STEPS.find(s => s.key === 'experience_level')?.options.find(o => o.value === data.experience_level)

    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🧬</div>
            <h1 className="text-white font-extrabold text-2xl mb-1">Your Travel DNA</h1>
            <p className="text-white/40 text-sm">Share your travel personality with the world</p>
          </div>

          {/* DNA card */}
          <div
            className="w-full rounded-3xl p-5 mb-6"
            style={{ backgroundColor: '#0D0D0D', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            {userName && (
              <p className="text-white font-bold text-lg mb-4">{userName}</p>
            )}

            {/* Travel styles */}
            {data.travel_styles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {data.travel_styles.map(s => {
                  const opt = styleOptions.find(o => o.value === s)
                  return opt ? (
                    <span
                      key={s}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold"
                      style={{ backgroundColor: 'rgba(240,235,227,0.1)', border: '0.5px solid rgba(240,235,227,0.2)', color: '#F0EBE3' }}
                    >
                      {opt.emoji} {opt.label}
                    </span>
                  ) : null
                })}
              </div>
            )}

            {/* Traits row */}
            <div className="flex gap-2">
              {[
                paceOpt && { label: 'Pace', value: `${paceOpt.emoji} ${paceOpt.label}` },
                energyOpt && { label: 'Energy', value: `${energyOpt.emoji} ${energyOpt.label}` },
                expOpt && { label: 'Level', value: `${expOpt.emoji} ${expOpt.label}` },
              ].filter(Boolean).map((item: any) => (
                <div
                  key={item.label}
                  className="flex-1 rounded-2xl p-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <p className="text-white/30 text-xs mb-1">{item.label}</p>
                  <p className="text-white text-xs font-semibold leading-snug">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mt-4 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
              <span className="text-white/20 text-xs">✈️</span>
              <span className="text-white/20 text-xs font-medium">TripAlong</span>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={handleShareDNA}
            className="w-full py-4 rounded-2xl font-bold text-base mb-3 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            Share my Travel DNA ✈️
          </button>
          <button
            onClick={() => router.replace(returnTo)}
            className="w-full py-3 text-sm font-medium active:opacity-60 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            Continue to feed →
          </button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div className="max-w-sm mx-auto w-full px-6 pb-12 flex flex-col min-h-screen" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        {/* Header — no Skip: every field here is required before a profile
            counts as complete (see src/lib/profileCompleteness.ts), so
            skipping would just bounce the user right back via the app-wide
            completeness gate. */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={goBack} className="text-white/30 text-sm">← Back</button>
          <span className="text-white/30 text-sm">{step + 1} of {STEPS.length}</span>
          <span className="text-transparent text-sm select-none" aria-hidden>← Back</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 flex flex-col gap-6"
          >
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-1">{currentStep.title}</h1>
              <p className="text-white/40 text-sm">{currentStep.subtitle}</p>
            </div>

            {currentStep.multi ? (
              // Pill multi-select
              <div className="flex flex-wrap gap-2">
                {currentStep.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggle(currentStep.key, opt.value, true)}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                      isSelected(currentStep.key, opt.value)
                        ? 'bg-white text-black border-transparent'
                        : 'bg-white/6 text-white/60 border-white/12'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              // Card single-select
              <div className="flex flex-col gap-3">
                {currentStep.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggle(currentStep.key, opt.value, false)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      isSelected(currentStep.key, opt.value)
                        ? 'bg-white/10 border-accent/60'
                        : 'bg-white/4 border-white/10'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <div>
                      <p className={`font-semibold text-sm ${isSelected(currentStep.key, opt.value) ? 'text-accent' : 'text-white'}`}>
                        {opt.label}
                      </p>
                      {'desc' in opt && opt.desc && (
                        <p className="text-white/40 text-xs mt-0.5">{opt.desc}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={goNext}
              disabled={!canContinue() || saving}
              className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-30 mt-auto"
            >
              {saving ? 'Saving...' : step === STEPS.length - 1 ? 'Finish ✓' : 'Next →'}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}
