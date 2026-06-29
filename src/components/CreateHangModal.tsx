'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { createHangalong } from '@/lib/queries'
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
  { value: 'this_weekend', label: 'This Weekend',  sub: 'Sat or Sun' },
  { value: 'this_week',    label: 'This Week',     sub: 'Next 7 days' },
]

export function CreateHangModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(0)
  const [activity, setActivity] = useState<ActivityType | null>(null)
  const [when, setWhen] = useState<WhenLabel | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [maxPeople, setMaxPeople] = useState(4)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!activity || !when || !title.trim() || !location.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const id = await createHangalong({
        title: title.trim(),
        description: description.trim() || undefined,
        activity_type: activity,
        location_name: location.trim(),
        when_label: when,
        max_people: maxPeople,
      })
      if (!id) throw new Error('Failed to create')
      haptic(20)
      onCreated()
      onClose()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canNext0 = !!activity
  const canNext1 = !!when
  const canNext2 = title.trim().length > 0 && location.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <button
          onClick={() => { haptic(6); step > 0 ? setStep(s => s - 1) : onClose() }}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: i === step ? 20 : 6, backgroundColor: i <= step ? '#fff' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-white font-extrabold text-2xl mb-1">What's the vibe?</h2>
              <p className="text-white/40 text-sm mb-6">Pick what you want to do</p>
              <div className="grid grid-cols-3 gap-3">
                {ACTIVITIES.map(a => (
                  <button
                    key={a.type}
                    onClick={() => { haptic(8); setActivity(a.type) }}
                    className="flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-95"
                    style={{
                      backgroundColor: activity === a.type ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
                      border: activity === a.type ? '1.5px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span style={{ fontSize: 30 }}>{a.emoji}</span>
                    <span className="text-white text-xs font-semibold">{a.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-white font-extrabold text-2xl mb-1">When?</h2>
              <p className="text-white/40 text-sm mb-6">Pick the time window</p>
              <div className="flex flex-col gap-3">
                {WHEN_OPTIONS.map(w => (
                  <button
                    key={w.value}
                    onClick={() => { haptic(8); setWhen(w.value) }}
                    className="flex items-center justify-between px-5 py-4 rounded-2xl transition-all active:scale-[0.98]"
                    style={{
                      backgroundColor: when === w.value ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                      border: when === w.value ? '1.5px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="text-left">
                      <p className="text-white font-bold">{w.label}</p>
                      <p className="text-white/40 text-sm">{w.sub}</p>
                    </div>
                    {when === w.value && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-white font-extrabold text-2xl mb-1">The details</h2>
              <p className="text-white/40 text-sm mb-6">Tell people what you have in mind</p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-white/50 text-xs font-semibold tracking-wide uppercase mb-2 block">Title *</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Runyon Canyon hike at sunrise"
                    maxLength={80}
                    className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/25"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs font-semibold tracking-wide uppercase mb-2 block">Where *</label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Griffith Park area, LA"
                    maxLength={60}
                    className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/25"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs font-semibold tracking-wide uppercase mb-2 block">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Any details, skill level, what to bring..."
                    maxLength={300}
                    rows={3}
                    className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/25 resize-none"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs font-semibold tracking-wide uppercase mb-3 block">Max People</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setMaxPeople(p => Math.max(2, p - 1))}
                      className="w-10 h-10 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-white text-xl font-bold"
                    >−</button>
                    <span className="text-white font-bold text-2xl w-8 text-center">{maxPeople}</span>
                    <button
                      onClick={() => setMaxPeople(p => Math.min(12, p + 1))}
                      className="w-10 h-10 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-white text-xl font-bold"
                    >+</button>
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="px-5 pb-safe" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            haptic(10)
            if (step < 2) setStep(s => s + 1)
            else handleSubmit()
          }}
          disabled={
            (step === 0 && !canNext0) ||
            (step === 1 && !canNext1) ||
            (step === 2 && !canNext2) ||
            submitting
          }
          className="w-full h-14 rounded-2xl font-bold text-base transition-opacity disabled:opacity-30"
          style={{ backgroundColor: '#fff', color: '#000' }}
        >
          {submitting ? 'Posting...' : step < 2 ? 'Continue' : 'Post HangAlong'}
        </motion.button>
      </div>
    </motion.div>
  )
}
