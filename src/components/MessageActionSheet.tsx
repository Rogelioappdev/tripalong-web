'use client'

import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { TripMessage } from '@/lib/types'

const REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👍']

interface Props {
  msg: TripMessage
  isMe: boolean
  myReactions: string[]
  onClose: () => void
  onReact: (emoji: string) => void
  onReply: () => void
  onCopy: () => void
  onDelete: () => void
  onReport: () => void
  onInfo?: () => void
}

export function MessageActionSheet({ msg, isMe, myReactions, onClose, onReact, onReply, onCopy, onDelete, onReport, onInfo }: Props) {
  const actions = [
    { label: 'Reply', icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 0 10h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ), onClick: onReply },
    { label: 'Copy', icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/></svg>
    ), onClick: onCopy },
    ...(isMe && onInfo
      ? [{ label: 'Info', icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 16v-5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ), onClick: onInfo }]
      : []),
    isMe
      ? { label: 'Delete', icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2"/></svg>
        ), onClick: onDelete, danger: true }
      : { label: 'Report', icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        ), onClick: onReport, danger: true },
  ]

  const content = (
    <div
      className="fixed inset-0 z-[80] flex items-end"
      onPointerDown={onClose}
    >
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
        {/* Message preview */}
        {msg.type === 'text' && (
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
            <p className="text-white/40 text-xs leading-snug line-clamp-2">{msg.content}</p>
          </div>
        )}

        {/* Emoji reactions */}
        <div className="flex justify-around px-4 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {REACTIONS.map(emoji => {
            const active = myReactions.includes(emoji)
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => { onReact(emoji); onClose() }}
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                style={{ fontSize: 28 }}
              >
                <span>{emoji}</span>
                {active && (
                  <span
                    className="block rounded-full"
                    style={{ width: 5, height: 5, backgroundColor: '#F0EBE3' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Action rows */}
        <div className="py-1">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => { action.onClick(); onClose() }}
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
      </motion.div>
    </div>
  )

  return createPortal(content, document.body)
}
