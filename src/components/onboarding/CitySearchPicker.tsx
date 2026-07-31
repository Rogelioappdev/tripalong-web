'use client'

import { useEffect, useRef, useState } from 'react'

export interface CitySearchResult {
  city: string
  country: string
}

interface GeocodeMatch {
  name: string
  admin1?: string | null
  country?: string | null
}

interface CitySearchPickerProps {
  value: string
  onSelect: (result: CitySearchResult) => void
  placeholder: string
  autoFocus?: boolean
  className?: string
}

function formatMatch(m: GeocodeMatch): string {
  return [m.name, m.admin1, m.country].filter(Boolean).join(', ')
}

// Searchable city/country picker backed by /api/geocode?list=true (the free,
// keyless Open-Meteo geocoder — see src/app/api/geocode/route.ts). Debounces
// typed input, ignores stale in-flight responses via a monotonic request id,
// and only fires a fetch when the query was actually typed by the user (not
// when `value` is set from outside, e.g. on mount with a previously-saved
// value, or right after this component's own onSelect call updates it).
export function CitySearchPicker({ value, onSelect, placeholder, autoFocus, className }: CitySearchPickerProps) {
  const [query, setQuery] = useState(value)
  const [dirty, setDirty] = useState(false)
  const [results, setResults] = useState<GeocodeMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const requestIdRef = useRef(0)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Sync from the parent's confirmed value. This only ever changes on first
  // mount (a previously-saved value) or right after this component calls
  // onSelect itself — never mid-typing, since nothing else writes to it.
  useEffect(() => {
    setQuery(value)
    setDirty(false)
  }, [value])

  useEffect(() => {
    if (!dirty) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      requestIdRef.current++ // invalidate any in-flight fetch — its response is now stale
      setResults([])
      setLoading(false)
      return
    }
    const myRequestId = ++requestIdRef.current
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}&list=true`)
        .then(res => res.json())
        .then((data: { results?: GeocodeMatch[] }) => {
          if (!mountedRef.current || requestIdRef.current !== myRequestId) return // superseded by a newer query
          setResults(Array.isArray(data.results) ? data.results : [])
          setLoading(false)
        })
        .catch(() => {
          if (!mountedRef.current || requestIdRef.current !== myRequestId) return
          setResults([])
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [query, dirty])

  useEffect(() => () => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current) }, [])

  const handleSelect = (m: GeocodeMatch) => {
    if (blurTimeoutRef.current) { clearTimeout(blurTimeoutRef.current); blurTimeoutRef.current = null }
    const country = m.country ?? ''
    // Deliberately not setting `query` here. Different call sites format the
    // confirmed `value` differently (e.g. "City, Country" vs. just "City"),
    // so guessing the display text locally would flash-then-correct itself
    // the instant the parent re-renders with its own derived `value`. Letting
    // the `value`-sync effect above be the single source of truth avoids that
    // mismatch — onSelect below triggers the parent update, which lands here
    // as a new `value` prop within the next render.
    setDirty(false) // don't let dirty=true survive into that next render and fire a spurious search
    setOpen(false)
    setResults([])
    onSelect({ city: m.name, country })
  }

  const showDropdown = open && query.trim().length >= 2 && (loading || results.length > 0)

  return (
    <div className={`relative${className ? ` ${className}` : ''}`}>
      <input
        value={query}
        onChange={e => { setDirty(true); setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimeoutRef.current = setTimeout(() => setOpen(false), 150) }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-4 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 bg-[#141414] border border-white/12 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-white/30 text-xs">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-white/30 text-xs">No matches</div>
          )}
          {results.map((m, i) => (
            <button
              key={`${m.name}-${m.admin1 ?? ''}-${m.country ?? ''}-${i}`}
              type="button"
              onMouseDown={e => e.preventDefault()} // keep the input's blur from firing before this click registers
              onClick={() => handleSelect(m)}
              className="w-full text-left px-4 py-3 text-sm text-white/85 hover:bg-white/8 active:bg-white/10 transition-colors border-b border-white/6 last:border-b-0"
            >
              {formatMatch(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
