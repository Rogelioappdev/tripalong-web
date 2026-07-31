'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { haptic } from '@/lib/haptics'
import styles from './TripDateRangePicker.module.css'

interface TripDateRangePickerProps {
  /** ISO `YYYY-MM-DD`, or '' if unset — same convention as CreateTripModal's startDate/endDate. */
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
}

// Builds a local-midnight Date from a `YYYY-MM-DD` string (no UTC shift —
// matches the native `<input type="date">` value semantics CreateTripModal
// already relies on for start_date/end_date).
function fromIsoDate(value: string): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Collapsed-by-default "or pick exact dates" link below the season chips on
// the 'location' step's optional trip-teaser section. Expands into a real
// react-day-picker (v10) range calendar, themed dark/cream via CSS variables
// + targeted class overrides in TripDateRangePicker.module.css (the package
// ships light-theme default CSS with no dark mode of its own). Once a full
// range is picked it collapses back into a compact "Aug 14 – Aug 22"
// confirmation with a "Change" link — the season chips stay the fast default
// for everyone else, this is purely additive.
export function TripDateRangePicker({ startDate, endDate, onChange }: TripDateRangePickerProps) {
  const [expanded, setExpanded] = useState(false)
  const hasRange = !!startDate && !!endDate

  const selectedRange: DateRange | undefined = (() => {
    const from = fromIsoDate(startDate)
    const to = fromIsoDate(endDate)
    if (!from) return undefined
    return { from, to }
  })()

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange('', '')
      return
    }
    onChange(toIsoDate(range.from), range.to ? toIsoDate(range.to) : '')
    if (range.from && range.to) {
      // Full range picked — collapse back down to the compact confirmation.
      haptic(8)
      setExpanded(false)
    }
  }

  const handleChangeClick = () => {
    haptic(6)
    onChange('', '')
    setExpanded(true)
  }

  if (hasRange && !expanded) {
    const from = fromIsoDate(startDate)
    const to = fromIsoDate(endDate)
    if (from && to) {
      return (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/12 bg-white/6 px-4 py-3.5">
          <span className="text-white text-sm font-semibold">
            {formatShort(from)} – {formatShort(to)}
          </span>
          <button
            type="button"
            onClick={handleChangeClick}
            className="text-xs font-bold active:opacity-60 transition-opacity"
            style={{ color: '#F0EBE3' }}
          >
            Change
          </button>
        </div>
      )
    }
  }

  return (
    <div className="mt-3">
      {!expanded && (
        <button
          type="button"
          onClick={() => { haptic(6); setExpanded(true) }}
          className="text-white/40 text-xs font-medium underline underline-offset-2 active:opacity-60 transition-opacity"
        >
          or pick exact dates
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-white/12 bg-black p-3 flex justify-center">
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={handleSelect}
                disabled={{ before: new Date() }}
                numberOfMonths={1}
                className={styles.calendar}
              />
            </div>
            <button
              type="button"
              onClick={() => { haptic(4); setExpanded(false) }}
              className="mt-2 text-white/30 text-xs active:opacity-60 transition-opacity"
            >
              Hide calendar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
