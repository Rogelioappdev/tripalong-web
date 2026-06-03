'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { reportUser, blockUser } from '@/lib/queries'
import { haptic } from '@/lib/haptics'

const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or threats', icon: '⚠️' },
  { id: 'spam', label: 'Spam or scam', icon: '🚫' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: '🔞' },
  { id: 'hate', label: 'Hate speech', icon: '🛑' },
  { id: 'other', label: 'Something else', icon: '💬' },
]

interface Props {
  senderId: string
  senderName: string
  messageContent: string
  onClose: () => void
}

type Phase = 'report' | 'success'

export function ReportMessageSheet({ senderId, senderName, messageContent, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('report')
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const handleSubmit = async () => {
    if (!selectedReason) return
    setLoading(true)
    const fullDetails = [
      `Message: "${messageContent.slice(0, 300)}"`,
      details.trim() || null,
    ].filter(Boolean).join('\n\n')
    await reportUser(senderId, selectedReason, fullDetails)
    setLoading(false)
    haptic([10, 20, 10])
    setPhase('success')
  }

  const handleBlock = async () => {
    setBlocking(true)
    await blockUser(senderId)
    setBlocking(false)
    setBlocked(true)
  }

  const content = (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center"
      onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />

      <motion.div
        className="relative w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: '#111' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        <AnimatePresence mode="wait" initial={false}>

          {phase === 'report' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="px-5 pt-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
              <p className="text-white font-bold text-lg mb-1">Report Message</p>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                What's wrong with this message from {senderName}?
              </p>

              {/* Message preview */}
              <div
                className="rounded-2xl px-4 py-3 mb-5"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.09)' }}
              >
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{senderName}</p>
                <p className="text-sm leading-snug line-clamp-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {messageContent}
                </p>
              </div>

              {/* Reasons */}
              <div className="flex flex-col gap-2 mb-4">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { haptic(6); setSelectedReason(r.id) }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
                    style={{
                      backgroundColor: selectedReason === r.id ? 'rgba(240,235,227,0.1)' : 'rgba(255,255,255,0.04)',
                      border: selectedReason === r.id ? '1px solid rgba(240,235,227,0.25)' : '0.5px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span>{r.icon}</span>
                    <span className="text-sm font-medium" style={{ color: selectedReason === r.id ? '#F0EBE3' : 'rgba(255,255,255,0.65)' }}>
                      {r.label}
                    </span>
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
                  onClick={onClose}
                  className="flex-1 py-4 rounded-2xl font-semibold text-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedReason || loading}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#F0EBE3', color: '#000' }}
                >
                  {loading ? 'Submitting…' : 'Report'}
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-5 pt-6 flex flex-col items-center text-center gap-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(48,209,88,0.12)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-lg">Message reported</p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Thank you — we'll review it and take action if it violates our community guidelines.
                </p>
              </div>

              {/* Optional block */}
              {!blocked ? (
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={blocking}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-opacity active:opacity-70 disabled:opacity-40"
                  style={{ backgroundColor: 'rgba(255,59,48,0.1)', border: '0.5px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}
                >
                  {blocking ? 'Blocking…' : `Also block ${senderName}`}
                </button>
              ) : (
                <div className="w-full py-3 rounded-2xl text-center text-sm font-medium"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
                  {senderName} blocked
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-bold text-sm"
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

  return createPortal(content, document.body)
}
