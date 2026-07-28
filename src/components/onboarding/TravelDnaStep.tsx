'use client'

import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import type { DnaDimension } from './dnaOptions'

export function TravelDnaStep({
  dimension,
  value,
  onToggle,
}: {
  dimension: DnaDimension
  value: string | string[]
  onToggle: (value: string) => void
}) {
  const isSelected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-white font-extrabold text-2xl leading-tight mb-1">{dimension.title}</h1>
        <p className="text-white/38 text-sm">{dimension.subtitle}</p>
      </div>

      {dimension.multi ? (
        <div className="flex flex-wrap gap-2">
          {dimension.options.map((opt, i) => {
            const selected = isSelected(opt.value)
            return (
              <motion.button
                key={opt.value}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 380, damping: 32 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => { haptic(8); onToggle(opt.value) }}
                className="px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors"
                style={selected
                  ? { backgroundColor: '#F0EBE3', color: '#000', borderColor: 'transparent' }
                  : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                {opt.emoji} {opt.label}
              </motion.button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dimension.options.map((opt, i) => {
            const selected = isSelected(opt.value)
            return (
              <motion.button
                key={opt.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 380, damping: 32 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { haptic(8); onToggle(opt.value) }}
                className="flex items-center gap-4 p-4 rounded-2xl border text-left"
                style={selected
                  ? { backgroundColor: 'rgba(240,235,227,0.1)', borderColor: 'rgba(240,235,227,0.5)' }
                  : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <span className="text-2xl shrink-0">{opt.emoji}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: selected ? '#F0EBE3' : '#fff' }}>{opt.label}</p>
                  {opt.desc && <p className="text-white/40 text-xs mt-0.5">{opt.desc}</p>}
                </div>
                {selected && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    width="18" height="18" viewBox="0 0 24 24" fill="none" className="ml-auto shrink-0"
                  >
                    <path d="M20 6L9 17l-5-5" stroke="#F0EBE3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                )}
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
