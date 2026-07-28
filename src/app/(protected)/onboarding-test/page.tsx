'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'

// Sandbox for iterating on onboarding UI/UX without touching a real profile or
// storage bucket — reachable only via the hidden member area in Settings. The
// real signup flow (`/onboarding`) is untouched by anything here; once a
// version tested here is approved, it gets manually promoted into that file.
// Photo preview uses a local object URL (no Supabase Storage write), and
// "Let's go"/"Skip" never call createProfile/updateProfile — they just show
// what would have been saved.

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

const GENDERS = [
  { value: 'male', emoji: '👨', label: 'Male' },
  { value: 'female', emoji: '👩', label: 'Female' },
  { value: 'other', emoji: '🌟', label: 'Other' },
]

const TRAVEL_STYLES = [
  { value: 'adventure', emoji: '🏔️', label: 'Adventure' },
  { value: 'luxury', emoji: '✨', label: 'Luxury' },
  { value: 'backpacking', emoji: '🎒', label: 'Backpacking' },
  { value: 'cultural', emoji: '🏛️', label: 'Cultural' },
  { value: 'foodie', emoji: '🍜', label: 'Foodie' },
  { value: 'relaxed', emoji: '🌴', label: 'Relaxed' },
  { value: 'party', emoji: '🎉', label: 'Party' },
  { value: 'budget', emoji: '💸', label: 'Budget' },
]

export default function OnboardingTestPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [gender, setGender] = useState('')
  const [travelStyles, setTravelStyles] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const currentYear = new Date().getFullYear()
  const age = birthYear
    ? currentYear - parseInt(birthYear) - (
        birthMonth && birthDay
          ? new Date(currentYear, parseInt(birthMonth) - 1, parseInt(birthDay)) > new Date() ? 1 : 0
          : 0
      )
    : null
  const ageValid = age !== null && age >= 16

  const toggleStyle = (v: string) =>
    setTravelStyles(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const exit = () => { haptic(6); router.push('/settings') }

  if (done) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-5">
        <span className="text-5xl">✅</span>
        <h1 className="text-white font-extrabold text-2xl">Preview complete</h1>
        <div className="w-full max-w-sm rounded-2xl p-4 text-left text-sm text-white/60 flex flex-col gap-1.5"
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
          <p><span className="text-white/35">Name:</span> {name || '—'}</p>
          <p><span className="text-white/35">Age:</span> {age ?? '—'}</p>
          <p><span className="text-white/35">Photo:</span> {photoUrl ? 'Added' : 'Skipped'}</p>
          <p><span className="text-white/35">Gender:</span> {gender || 'Skipped'}</p>
          <p><span className="text-white/35">Travel styles:</span> {travelStyles.length > 0 ? travelStyles.join(', ') : 'Skipped'}</p>
        </div>
        <p className="text-white/30 text-xs max-w-xs">Nothing was saved — this was a preview only.</p>
        <button
          onClick={exit}
          className="w-full max-w-sm py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          Back to Settings
        </button>
      </main>
    )
  }

  const steps = [
    // Step 0: Name + Birthday
    <div key="step0" className="flex flex-col gap-6">
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">Step 1 of 3</p>
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

    // Step 1: Photo (local preview only — never uploaded)
    <div key="step1" className="flex flex-col gap-6">
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">Step 2 of 3</p>
        <h1 className="text-white font-extrabold text-3xl leading-tight mb-1">
          Put a face to<br />your adventure.
        </h1>
        <p className="text-white/38 text-sm">Profiles with photos get 3× more connections.</p>
      </div>

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
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) setPhotoUrl(URL.createObjectURL(f))
        }}
      />

      <div className="flex flex-col gap-3 mt-auto">
        <button
          onClick={() => { haptic(8); setDirection(1); setStep(2) }}
          disabled={!photoUrl}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          Continue →
        </button>
        <button
          onClick={() => { haptic(4); setDirection(1); setStep(2) }}
          className="w-full py-3 text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Skip for now
        </button>
      </div>
    </div>,

    // Step 2: Quick vibe check (gender + travel styles)
    <div key="step2" className="flex flex-col gap-6">
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">Step 3 of 3</p>
        <h1 className="text-white font-extrabold text-3xl leading-tight mb-1">
          Quick vibe check.
        </h1>
        <p className="text-white/38 text-sm">Helps us match you with the right crews and trips.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <label className="text-white/45 text-xs mb-2.5 block font-semibold uppercase tracking-wider">How do you identify?</label>
          <div className="flex gap-2">
            {GENDERS.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => { haptic(5); setGender(g.value) }}
                className="flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-xs font-semibold transition-colors active:scale-95"
                style={gender === g.value
                  ? { background: '#F0EBE3', color: '#0a0a0a' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.12)' }}
              >
                <span className="text-xl">{g.emoji}</span>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-white/45 text-xs mb-2.5 block font-semibold uppercase tracking-wider">Your travel style</label>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_STYLES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => { haptic(5); toggleStyle(s.value) }}
                className="px-3.5 py-2 rounded-2xl text-[13px] font-semibold transition-colors active:scale-95"
                style={travelStyles.includes(s.value)
                  ? { background: '#F0EBE3', color: '#0a0a0a' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)', border: '0.5px solid rgba(255,255,255,0.12)' }}
              >
                <span className="mr-1">{s.emoji}</span>{s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-auto">
        <button
          onClick={() => { haptic(10); setDone(true) }}
          className="w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          Let's go →
        </button>
        <button
          onClick={() => { haptic(4); setGender(''); setTravelStyles([]); setDone(true) }}
          className="w-full py-3 text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Skip for now
        </button>
      </div>
    </div>,
  ]

  return (
    <main className="min-h-screen bg-black flex flex-col">
      {/* Preview banner — always visible so this never gets mistaken for the real flow */}
      <div
        className="text-center py-1.5 text-[11px] font-semibold tracking-wide"
        style={{ backgroundColor: '#F0EBE3', color: '#000' }}
      >
        PREVIEW MODE — nothing here is saved
      </div>

      <div
        className="flex-1 flex flex-col max-w-sm mx-auto w-full px-6 min-h-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          {step > 0 ? (
            <button
              onClick={() => { haptic(6); setDirection(-1); setStep(s => s - 1) }}
              className="text-white/28 text-sm active:opacity-60 transition-opacity"
            >
              ← Back
            </button>
          ) : <span />}
          <button onClick={exit} className="text-white/28 text-sm active:opacity-60 transition-opacity">
            Exit ✕
          </button>
        </div>

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
    </main>
  )
}
