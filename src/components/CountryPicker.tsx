'use client'

import { useState, useRef, useEffect } from 'react'
import { COUNTRIES, countryFlag, getFlag } from '@/lib/countries'

interface CountryPickerProps {
  items: string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  saving?: boolean
  saved?: boolean
  addLabel?: string
  chipColor?: string
}

export function CountryPicker({
  items, onAdd, onRemove, saving, saved,
  addLabel = '+ Add country',
  chipColor = 'rgba(255,255,255,0.08)',
}: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = query.length === 0
    ? COUNTRIES
    : COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  const close = () => { setOpen(false); setQuery('') }

  return (
    <div>
      {/* Selected chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {items.map(name => (
            <div key={name}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
              style={{ background: chipColor }}>
              <span>{getFlag(name)}</span>
              <span className="text-white">{name}</span>
              <button type="button" onClick={() => onRemove(name)}
                className="ml-0.5 leading-none transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>✕</button>
            </div>
          ))}
          {saving && (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin self-center" />
          )}
          {saved && !saving && (
            <span className="text-green-400 text-xs self-center">Saved ✓</span>
          )}
        </div>
      )}

      {/* Picker */}
      {open ? (
        <div>
          {/* Search input */}
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-1"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15 }}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/25"
              style={{ fontSize: 16 }}
            />
            <button type="button" onClick={close}
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.07)' }}>
              Done
            </button>
          </div>

          {/* Country list */}
          <div className="overflow-y-auto rounded-2xl"
            style={{ maxHeight: 232, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No countries found
              </p>
            ) : (
              filtered.map((c, idx) => {
                const added = items.includes(c.name)
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { if (!added) { onAdd(c.name); setQuery('') } else { onRemove(c.name) } }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: added ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <span className="text-xl leading-none">{countryFlag(c.code)}</span>
                    <span className="text-sm flex-1" style={{ color: added ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)' }}>
                      {c.name}
                    </span>
                    {added && (
                      <span className="text-xs font-semibold" style={{ color: '#30D158' }}>✓</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="text-xs px-3 py-1.5 rounded-full border transition-colors"
          style={{
            color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}>
          {addLabel}
        </button>
      )}
    </div>
  )
}
