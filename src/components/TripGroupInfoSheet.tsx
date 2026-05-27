'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { leaveTripFromChat } from '@/lib/queries'
import { PublicProfileModal } from './PublicProfileModal'
import type { TripWithDetails } from '@/lib/types'

interface TripGroupInfoSheetProps {
  chatId: string
  tripInfo: TripWithDetails
  userId: string
  onClose: () => void
  onLeft: () => void
}

function formatDates(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

export function TripGroupInfoSheet({ chatId, tripInfo, userId, onClose, onLeft }: TripGroupInfoSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await leaveTripFromChat(tripInfo.id, chatId)
      onLeft()
    } catch (e) {
      console.error('Leave trip error', e)
      setLeaving(false)
      setConfirmLeave(false)
    }
  }

  if (!mounted) return null

  const members = tripInfo.members ?? []
  const dateStr = formatDates(tripInfo.start_date, tripInfo.end_date)

  const content = (
    <div className="fixed inset-0 z-[65] flex items-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full flex flex-col overflow-hidden"
        style={{ backgroundColor: '#000', borderRadius: '20px 20px 0 0', height: '90dvh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="rounded-full" style={{ width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Hero */}
          <div className="relative shrink-0" style={{ height: 180 }}>
            {tripInfo.cover_image ? (
              <img src={tripInfo.cover_image} alt={tripInfo.destination} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: '#111' }}>🌍</div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 30%, rgba(0,0,0,0.85) 100%)' }} />
            <div className="absolute bottom-0 left-0 px-5 pb-4">
              <p className="text-white font-bold" style={{ fontSize: 22 }}>{tripInfo.destination}</p>
              {tripInfo.country && (
                <div className="flex items-center gap-1 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
                    <circle cx="12" cy="10" r="3" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{tripInfo.country}</span>
                </div>
              )}
            </div>
          </div>

          {/* Info pills */}
          {(dateStr || tripInfo.budget_level || tripInfo.max_group_size > 0) && (
            <div className="flex gap-3 px-5 py-4 overflow-x-auto">
              {dateStr && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{dateStr}</span>
                </div>
              )}
              {tripInfo.budget_level && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 14 }}>💰</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textTransform: 'capitalize' }}>{tripInfo.budget_level}</span>
                </div>
              )}
              {tripInfo.max_group_size > 0 && (
                <div className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="8" r="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
                    <path d="M2 20c0-3.3 3.1-6 7-6" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="17" cy="9" r="3" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8"/>
                    <path d="M15 19c0-2.5 2-4 4-4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Up to {tripInfo.max_group_size}</span>
                </div>
              )}
            </div>
          )}

          {/* Members */}
          <div className="px-5 pb-6">
            <div className="flex items-center mb-3">
              <p className="text-white font-semibold" style={{ fontSize: 15 }}>Members</p>
              <span className="ml-2" style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>{members.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {members.map((member: any) => {
                const u = member.user
                if (!u) return null
                const isCreator = u.id === tripInfo.creator_id
                const isMe = u.id === userId
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { if (!isMe) setSelectedMemberId(u.id) }}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-transform"
                    style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)', cursor: isMe ? 'default' : 'pointer' }}
                  >
                    <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden shrink-0">
                      {u.profile_photo ? (
                        <img src={u.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {u.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white text-xs font-semibold truncate">{isMe ? 'You' : u.name}</p>
                      {isCreator && (
                        <p className="text-[10px] font-medium mt-0.5" style={{ color: '#F0EBE3', opacity: 0.55 }}>Creator</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Leave Trip */}
          <div className="px-5 pb-10">
            {confirmLeave ? (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0F0F0F', border: '1px solid rgba(255,69,58,0.3)' }}>
                <p className="text-white text-sm font-semibold text-center mb-3">Leave this trip group?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="flex-1 font-semibold text-sm rounded-xl py-2.5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={leaving}
                    className="flex-1 font-semibold text-sm rounded-xl py-2.5 disabled:opacity-50"
                    style={{ backgroundColor: '#FF453A', color: '#fff' }}
                  >
                    {leaving ? 'Leaving...' : 'Leave Trip'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="w-full font-semibold text-sm rounded-2xl py-3.5 transition-opacity hover:opacity-80"
                style={{ color: '#FF453A', border: '1px solid rgba(255,69,58,0.3)' }}
              >
                Leave Trip
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Member profile — portals to body at z-[70], sits above sheet */}
      {selectedMemberId && (
        <PublicProfileModal userId={selectedMemberId} onClose={() => setSelectedMemberId(null)} />
      )}
    </div>
  )

  return createPortal(content, document.body)
}
