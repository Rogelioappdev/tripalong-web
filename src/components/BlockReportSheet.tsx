'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { blockUser, reportUser } from '@/lib/queries'

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam', icon: '🚫' },
  { id: 'harassment', label: 'Harassment or bullying', icon: '⚠️' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: '🔞' },
  { id: 'fake', label: 'Fake or impersonation', icon: '🎭' },
  { id: 'other', label: 'Something else', icon: '💬' },
]

type Phase = 'options' | 'block-confirm' | 'report' | 'success'

interface Props {
  userId: string
  userName: string
  userPhoto?: string | null
  onClose: () => void
  onBlocked?: () => void
}

export function BlockReportSheet({ userId, userName, userPhoto, onClose, onBlocked }: Props) {
  const [phase, setPhase] = useState<Phase>('options')
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleBlock = async () => {
    setLoading(true)
    await blockUser(userId)
    setLoading(false)
    setSuccessMsg(`${userName} has been blocked.`)
    setPhase('success')
    onBlocked?.()
  }

  const handleReport = async () => {
    if (!selectedReason) return
    setLoading(true)
    await reportUser(userId, selectedReason, details.trim() || undefined)
    setLoading(false)
    setSuccessMsg("Thanks for the report. We'll review it shortly.")
    setPhase('success')
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: '#111' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        <AnimatePresence mode="wait" initial={false}>

          {/* ── Options ── */}
          {phase === 'options' && (
            <motion.div key="options" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
              {/* User row */}
              <div className="flex items-center gap-3 px-5 pt-3 pb-5">
                <div className="w-11 h-11 rounded-full bg-white/10 overflow-hidden shrink-0">
                  {userPhoto
                    ? <img src={userPhoto} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-bold text-white/40">{userName?.[0]?.toUpperCase()}</div>
                  }
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{userName}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>TripAlong member</p>
                </div>
              </div>

              <div className="px-4 flex flex-col gap-2 pb-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                {/* Block */}
                <button
                  type="button"
                  onClick={() => setPhase('block-confirm')}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-opacity active:opacity-70"
                  style={{ backgroundColor: 'rgba(255,59,48,0.1)', border: '0.5px solid rgba(255,59,48,0.2)' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,59,48,0.15)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#FF3B30" strokeWidth="2"/>
                      <path d="M5.636 5.636l12.728 12.728" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm" style={{ color: '#FF3B30' }}>Block {userName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,59,48,0.6)' }}>They can't message you or see your profile</p>
                  </div>
                </button>

                {/* Report */}
                <button
                  type="button"
                  onClick={() => setPhase('report')}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-opacity active:opacity-70"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="4" y1="22" x2="4" y2="15" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm text-white">Report {userName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Something feels off or unsafe</p>
                  </div>
                </button>

                {/* Cancel */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl font-semibold text-sm transition-opacity active:opacity-70"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Block confirm ── */}
          {phase === 'block-confirm' && (
            <motion.div key="block-confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}
              className="px-5 pt-4 flex flex-col gap-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
              <div>
                <p className="text-white font-bold text-lg">Block {userName}?</p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  They won't be able to message you, and their trips won't appear in your feed.{'\n\n'}They will not be notified that you blocked them.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBlock}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-sm transition-opacity active:opacity-70 disabled:opacity-50"
                style={{ backgroundColor: '#FF3B30', color: '#fff' }}
              >
                {loading ? 'Blocking…' : `Block ${userName}`}
              </button>
              <button
                type="button"
                onClick={() => setPhase('options')}
                className="w-full py-4 rounded-2xl font-semibold text-sm transition-opacity active:opacity-70"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* ── Report ── */}
          {phase === 'report' && (
            <motion.div key="report" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}
              className="px-5 pt-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
              <p className="text-white font-bold text-lg mb-1">Report {userName}</p>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Why are you reporting this account?</p>

              <div className="flex flex-col gap-2 mb-4">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
                    style={{
                      backgroundColor: selectedReason === r.id ? 'rgba(240,235,227,0.1)' : 'rgba(255,255,255,0.04)',
                      border: selectedReason === r.id ? '1px solid rgba(240,235,227,0.25)' : '0.5px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span>{r.icon}</span>
                    <span className="text-sm font-medium" style={{ color: selectedReason === r.id ? '#F0EBE3' : 'rgba(255,255,255,0.65)' }}>{r.label}</span>
                    {selectedReason === r.id && (
                      <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#F0EBE3" opacity="0.2"/>
                        <path d="M8 12l3 3 5-5" stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {selectedReason === 'other' && (
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Tell us more (optional)…"
                  rows={3}
                  className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none resize-none mb-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', fontSize: 16 }}
                />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('options')}
                  className="flex-1 py-4 rounded-2xl font-semibold text-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={!selectedReason || loading}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#F0EBE3', color: '#000' }}
                >
                  {loading ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Success ── */}
          {phase === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="px-5 pt-6 pb-10 flex flex-col items-center text-center gap-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(48,209,88,0.12)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-bold text-lg">{successMsg}</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                TripAlong is a community built on trust. Thank you for helping keep it safe.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-bold text-sm mt-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#F0EBE3' }}
              >
                Done
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
