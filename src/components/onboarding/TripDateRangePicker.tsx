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
// the 'location' step's optional trip-teaser section. Opens a real
// react-day-picker (v10) range calendar as a FIXED, CENTERED MODAL OVERLAY —
// not inline-expanding content — so it's always fully visible in one frame
// regardless of scroll position or how much other content is on the step
// above it. (An earlier version expanded the calendar inline, which could
// render below the visible viewport with no obvious way to scroll to it —
// same fixed-overlay pattern as PhotoCropModal.tsx, for the same reason.)
// Once a full range is picked it closes and shows a compact "Aug 14 – Aug 22"
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
      // Full range picked — close the modal back down to the compact confirmation.
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
      <button
        type="button"
        onClick={() => { haptic(6); setExpanded(true) }}
        className="text-white/40 text-xs font-medium underline underline-offset-2 active:opacity-60 transition-opacity"
      >
        or pick exact dates
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => { haptic(4); setExpanded(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="w-full max-w-[340px] rounded-3xl border border-white/12 p-4"
              style={{ backgroundColor: '#0d0d0d' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-white font-bold text-sm">When&apos;s your trip?</span>
                <button
                  type="button"
                  onClick={() => { haptic(4); setExpanded(false) }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/50 active:opacity-60 transition-opacity"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="flex justify-center">
                <DayPicker
                  mode="range"
                  selected={selectedRange}
                  onSelect={handleSelect}
                  disabled={{ before: new Date() }}
                  numberOfMonths={1}
                  className={styles.calendar}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
