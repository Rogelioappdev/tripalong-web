'use client'

// Long-press context menu for a row on the Messages list. Group chats get
// Mute/Unmute + Leave; DMs get Mute/Unmute + Delete. "Select" hands off to the
// list's bulk multi-select mode instead of acting immediately.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/haptics'

interface Props {
  kind: 'group' | 'dm'
  title: string
  subtitle?: string | null
  avatar: React.ReactNode
  isMuted: boolean
  onClose: () => void
  onToggleMute: () => void
  onSelect: () => void
  onConfirm: () => void
}

export function ConversationActionSheet({ kind, title, subtitle, avatar, isMuted, onClose, onToggleMute, onSelect, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false)
  const destructiveLabel = kind === 'group' ? 'Leave' : 'Delete'

  const actions = [
    {
      label: isMuted ? 'Unmute' : 'Mute',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          {isMuted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}
        </svg>
      ),
      onClick: () => { onToggleMute(); onClose() },
    },
    {
      label: 'Select',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      onClick: onSelect,
    },
    {
      label: destructiveLabel,
      icon: kind === 'group' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2"/></svg>
      ),
      onClick: () => setConfirming(true),
      danger: true,
    },
  ]

  const content = (
    <div className="fixed inset-0 z-[80] flex items-end" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 42 }}
        className="relative w-full sm:max-w-lg sm:mx-auto rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: '#141414', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white/8 flex items-center justify-center">{avatar}</div>
          <div className="min-w-0 text-left">
            <p className="text-white text-sm font-semibold truncate">{title}</p>
            {subtitle && <p className="text-white/40 text-xs truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {confirming ? (
          <div className="px-5 pt-4" style={{ paddingBottom: 8 }}>
            <p className="text-white text-sm font-semibold text-center mb-1">
              {kind === 'group' ? 'Leave this chat?' : 'Delete this conversation?'}
            </p>
            <p className="text-white/40 text-xs text-center mb-4">
              {kind === 'group'
                ? "You'll stop receiving messages and won't be able to rejoin without a new invite."
                : 'This only removes it from your list — the other person keeps their messages.'}
            </p>
            <div className="flex gap-3 pb-2">
              <button
                type="button"
                onClick={() => { haptic(8); setConfirming(false) }}
                className="flex-1 font-semibold text-sm rounded-xl py-2.5 active:scale-95 transition-transform"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { haptic(18); onConfirm() }}
                className="flex-1 font-semibold text-sm rounded-xl py-2.5 active:scale-95 transition-transform"
                style={{ backgroundColor: '#FF453A', color: '#fff' }}
              >
                {destructiveLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {actions.map(action => (
              <button
                key={action.label}
                type="button"
                onClick={() => { haptic(8); action.onClick() }}
                className="w-full flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/5 active:bg-white/5"
                style={{ color: action.danger ? '#FF453A' : 'rgba(255,255,255,0.85)' }}
              >
                <span style={{ color: action.danger ? '#FF453A' : 'rgba(255,255,255,0.45)' }}>
                  {action.icon}
                </span>
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
