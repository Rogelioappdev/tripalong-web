'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('from') ?? '/feed'

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loaded, setLoaded] = useState(false)
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
        router.replace(returnTo)
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

  if (!loaded) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div className="max-w-sm mx-auto w-full px-6 py-12 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={goBack} className="text-white/30 text-sm">← Back</button>
          <span className="text-white/30 text-sm">{step + 1} of {STEPS.length}</span>
          <button onClick={() => router.replace(returnTo)} className="text-white/30 text-sm">Skip</button>
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
