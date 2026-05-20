'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createTrip } from '@/lib/queries'

interface CreateTripModalProps {
  onClose: () => void
  userId: string | null
}

const VIBES = [
  { value: 'adventure', label: 'Adventure', emoji: '🏔️' },
  { value: 'chill', label: 'Chill', emoji: '😌' },
  { value: 'nature', label: 'Nature', emoji: '🌿' },
  { value: 'cultural', label: 'Culture', emoji: '🏛️' },
  { value: 'foodie', label: 'Food', emoji: '🍜' },
  { value: 'party', label: 'Party', emoji: '🎉' },
  { value: 'beach', label: 'Beach', emoji: '🌊' },
  { value: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { value: 'luxury', label: 'Luxury', emoji: '✨' },
  { value: 'road trip', label: 'Road Trip', emoji: '🚗' },
]

const SEASONS = ['Summer 2026', 'Fall 2026', 'Winter 2026', 'Spring 2027']
const GROUP_PREFS = [
  { value: 'everyone', label: '🌍 Everyone' },
  { value: 'female', label: '👩 Women only' },
  { value: 'male', label: '👨 Men only' },
]
const BUDGETS = [
  { value: 'budget', label: '💸 Budget' },
  { value: 'moderate', label: '💳 Moderate' },
  { value: 'luxury', label: '✨ Luxury' },
]
const PACES = [
  { value: 'slow', label: '☕ Relaxed' },
  { value: 'balanced', label: '⚖️ Balanced' },
  { value: 'fast', label: '⚡ Fast' },
]

export function CreateTripModal({ onClose, userId }: CreateTripModalProps) {
  const queryClient = useQueryClient()
  const [destination, setDestination] = useState('')
  const [country, setCountry] = useState('')
  const [vibes, setVibes] = useState<string[]>([])
  const [pace, setPace] = useState('')
  const [budget, setBudget] = useState('')
  const [groupPref, setGroupPref] = useState('everyone')
  const [groupSize, setGroupSize] = useState(6)
  const [description, setDescription] = useState('')
  const [season, setSeason] = useState('')
  const [flexDates, setFlexDates] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleVibe = (v: string) => {
    setVibes(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : prev.length < 3 ? [...prev, v] : prev
    )
  }

  const isValid = destination.trim() && country.trim() && vibes.length > 0 && pace && (season || flexDates || startDate)

  const handleCreate = async () => {
    if (!userId || !isValid) return
    setLoading(true)
    setError('')
    try {
      await createTrip({
        creator_id: userId,
        destination: destination.trim(),
        country: country.trim(),
        vibes,
        pace: pace as 'slow' | 'balanced' | 'fast',
        budget_level: budget || null,
        group_preference: groupPref as 'everyone' | 'male' | 'female',
        max_group_size: groupSize,
        description: description.trim() || null,
        is_flexible_dates: flexDates || !!season,
        start_date: season ? null : startDate || null,
        end_date: season ? null : endDate || null,
        status: 'planning',
        title: destination.trim(),
        images: [],
        cover_image: null,
      })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] bg-[#0a0a0a] sm:rounded-3xl rounded-t-3xl border border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8 shrink-0">
          <h2 className="text-white font-bold text-lg">Create Trip</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/60">✕</button>
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

          {/* Destination */}
          <div className="flex flex-col gap-3">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Destination *</label>
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="City or region"
              className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
            />
            <input
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="Country"
              className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
            />
          </div>

          {/* Dates */}
          <div className="flex flex-col gap-3">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Dates *</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setSeason(s === season ? '' : s); setFlexDates(false) }}
                  className={`px-3 py-2 rounded-2xl text-sm font-medium border transition-all ${
                    season === s ? 'bg-accent text-black border-transparent' : 'bg-white/6 text-white/60 border-white/12'
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => { setFlexDates(!flexDates); setSeason('') }}
                className={`px-3 py-2 rounded-2xl text-sm font-medium border transition-all ${
                  flexDates ? 'bg-accent text-black border-transparent' : 'bg-white/6 text-white/60 border-white/12'
                }`}
              >
                Flexible / TBD
              </button>
            </div>
            {!season && !flexDates && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-white/30 text-xs mb-1.5 block">Start date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 [color-scheme:dark]" />
                </div>
                <div className="flex-1">
                  <label className="text-white/30 text-xs mb-1.5 block">End date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 [color-scheme:dark]" />
                </div>
              </div>
            )}
          </div>

          {/* Vibes */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Vibes * </label>
              <span className="text-white/30 text-xs">{vibes.length}/3</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIBES.map(v => {
                const selected = vibes.includes(v.value)
                const maxed = vibes.length >= 3 && !selected
                return (
                  <button
                    key={v.value}
                    onClick={() => toggleVibe(v.value)}
                    disabled={maxed}
                    className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                      selected ? 'bg-accent text-black border-transparent' :
                      maxed ? 'bg-white/3 text-white/20 border-white/8' :
                      'bg-white/6 text-white/60 border-white/12'
                    }`}
                  >
                    {v.emoji} {v.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pace */}
          <div className="flex flex-col gap-3">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Daily Pace *</label>
            <div className="grid grid-cols-3 gap-2">
              {PACES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPace(p.value)}
                  className={`py-3 rounded-2xl text-sm font-semibold border transition-all ${
                    pace === p.value ? 'bg-white text-black border-transparent' : 'bg-white/6 text-white/60 border-white/12'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group */}
          <div className="flex flex-col gap-3">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Group</label>
            <div className="flex items-center gap-4 mb-1">
              <span className="text-white/60 text-sm">Max travelers</span>
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={() => setGroupSize(s => Math.max(2, s - 1))}
                  className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white font-bold text-lg">−</button>
                <span className="text-white font-bold text-lg w-6 text-center">{groupSize}</span>
                <button onClick={() => setGroupSize(s => Math.min(20, s + 1))}
                  className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white font-bold text-lg">+</button>
              </div>
            </div>
            <div className="flex gap-2">
              {GROUP_PREFS.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGroupPref(g.value)}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold border transition-all ${
                    groupPref === g.value ? 'bg-white text-black border-transparent' : 'bg-white/6 text-white/60 border-white/12'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="flex flex-col gap-3">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Budget</label>
            <div className="grid grid-cols-3 gap-2">
              {BUDGETS.map(b => (
                <button
                  key={b.value}
                  onClick={() => setBudget(budget === b.value ? '' : b.value)}
                  className={`py-3 rounded-2xl text-sm font-semibold border transition-all ${
                    budget === b.value ? 'bg-white text-black border-transparent' : 'bg-white/6 text-white/60 border-white/12'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-3">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell travelers what makes this trip special..."
              className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-white/8 shrink-0">
          <button
            onClick={handleCreate}
            disabled={!isValid || loading || !userId}
            className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-30 transition-opacity"
          >
            {loading ? 'Creating...' : 'Create Trip ✈️'}
          </button>
        </div>
      </div>
    </div>
  )
}
