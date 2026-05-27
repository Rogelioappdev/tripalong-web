'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/lib/queries'
import type { UserProfile } from '@/lib/types'

interface PublicProfileModalProps {
  userId: string
  onClose: () => void
}

const TRAVEL_STYLES = [
  { id: 'luxury', label: 'Luxury', icon: '✨' },
  { id: 'backpacking', label: 'Backpacking', icon: '🎒' },
  { id: 'relaxed', label: 'Relaxed', icon: '🏖️' },
  { id: 'cultural', label: 'Cultural', icon: '🏛️' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'adventure', label: 'Adventure', icon: '🏔️' },
  { id: 'party', label: 'Party', icon: '🎉' },
  { id: 'foodie', label: 'Foodie', icon: '🍜' },
]

const PACE_OPTIONS    = [{ id: 'slow', label: 'Slow & Steady', emoji: '🐢' }, { id: 'balanced', label: 'Balanced', emoji: '⚖️' }, { id: 'fast', label: 'Go Go Go!', emoji: '🚀' }]
const PLANNING_OPT    = [{ id: 'planner', label: 'Planner', emoji: '📋' }, { id: 'spontaneous', label: 'Spontaneous', emoji: '🎲' }, { id: 'flexible', label: 'Flexible', emoji: '🤸' }]
const PERSONALITY_OPT = [{ id: 'introvert', label: 'Introvert', emoji: '🌙' }, { id: 'extrovert', label: 'Extrovert', emoji: '☀️' }, { id: 'ambivert', label: 'Ambivert', emoji: '🌗' }]
const EXPERIENCE_OPT  = [{ id: 'beginner', label: 'Beginner', emoji: '🌱' }, { id: 'intermediate', label: 'Intermediate', emoji: '🌿' }, { id: 'experienced', label: 'Experienced', emoji: '🌳' }, { id: 'expert', label: 'Expert', emoji: '🌍' }]

function label(opts: { id: string; label: string; emoji: string }[], id: string | null | undefined) {
  if (!id) return null
  const o = opts.find(x => x.id === id)
  return o ? `${o.emoji} ${o.label}` : null
}

function PrefTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-2.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginBottom: 3 }}>{title}</p>
      <p className="text-white font-medium text-sm">{value}</p>
    </div>
  )
}

export function PublicProfileModal({ userId, onClose }: PublicProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    setPhotoIndex(0)
    setSavedTrips([])
    getProfile(userId).then(p => { setProfile(p); setLoading(false) })
    supabase
      .from('saved_trips')
      .select('trip:trips!trip_id(id, destination, cover_image)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setSavedTrips((data ?? []).map((r: any) => r.trip).filter(Boolean)))
  }, [userId])

  if (!mounted) return null

  const content = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
        style={{ backgroundColor: '#000', borderRadius: '20px 20px 0 0', height: '100dvh' }}
      >
        {loading || !profile ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : (() => {
          const allPhotos = profile.photos?.length ? profile.photos : profile.profile_photo ? [profile.profile_photo] : []
          const mainPhoto = allPhotos[photoIndex] ?? null
          const travelStyles = profile.travel_styles ?? []
          const languages = profile.languages ?? []
          const placesVisited = profile.places_visited ?? []
          const bucketList = profile.bucket_list ?? []

          return (
            <>
              {/* ── Hero ── */}
              <div className="relative shrink-0" style={{ height: '45dvh' }}>
                {mainPhoto ? (
                  <img src={mainPhoto} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#111' }}>
                    <span className="text-white font-bold" style={{ fontSize: 64 }}>{profile.name?.[0]?.toUpperCase()}</span>
                  </div>
                )}

                {/* Gradient */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, rgba(0,0,0,0.95) 100%)' }} />

                {/* Photo dots */}
                {allPhotos.length > 1 && (
                  <div className="absolute flex justify-center gap-1.5 pointer-events-none" style={{ bottom: 88, left: 0, right: 0 }}>
                    {allPhotos.map((_, i) => (
                      <div key={i} className="rounded-full transition-all" style={{ width: i === photoIndex ? 24 : 8, height: 8, backgroundColor: i === photoIndex ? '#F0EBE3' : 'rgba(255,255,255,0.35)' }} />
                    ))}
                  </div>
                )}

                {/* Tap zones for photo navigation */}
                {allPhotos.length > 1 && photoIndex > 0 && (
                  <button type="button" className="absolute left-0 top-0 h-full w-1/3" onClick={() => setPhotoIndex(i => i - 1)} />
                )}
                {allPhotos.length > 1 && photoIndex < allPhotos.length - 1 && (
                  <button type="button" className="absolute right-0 top-0 h-full w-1/3" onClick={() => setPhotoIndex(i => i + 1)} />
                )}

                {/* Chevron-down close */}
                <button
                  onClick={onClose}
                  className="absolute flex items-center justify-center"
                  style={{ top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', border: '0.5px solid rgba(255,255,255,0.15)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Verified badge */}
                {profile.is_verified && (
                  <div className="absolute flex items-center gap-1 rounded-full px-3 py-1.5" style={{ top: 56, right: 16, backgroundColor: 'rgba(240,235,227,0.18)', border: '0.5px solid rgba(240,235,227,0.35)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="text-white text-xs font-semibold">Verified</span>
                  </div>
                )}

                {/* Name / age / location */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pointer-events-none">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-white font-bold" style={{ fontSize: 36 }}>{profile.name}</span>
                    {profile.age && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 28, fontWeight: 300 }}>{profile.age}</span>}
                  </div>
                  {(profile.city || profile.country) && (
                    <div className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#F0EBE3" strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke="#F0EBE3" strokeWidth="2"/></svg>
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="px-6 pt-6 pb-6 flex flex-col gap-7">

                  {/* Bio */}
                  {profile.bio && (
                    <div>
                      <p className="text-white font-semibold text-lg mb-3">About</p>
                      <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 15, lineHeight: '26px' }}>{profile.bio}</p>
                    </div>
                  )}

                  {/* Travel Style */}
                  {travelStyles.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>✨</span>
                        <p className="text-white font-semibold text-lg">Travel Style</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {travelStyles.map((s, i) => {
                          const st = TRAVEL_STYLES.find(x => x.id === s)
                          return (
                            <span key={i} className="font-medium rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '0.5px solid rgba(240,235,227,0.22)', color: '#F0EBE3', fontSize: 14 }}>
                              {st ? `${st.icon} ${st.label}` : s}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Travel Preferences */}
                  {(profile.gender || profile.travel_with || profile.social_energy || profile.travel_pace || profile.planning_style) && (
                    <div>
                      <p className="text-white font-semibold text-lg mb-3">Travel Preferences</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.gender && <PrefTile title="Gender" value={profile.gender === 'male' ? '👨 Man' : profile.gender === 'female' ? '👩 Woman' : '🌟 Non-binary'} />}
                        {profile.travel_with && <PrefTile title="Travels With" value={profile.travel_with === 'everyone' ? '🌍 Everyone' : profile.travel_with === 'female' ? '👩 Women Only' : '👨 Men Only'} />}
                        {label(PERSONALITY_OPT, profile.social_energy) && <PrefTile title="Personality" value={label(PERSONALITY_OPT, profile.social_energy)!} />}
                        {label(PACE_OPTIONS, profile.travel_pace) && <PrefTile title="Daily Pace" value={label(PACE_OPTIONS, profile.travel_pace)!} />}
                        {label(PLANNING_OPT, profile.planning_style) && <PrefTile title="Planning Style" value={label(PLANNING_OPT, profile.planning_style)!} />}
                      </div>
                    </div>
                  )}

                  {/* Experience Level */}
                  {label(EXPERIENCE_OPT, profile.experience_level) && (
                    <div className="flex items-center rounded-2xl px-4 py-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <span className="mr-2">🏆</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Experience Level</span>
                      <span className="text-white font-semibold text-sm ml-auto">{label(EXPERIENCE_OPT, profile.experience_level)}</span>
                    </div>
                  )}

                  {/* Places Visited */}
                  {placesVisited.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>🗺️</span>
                        <p className="text-white font-semibold text-lg">Places Visited</p>
                        <span className="font-semibold ml-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>{placesVisited.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {placesVisited.slice(0, 8).map((p, i) => (
                          <span key={i} className="rounded-full px-3 py-1.5 text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)' }}>{p}</span>
                        ))}
                        {placesVisited.length > 8 && (
                          <span className="rounded-full px-3 py-1.5 text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>+{placesVisited.length - 8} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {languages.length > 0 && (
                    <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: '#0F0F0F', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">🗣️</span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Languages</span>
                      </div>
                      <p className="text-white font-medium text-sm">{languages.join(', ')}</p>
                    </div>
                  )}

                  {/* Bucket List */}
                  {bucketList.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span>✨</span>
                        <p className="text-white font-semibold text-lg">Dream Bucket List</p>
                        <span className="font-semibold ml-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>{bucketList.length}</span>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-1 -mx-6 px-6">
                        {bucketList.map((country, i) => (
                          <div key={i} className="relative rounded-xl overflow-hidden shrink-0 flex items-end" style={{ width: 120, height: 80, backgroundColor: '#1a1a1a' }}>
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }} />
                            <p className="relative text-white font-bold text-xs p-2.5 leading-tight">{country}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Adventures */}
                  {savedTrips.length > 0 && (
                    <div>
                      <p className="uppercase font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '1.4px' }}>Saved Adventures</p>
                      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-6 px-6">
                        {savedTrips.map((t: any, i: number) => (
                          <div key={i} className="relative rounded-2xl overflow-hidden shrink-0 flex items-end" style={{ width: 110, height: 150, backgroundColor: '#111' }}>
                            {t.cover_image && <img src={t.cover_image} alt={t.destination} className="absolute inset-0 w-full h-full object-cover" />}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />
                            <p className="relative text-white font-bold text-xs p-2.5 leading-tight" style={{ letterSpacing: -0.2 }}>{t.destination}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              <div
                className="px-4 pt-3 shrink-0"
                style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
              >
                <button
                  type="button"
                  className="w-full font-semibold text-sm rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '1px solid rgba(240,235,227,0.15)', color: '#F0EBE3', padding: '13px' }}
                >
                  Send Message
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#F0EBE3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
