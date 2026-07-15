'use client'

import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

export interface MessageReceipt {
  id: string
  name: string
  photo: string | null
  seenAt: string | null // null = delivered but not yet read
}

interface Props {
  content: string
  isImage: boolean
  sentAt: string
  receipts: MessageReceipt[]
  onClose: () => void
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function MessageInfoSheet({ content, isImage, sentAt, receipts, onClose }: Props) {
  const read = receipts.filter(r => r.seenAt).sort((a, b) => (b.seenAt! > a.seenAt! ? 1 : -1))
  const delivered = receipts.filter(r => !r.seenAt)

  const content_ = (
    <div className="fixed inset-0 z-[85] flex items-end" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 42 }}
        className="relative w-full sm:max-w-lg sm:mx-auto rounded-t-3xl overflow-hidden max-h-[75vh] flex flex-col"
        style={{ backgroundColor: '#141414', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p className="text-white font-semibold text-sm mb-1">Message Info</p>
          <p className="text-white/40 text-xs leading-snug line-clamp-2">
            {isImage ? '📷 Photo' : content}
          </p>
          <p className="text-white/25 text-[11px] mt-1.5">Sent {formatTimestamp(sentAt)}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {read.length > 0 && (
            <div>
              <p className="px-5 pt-4 pb-1 text-white/30 text-[11px] font-semibold uppercase tracking-wider">Read by</p>
              {read.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/8 flex items-center justify-center">
                    {r.photo ? (
                      <img src={r.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/50 font-bold text-sm">{r.name[0]?.toUpperCase() ?? '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{r.name}</p>
                    <p className="text-white/30 text-[11px]">{formatTimestamp(r.seenAt!)}</p>
                  </div>
                  <svg width="16" height="12" viewBox="0 0 16 10" fill="none">
                    <path d="M1 5.5L3.5 8L8 1.5" stroke="#53bdeb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 5.5L7.5 8L12 1.5" stroke="#53bdeb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ))}
            </div>
          )}

          {delivered.length > 0 && (
            <div>
              <p className="px-5 pt-4 pb-1 text-white/30 text-[11px] font-semibold uppercase tracking-wider">Delivered</p>
              {delivered.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/8 flex items-center justify-center">
                    {r.photo ? (
                      <img src={r.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/50 font-bold text-sm">{r.name[0]?.toUpperCase() ?? '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{r.name}</p>
                  </div>
                  <svg width="16" height="12" viewBox="0 0 16 10" fill="none">
                    <path d="M1 5.5L3.5 8L8 1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 5.5L7.5 8L12 1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ))}
            </div>
          )}

          {receipts.length === 0 && (
            <p className="px-5 py-8 text-center text-white/25 text-sm">No one else has seen this yet</p>
          )}
        </div>
      </motion.div>
    </div>
  )

  return createPortal(content_, document.body)
}
