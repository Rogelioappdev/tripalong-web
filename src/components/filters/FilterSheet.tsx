'use client'

// Bottom sheet that edits one filter dimension at a time. Selections apply live
// (onChange fires immediately) so the globe re-filters behind the sheet. Modeled
// on TripClusterSheet's spring slide-up + drag-to-dismiss.

import { motion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '@/lib/haptics'
import { VIBES, GROUP_PREFS, SEASONS } from '@/lib/tripOptions'
import {
  AGE_MIN, AGE_MAX, type FilterDimension, type TripFilters, isDimensionActive,
} from '@/lib/tripFilters'
import type { TripWithDetails } from '@/lib/types'

const TITLES: Record<FilterDimension, string> = {
  location: 'Location',
  seasons: 'When',
  styles: 'Travel styles',
  genders: "Who it's for",
  ageRange: 'Age',
}

const toggle = (arr: string[], v: string) =>
  arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => { haptic(5); onClick() }}
      className="px-3.5 py-2 rounded-2xl text-[13px] font-semibold transition-colors active:scale-95"
      style={
        active
          ? { background: '#F0EBE3', color: '#0a0a0a' }
          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.82)', border: '0.5px solid rgba(255,255,255,0.12)' }
      }
    >
      {children}
    </button>
  )
}

export function FilterSheet({
  dim, filters, trips, onChange, onClose,
}: {
  dim: FilterDimension
  filters: TripFilters
  trips: TripWithDetails[]
  onChange: (f: TripFilters) => void
  onClose: () => void
}) {
  const [locQuery, setLocQuery] = useState(filters.location ?? '')

  // Most common countries in the current trip set → quick-pick chips.
  const topCountries = useMemo(() => {
    const counts = new Map<string, number>()
    trips.forEach(t => { if (t.country) counts.set(t.country, (counts.get(t.country) ?? 0) + 1) })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0])
  }, [trips])

  const age = filters.ageRange ?? [AGE_MIN, AGE_MAX]
  const setAge = (lo: number, hi: number) => {
    const full = lo <= AGE_MIN && hi >= AGE_MAX
    onChange({ ...filters, ageRange: full ? null : [lo, hi] })
  }

  // Custom calendar range for the Date dimension (sits alongside the seasons).
  const dr = filters.dateRange ?? ['', '']
  const setDate = (idx: 0 | 1, val: string) => {
    const next: [string, string] = idx === 0 ? [val, dr[1]] : [dr[0], val]
    onChange({ ...filters, dateRange: next[0] || next[1] ? next : null })
  }

  const clearDim = () => {
    if (dim === 'location') { setLocQuery(''); onChange({ ...filters, location: null }) }
    else if (dim === 'ageRange') onChange({ ...filters, ageRange: null })
    else if (dim === 'seasons') onChange({ ...filters, seasons: [], dateRange: null })
    else onChange({ ...filters, [dim]: [] })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
      <motion.div
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 90, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={e => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => { if (info.offset.y > 90) onClose() }}
        className="relative w-full max-w-md mx-3 rounded-3xl overflow-hidden"
        style={{ marginBottom: 96, background: '#0c0c0c', border: '0.5px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 44px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[#F0EBE3] text-base font-semibold">{TITLES[dim]}</h2>
          <div className="flex items-center gap-2">
            {isDimensionActive(filters, dim) && (
              <button type="button" onClick={() => { haptic(6); clearDim() }} className="text-white/45 text-xs font-medium px-2 py-1 active:opacity-60">
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => { haptic(8); onClose() }}
              className="rounded-full font-semibold text-[13px] px-4 py-1.5"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#F0EBE3' }}
            >
              Done
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          {dim === 'location' && (
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                value={locQuery}
                onChange={e => { setLocQuery(e.target.value); onChange({ ...filters, location: e.target.value || null }) }}
                placeholder="Search a country or city…"
                className="w-full rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              {topCountries.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {topCountries.map(c => (
                    <Chip
                      key={c}
                      active={(filters.location ?? '').toLowerCase() === c.toLowerCase()}
                      onClick={() => { setLocQuery(c); onChange({ ...filters, location: c }) }}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {dim === 'seasons' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap gap-2">
                {SEASONS.map(s => (
                  <Chip key={s} active={filters.seasons.includes(s)} onClick={() => onChange({ ...filters, seasons: toggle(filters.seasons, s) })}>
                    {s}
                  </Chip>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <span className="text-white/35 text-[11px] font-medium">or pick exact dates</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wide mb-1.5">From</p>
                  <input
                    type="date"
                    value={dr[0]}
                    onChange={e => setDate(0, e.target.value)}
                    className="w-full rounded-2xl px-3.5 py-3 text-white/70 text-sm outline-none [color-scheme:dark]"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wide mb-1.5">To</p>
                  <input
                    type="date"
                    value={dr[1]}
                    min={dr[0] || undefined}
                    onChange={e => setDate(1, e.target.value)}
                    className="w-full rounded-2xl px-3.5 py-3 text-white/70 text-sm outline-none [color-scheme:dark]"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {dim === 'styles' && (
            <div className="flex flex-wrap gap-2">
              {VIBES.map(v => (
                <Chip key={v.value} active={filters.styles.includes(v.value)} onClick={() => onChange({ ...filters, styles: toggle(filters.styles, v.value) })}>
                  <span className="mr-1">{v.emoji}</span>{v.label}
                </Chip>
              ))}
            </div>
          )}

          {dim === 'genders' && (
            <div className="flex flex-col gap-2.5">
              <p className="text-white/40 text-xs">Show trips open to…</p>
              <div className="flex flex-wrap gap-2">
                {GROUP_PREFS.map(g => (
                  <Chip key={g.value} active={filters.genders.includes(g.value)} onClick={() => onChange({ ...filters, genders: toggle(filters.genders, g.value) })}>
                    <span className="mr-1">{g.emoji}</span>{g.value === 'everyone' ? 'Open to all' : g.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {dim === 'ageRange' && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-baseline justify-between">
                <span className="text-white/45 text-xs">Trips welcoming ages</span>
                <span className="text-[#F0EBE3] text-sm font-semibold">
                  {age[0]}{age[1] >= AGE_MAX ? '+' : `–${age[1]}`}
                </span>
              </div>
              <div className="ta-age-range relative h-6 flex items-center">
                <div className="absolute left-0 right-0 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.14)' }} />
                <div
                  className="absolute h-1 rounded-full"
                  style={{
                    background: '#F0EBE3',
                    left: `${((age[0] - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100}%`,
                    right: `${100 - ((age[1] - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100}%`,
                  }}
                />
                <input
                  type="range" min={AGE_MIN} max={AGE_MAX} value={age[0]}
                  onChange={e => setAge(Math.min(+e.target.value, age[1]), age[1])}
                  style={{ zIndex: age[0] >= AGE_MAX - 4 ? 4 : 3 }}
                />
                <input
                  type="range" min={AGE_MIN} max={AGE_MAX} value={age[1]}
                  onChange={e => setAge(age[0], Math.max(+e.target.value, age[0]))}
                />
              </div>
              <style>{`
                .ta-age-range input[type=range]{
                  position:absolute; left:0; right:0; width:100%; margin:0; height:24px;
                  background:transparent; pointer-events:none; -webkit-appearance:none; appearance:none;
                }
                .ta-age-range input[type=range]::-webkit-slider-thumb{
                  -webkit-appearance:none; pointer-events:auto; height:22px; width:22px; border-radius:50%;
                  background:#F0EBE3; border:2px solid #0c0c0c; box-shadow:0 1px 4px rgba(0,0,0,0.5); cursor:pointer;
                }
                .ta-age-range input[type=range]::-moz-range-thumb{
                  pointer-events:auto; height:22px; width:22px; border-radius:50%;
                  background:#F0EBE3; border:2px solid #0c0c0c; cursor:pointer;
                }
              `}</style>
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
