'use client'

// Horizontal row of liquid-glass filter chips shown under the TripAlong World
// title. Each chip opens a FilterSheet editor for its dimension; active chips
// flip to a cream accent fill showing their current value. Reusable on the feed.

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import {
  type FilterDimension, type TripFilters, EMPTY_FILTERS,
  isDimensionActive, activeFilterCount, chipValueLabel,
} from '@/lib/tripFilters'
import type { TripWithDetails } from '@/lib/types'
import { FilterSheet } from './FilterSheet'

const DIMENSION_LABELS: { dim: FilterDimension; label: string }[] = [
  { dim: 'location', label: 'Location' },
  { dim: 'seasons', label: 'Date' },
  { dim: 'styles', label: 'Styles' },
  { dim: 'genders', label: 'Gender' },
  { dim: 'ageRange', label: 'Age' },
]

export function FilterBar({
  filters, onChange, trips, dimensions,
}: {
  filters: TripFilters
  onChange: (f: TripFilters) => void
  trips: TripWithDetails[]
  // Which filter chips to show. Defaults to all; World omits 'location' since
  // you can already spin the globe to a place.
  dimensions?: FilterDimension[]
}) {
  const [openDim, setOpenDim] = useState<FilterDimension | null>(null)
  const anyActive = activeFilterCount(filters) > 0
  const shown = dimensions
    ? DIMENSION_LABELS.filter(d => dimensions.includes(d.dim))
    : DIMENSION_LABELS

  return (
    <>
      <div
        className="flex items-center gap-2 overflow-x-auto pointer-events-auto px-5 py-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', maskImage: 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)' }}
      >
        {anyActive && (
          <button
            type="button"
            onClick={() => { haptic(8); onChange(EMPTY_FILTERS) }}
            className="shrink-0 flex items-center justify-center rounded-full font-semibold"
            style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.14)', color: '#F0EBE3', fontSize: 14, backdropFilter: 'blur(24px) saturate(1.5)' }}
            aria-label="Clear filters"
          >
            ✕
          </button>
        )}
        {shown.map(({ dim, label }) => {
          const active = isDimensionActive(filters, dim)
          const value = active ? chipValueLabel(dim, filters) : null
          return (
            <button
              key={dim}
              type="button"
              onClick={() => { haptic(6); setOpenDim(dim) }}
              className="shrink-0 whitespace-nowrap font-semibold transition-colors active:scale-95"
              style={{
                fontSize: 13,
                padding: '7px 14px',
                borderRadius: 16,
                ...(active
                  ? { background: '#F0EBE3', color: '#0a0a0a', border: '0.5px solid transparent' }
                  : { background: 'rgba(255,255,255,0.07)', color: '#F0EBE3', border: '0.5px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(24px) saturate(1.5)', WebkitBackdropFilter: 'blur(24px) saturate(1.5)' }),
              }}
            >
              {value ?? label}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {openDim && (
          <FilterSheet
            dim={openDim}
            filters={filters}
            trips={trips}
            onChange={onChange}
            onClose={() => setOpenDim(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
