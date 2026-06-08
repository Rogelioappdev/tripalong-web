'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile, getMyTrips } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import type { UserProfile, TripWithDetails } from '@/lib/types'
import { PublicProfileModal } from '@/components/PublicProfileModal'
import { CountryPicker } from '@/components/CountryPicker'

// ── DNA field definitions (single source of truth on this page) ───────────
const DNA_FIELDS = [
  {
    key: 'gender', label: 'Identity', multi: false,
    options: [
      { value: 'male', emoji: '👨', label: 'Man' },
      { value: 'female', emoji: '👩', label: 'Woman' },
      { value: 'other', emoji: '🌟', label: 'Non-binary' },
    ],
  },
  {
    key: 'travel_styles', label: 'Travel Style', multi: true,
    options: [
      { value: 'adventure', emoji: '🏔️', label: 'Adventure' },
      { value: 'luxury', emoji: '✨', label: 'Luxury' },
      { value: 'backpacking', emoji: '🎒', label: 'Backpacking' },
      { value: 'cultural', emoji: '🏛️', label: 'Cultural' },
      { value: 'foodie', emoji: '🍜', label: 'Foodie' },
      { value: 'relaxed', emoji: '🌴', label: 'Relaxed' },
      { value: 'party', emoji: '🎉', label: 'Party' },
      { value: 'budget', emoji: '💸', label: 'Budget' },
    ],
  },
  {
    key: 'travel_pace', label: 'Daily Pace', multi: false,
    options: [
      { value: 'slow', emoji: '☕', label: 'Slow & Steady' },
      { value: 'balanced', emoji: '⚖️', label: 'Balanced' },
      { value: 'fast', emoji: '⚡', label: 'Go Go Go!' },
    ],
  },
  {
    key: 'social_energy', label: 'Social Energy', multi: false,
    options: [
      { value: 'introvert', emoji: '🌙', label: 'Introvert' },
      { value: 'extrovert', emoji: '☀️', label: 'Extrovert' },
      { value: 'ambivert', emoji: '🌗', label: 'Ambivert' },
    ],
  },
  {
    key: 'planning_style', label: 'Planning Style', multi: false,
    options: [
      { value: 'planner', emoji: '📋', label: 'Planner' },
      { value: 'spontaneous', emoji: '🎲', label: 'Spontaneous' },
      { value: 'flexible', emoji: '🤸', label: 'Flexible' },
    ],
  },
  {
    key: 'experience_level', label: 'Experience', multi: false,
    options: [
      { value: 'beginner', emoji: '🌱', label: 'Beginner' },
      { value: 'intermediate', emoji: '🌿', label: 'Intermediate' },
      { value: 'experienced', emoji: '✈️', label: 'Experienced' },
      { value: 'expert', emoji: '🌍', label: 'Expert' },
    ],
  },
  {
    key: 'travel_with', label: 'Travel With', multi: false,
    options: [
      { value: 'everyone', emoji: '🌍', label: 'Everyone' },
      { value: 'female', emoji: '👩', label: 'Women only' },
      { value: 'male', emoji: '👨', label: 'Men only' },
    ],
  },
] as const


function Bone({ className }: { className: string }) {
  return <div className={`bg-white/8 rounded-2xl animate-pulse ${className}`} />
}

function ProfileSkeleton() {
  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-black pb-20">
        <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-6">
          <Bone className="w-full aspect-[3/2] rounded-3xl" />
          <div className="border-t border-white/6 pt-6 flex flex-col gap-3">
            <Bone className="w-20 h-3" />
            <Bone className="w-36 h-6" />
            <Bone className="w-24 h-4" />
            <Bone className="w-full h-4" />
            <Bone className="w-2/3 h-4" />
          </div>
          <div className="border-t border-white/6 pt-6 flex flex-col gap-2">
            <Bone className="w-24 h-3 mb-2" />
            {[0,1,2,3].map(i => <Bone key={i} className="w-full h-12" />)}
          </div>
          <div className="border-t border-white/6 pt-6">
            <Bone className="w-16 h-3 mb-4" />
            <div className="grid grid-cols-3 gap-1.5">
              {[0,1,2].map(i => <Bone key={i} className="aspect-square" />)}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/6 pt-6">
      <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  )
}

function ChipList({ items, onAdd, onRemove, placeholder, emoji }: {
  items: string[]
  onAdd: (val: string) => void
  onRemove: (val: string) => void
  placeholder: string
  emoji: string
}) {
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map(item => (
          <div key={item} className="flex items-center gap-1.5 bg-white/8 rounded-full px-3 py-1.5">
            <span className="text-xs text-white/70">{emoji} {item}</span>
            <button type="button" onClick={() => onRemove(item)} className="text-white/30 hover:text-white/60 text-xs leading-none">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setAdding(true)} className="text-accent text-xs px-3 py-1.5 bg-white/4 rounded-full border border-white/10">
          + Add
        </button>
      </div>
      {adding && (
        <form onSubmit={e => { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(''); setAdding(false) } }}
          className="flex gap-2">
          <input
            autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
            className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="bg-white text-black font-semibold px-4 rounded-2xl text-sm">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-white/30 px-2 text-sm">✕</button>
        </form>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingMain, setUploadingMain] = useState(false)
  const [uploadingGrid, setUploadingGrid] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [myTrips, setMyTrips] = useState<TripWithDetails[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Basic info edit
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [countryVal, setCountryVal] = useState('')
  const [ageVal, setAgeVal] = useState('')
  const [instagramVal, setInstagramVal] = useState('')
  const [editingInstagram, setEditingInstagram] = useState(false)
  const [editingBasic, setEditingBasic] = useState(false)

  // DNA per-field edit
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState<string | string[]>('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/'); return }
      const [p, trips] = await Promise.all([
        getProfile(data.user.id),
        getMyTrips(data.user.id).catch(() => [] as TripWithDetails[]),
      ])
      if (p) {
        setProfile(p)
        setName(p.name ?? '')
        setBio(p.bio ?? '')
        setCity(p.city ?? '')
        setCountryVal(p.country ?? '')
        setAgeVal(p.age != null ? String(p.age) : '')
        setInstagramVal(p.instagram_handle ?? '')
      }
      setMyTrips(trips)
      setLoading(false)
    })
  }, [router])

  const save = async (updates: Partial<UserProfile>) => {
    if (!profile) return
    setSaving(true)
    try {
      await updateProfile(profile.id, updates)
      setProfile(p => p ? { ...p, ...updates } : p)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!profile) return
    setUploadingMain(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/profile.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // Bust the browser cache — same path means same URL, so the old image sticks without this
      const bustedUrl = `${publicUrl}?v=${Date.now()}`
      await save({ profile_photo: bustedUrl })
    } finally {
      setUploadingMain(false)
      // Reset input so selecting the same file again still triggers onChange
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handlePhotoGridUpload = async (file: File) => {
    if (!profile) return
    setUploadingGrid(true)
    try {
      const ts = Date.now()
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/${ts}.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await save({ photos: [...(profile.photos ?? []), publicUrl] })
    } finally {
      setUploadingGrid(false)
    }
  }

  const removePhoto = (url: string) => {
    if (!profile) return
    save({ photos: (profile.photos ?? []).filter(p => p !== url) })
  }

  // DNA per-field helpers
  const openFieldEdit = (field: typeof DNA_FIELDS[number]) => {
    const raw = profile?.[field.key as keyof UserProfile]
    setFieldDraft(field.multi ? ((raw as string[]) ?? []) : ((raw as string) ?? ''))
    setEditingField(field.key)
  }

  const toggleFieldDraft = (value: string, multi: boolean) => {
    if (multi) {
      setFieldDraft(prev => {
        const arr = prev as string[]
        return arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
      })
    } else {
      setFieldDraft(value)
    }
  }

  const saveField = async (key: string, value: string | string[]) => {
    await save({ [key]: (Array.isArray(value) ? value : value || null) } as Partial<UserProfile>)
    setEditingField(null)
  }

  if (loading) return <ProfileSkeleton />

  if (!profile) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center px-8 text-center gap-6">
        <span style={{ fontSize: 56 }}>⚠️</span>
        <div>
          <h2 className="text-white font-bold text-xl mb-2">Account not found</h2>
          <p className="text-white/40 text-sm leading-relaxed">
            Your account may have been removed or there was an error loading your profile.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => { haptic(18); await supabase.auth.signOut(); router.replace('/') }}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#FF3B30', color: '#fff' }}
        >
          Sign Out
        </button>
      </main>
    )
  }

  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-black pb-20 md:pb-8">
        <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-6">

          {/* Page header */}
          <div className="flex items-center justify-between -mb-2">
            <h1 className="text-white font-bold text-lg">Profile</h1>
            <button
              type="button"
              onClick={() => { haptic(8); router.push('/settings') }}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/8 active:scale-90 transition-all"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              aria-label="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>

          {/* Hero photo */}
          <div className="relative w-full aspect-[3/2] rounded-3xl overflow-hidden bg-white/6">
            {profile?.profile_photo ? (
              <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">👤</div>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { haptic(8); setShowPreview(true) }}
                className="bg-black/60 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform"
              >
                👁 Preview
              </button>
              <button
                type="button"
                onClick={() => { haptic(8); fileRef.current?.click() }}
                className="bg-black/60 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform"
              >
                {uploadingMain ? '...' : '📷 Change photo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
          </div>

          {/* Basic info */}
          <Section title="About You">
            {editingBasic ? (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                    className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                    style={{ fontSize: 16 }} />
                  <input value={ageVal} onChange={e => setAgeVal(e.target.value.replace(/\D/g, ''))} placeholder="Age"
                    inputMode="numeric" maxLength={3}
                    className="w-20 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                    style={{ fontSize: 16 }} />
                </div>
                <div className="flex gap-3">
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="City"
                    className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                    style={{ fontSize: 16 }} />
                  <input value={countryVal} onChange={e => setCountryVal(e.target.value)} placeholder="Country"
                    className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                    style={{ fontSize: 16 }} />
                </div>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Bio..."
                  className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 resize-none placeholder-white/25"
                  style={{ fontSize: 16 }} />
                <div className="flex gap-3">
                  <button type="button" onClick={() => { haptic(10); save({ name, bio, city, country: countryVal, age: ageVal ? parseInt(ageVal, 10) : null }); setEditingBasic(false) }}
                    disabled={saving}
                    className="flex-1 bg-white text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-transform">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { haptic(8); setEditingBasic(false) }}
                    className="flex-1 bg-white/8 text-white/60 font-medium py-3 rounded-2xl text-sm active:scale-[0.98] transition-transform">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold text-xl">{profile?.name}</p>
                    {profile?.age && <p className="text-white/40 text-sm">{profile.age} years old</p>}
                    {(profile?.city || profile?.country) && (
                      <p className="text-white/40 text-sm mt-0.5">
                        {[profile.city, profile.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => { haptic(8); setEditingBasic(true) }} className="text-white/40 text-sm hover:text-white active:scale-90 transition-transform">Edit</button>
                </div>
                {profile?.bio ? (
                  <p className="text-white/50 text-sm leading-relaxed">{profile.bio}</p>
                ) : (
                  <p className="text-white/20 text-sm italic">No bio yet — tap Edit to add one</p>
                )}
              </div>
            )}
          </Section>

          {/* Instagram */}
          <Section title="Instagram">
            <p className="text-white/30 text-xs mb-4 leading-relaxed">
              Link your Instagram so future travel companions can verify you're a real person before joining a trip together. Builds trust instantly.
            </p>
            {editingInstagram ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 focus-within:border-white/30">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
                  <span className="text-white/35 text-sm select-none">@</span>
                  <input
                    autoFocus
                    value={instagramVal}
                    onChange={e => setInstagramVal(e.target.value.replace(/^@/, ''))}
                    placeholder="your_username"
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/20"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button"
                    onClick={() => { haptic(10); save({ instagram_handle: instagramVal.trim() || null }); setEditingInstagram(false) }}
                    disabled={saving}
                    className="flex-1 bg-white text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-transform">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button"
                    onClick={() => { haptic(8); setInstagramVal(profile?.instagram_handle ?? ''); setEditingInstagram(false) }}
                    className="flex-1 bg-white/8 text-white/60 font-medium py-3 rounded-2xl text-sm active:scale-[0.98] transition-transform">
                    Cancel
                  </button>
                </div>
              </div>
            ) : profile?.instagram_handle ? (
              <div className="flex items-center justify-between">
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 active:opacity-70 transition-opacity"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.55)' }}><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
                  <span className="text-white font-medium text-sm">@{profile.instagram_handle}</span>
                </a>
                <button onClick={() => { haptic(8); setEditingInstagram(true) }} className="text-white/40 text-sm hover:text-white active:scale-90 transition-transform">Edit</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { haptic(8); setEditingInstagram(true) }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
                <span className="text-sm font-medium">Add Instagram</span>
              </button>
            )}
          </Section>

          {/* Travel DNA — per-field tap-to-edit */}
          <Section title="Travel DNA">
            <div className="flex flex-col gap-2">
              {DNA_FIELDS.map(field => {
                const isEditing = editingField === field.key
                const rawVal = profile?.[field.key as keyof UserProfile]
                const displayPills = field.multi
                  ? ((rawVal as string[]) ?? []).flatMap(v => { const o = field.options.find(x => x.value === v); return o ? [o] : [] })
                  : null
                const displaySingle = !field.multi && rawVal
                  ? field.options.find(o => o.value === rawVal)
                  : null

                return (
                  <div key={field.key}
                    className="rounded-2xl transition-colors"
                    style={{ backgroundColor: isEditing ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)', border: isEditing ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {/* Row header */}
                    <button
                      type="button"
                      onClick={() => { haptic(8); isEditing ? setEditingField(null) : openFieldEdit(field) }}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-white/30 text-xs font-semibold uppercase tracking-widest shrink-0">{field.label}</span>
                        {!isEditing && (
                          field.multi
                            ? displayPills && displayPills.length > 0
                              ? <div className="flex flex-wrap gap-1.5 ml-1">
                                  {displayPills.map(o => (
                                    <span key={o.value} className="text-xs bg-white/10 rounded-full px-2 py-0.5 text-white/70">{o.emoji} {o.label}</span>
                                  ))}
                                </div>
                              : <span className="text-white/20 text-xs ml-1">Not set</span>
                            : displaySingle
                              ? <span className="text-white text-sm font-medium ml-1">{displaySingle.emoji} {displaySingle.label}</span>
                              : <span className="text-white/20 text-xs ml-1">Not set</span>
                        )}
                      </div>
                      <span className="text-white/25 text-xs shrink-0 ml-2">{isEditing ? '✕' : 'Edit'}</span>
                    </button>

                    {/* Expanded option picker */}
                    {isEditing && (
                      <div className="px-4 pb-4">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {field.options.map(opt => {
                            const sel = field.multi
                              ? (fieldDraft as string[]).includes(opt.value)
                              : fieldDraft === opt.value
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  haptic(8)
                                  if (!field.multi) {
                                    saveField(field.key, opt.value)
                                  } else {
                                    toggleFieldDraft(opt.value, true)
                                  }
                                }}
                                className="px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95"
                                style={{
                                  backgroundColor: sel ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
                                  color: sel ? '#000' : 'rgba(255,255,255,0.6)',
                                  borderColor: sel ? 'transparent' : 'rgba(255,255,255,0.12)',
                                }}
                              >
                                {opt.emoji} {opt.label}
                              </button>
                            )
                          })}
                        </div>
                        {field.multi && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { haptic(10); saveField(field.key, fieldDraft as string[]) }}
                              disabled={saving}
                              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
                              style={{ backgroundColor: '#F0EBE3', color: '#000' }}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => { haptic(8); setEditingField(null) }}
                              className="px-5 py-2.5 rounded-2xl text-sm active:scale-[0.98] transition-transform"
                              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Photos grid */}
          <Section title="Photos">
            <div className="grid grid-cols-3 gap-1.5">
              {(profile?.photos ?? []).map((url) => (
                <div key={url} className="aspect-square rounded-2xl overflow-hidden relative">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 z-10 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 13, lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}
              {(profile?.photos?.length ?? 0) < 10 && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer active:border-white/30 transition-colors">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoGridUpload(f) }} />
                  {uploadingGrid ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-white/30 text-2xl">+</span>
                      <span className="text-white/20 text-xs">Add</span>
                    </div>
                  )}
                </label>
              )}
            </div>
          </Section>

          {/* Languages */}
          <Section title="Languages">
            <ChipList
              items={profile?.languages ?? []}
              onAdd={v => save({ languages: [...(profile?.languages ?? []), v] })}
              onRemove={v => save({ languages: (profile?.languages ?? []).filter(x => x !== v) })}
              placeholder="e.g. Spanish"
              emoji="🗣️"
            />
          </Section>

          {/* Places visited */}
          <Section title="Places Visited">
            <CountryPicker
              items={profile?.places_visited ?? []}
              onAdd={v => save({ places_visited: [...(profile?.places_visited ?? []), v] })}
              onRemove={v => save({ places_visited: (profile?.places_visited ?? []).filter(x => x !== v) })}
              addLabel="+ Add country"
            />
          </Section>

          {/* Bucket list */}
          <Section title="Bucket List">
            <CountryPicker
              items={profile?.bucket_list ?? []}
              onAdd={v => save({ bucket_list: [...(profile?.bucket_list ?? []), v] })}
              onRemove={v => save({ bucket_list: (profile?.bucket_list ?? []).filter(x => x !== v) })}
              addLabel="+ Add dream destination"
              chipColor="rgba(240,235,227,0.1)"
            />
          </Section>

          {/* My Trips */}
          {myTrips.length > 0 && (
            <Section title="My Trips">
              <div className="flex flex-col gap-3">
                {myTrips.map(trip => (
                  <div key={trip.id} className="flex items-center gap-3 rounded-2xl overflow-hidden"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {trip.cover_image ? (
                      <img src={trip.cover_image} alt="" className="w-16 h-16 object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 bg-white/8 shrink-0 flex items-center justify-center text-2xl">🌍</div>
                    )}
                    <div className="flex-1 min-w-0 py-3 pr-3">
                      <p className="text-white font-semibold text-sm truncate">{trip.destination}{trip.country ? `, ${trip.country}` : ''}</p>
                      <p className="text-white/40 text-xs mt-0.5">{trip.member_count} member{trip.member_count !== 1 ? 's' : ''} · {trip.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Sign out */}
          <div className="pt-4 pb-8">
            {showSignOutConfirm ? (
              <div className="flex flex-col gap-2 p-4 rounded-2xl"
                style={{ backgroundColor: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.18)' }}>
                <p className="text-white/60 text-sm text-center mb-1">Sign out of TripAlong?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { haptic(8); setShowSignOutConfirm(false) }}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={async () => { haptic(18); await supabase.auth.signOut(); router.replace('/') }}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: '#FF3B30', color: '#fff' }}>
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { haptic(8); setShowSignOutConfirm(true) }}
                className="w-full text-red-400 border border-red-400/20 font-semibold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all">
                Sign Out
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Preview modal */}
      {showPreview && profile && (
        <PublicProfileModal userId={profile.id} onClose={() => setShowPreview(false)} />
      )}
    </>
  )
}
