'use client'

import { motion } from 'framer-motion'

const MOCK_VIBES = ['adventure', 'foodie', 'relaxed']

export function TripPreviewCard() {
  return (
    <div className="w-full flex flex-col items-center gap-5">
      <motion.div
        className="relative w-full max-w-[280px] aspect-[3/4.1] rounded-[26px] overflow-hidden"
        style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}
        animate={{ rotate: [0, -2.5, 0, 2.5, 0] }}
        transition={{ duration: 6, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(155deg, #4A3C6B 0%, #A85A6B 38%, #E0955B 68%, #F2C879 100%)' }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: 'radial-gradient(circle at 80% 15%, rgba(255,235,200,0.55), transparent 45%)' }}
        />
        <svg className="absolute bottom-0 left-0 right-0 w-full opacity-25" viewBox="0 0 300 100" fill="none">
          <path d="M0 60 Q 40 20 80 55 T 160 45 T 240 60 T 300 40 V100 H0 Z" fill="rgba(0,0,0,0.5)" />
        </svg>
        <span className="absolute bottom-[26%] right-[8%] text-4xl opacity-70">🌴</span>

        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 32%, rgba(0,0,0,0.68) 62%, rgba(0,0,0,0.95) 100%)',
        }} />

        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <div className="flex items-center gap-1 mb-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(240,235,227,0.7)" />
            </svg>
            <span className="text-[#F0EBE3]/70 text-[10px] font-medium tracking-wide">indonesia</span>
          </div>

          <h3 className="text-white font-extrabold leading-none mb-1.5 tracking-tight text-[26px]">Bali</h3>

          <div className="flex items-center gap-1.5 mb-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" />
              <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-white/50 text-[11px]">Aug 14 – Aug 22</span>
            <span className="text-white/25">·</span>
            <span className="text-white/50 text-[11px]">mid budget</span>
          </div>

          <p className="text-white/50 text-[11px] leading-snug mb-2.5 line-clamp-2">
            Chasing waterfalls, beach days, and good food with a small crew.
          </p>

          <div className="flex flex-wrap gap-1 mb-3">
            {MOCK_VIBES.map(v => (
              <span key={v} className="text-[10px] rounded-full px-2.5 py-1 font-semibold capitalize"
                style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3' }}>
                {v}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['M', 'J', 'K'].map((initial, i) => (
                <div key={initial} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-black"
                  style={{ backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 10 - i }}>
                  {initial}
                </div>
              ))}
            </div>
            <span className="text-white/50 text-[11px]">Maya +4 going</span>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center justify-center gap-7">
        {[
          { label: 'Pass', color: '#FF453A', path: 'M18 6L6 18M6 6l12 12', glow: false },
          { label: 'Join', color: '#30D158', path: 'M20 6L9 17l-5-5', glow: true },
          { label: 'Save', color: 'rgba(255,255,255,0.55)', path: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z', glow: false },
        ].map(btn => (
          <div key={btn.label} className="flex flex-col items-center gap-1">
            <motion.div
              className="w-10 h-10 rounded-full bg-[#161616] border border-white/10 flex items-center justify-center"
              animate={btn.glow ? { boxShadow: ['0 0 0px rgba(48,209,88,0)', '0 0 14px rgba(48,209,88,0.55)', '0 0 0px rgba(48,209,88,0)'] } : undefined}
              transition={btn.glow ? { duration: 1.4, repeat: Infinity, repeatDelay: 3.6, ease: 'easeInOut' } : undefined}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d={btn.path} stroke={btn.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <span className="text-white/30 text-[9px] font-semibold">{btn.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
