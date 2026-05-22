'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/lib/queries'
import type { UserProfile } from '@/lib/types'

const TRAVEL_STYLES = [
  { value: 'adventure', emoji: '🏔️', label: 'Adventure' },
  { value: 'luxury', emoji: '✨', label: 'Luxury' },
  { value: 'backpacking', emoji: '🎒', label: 'Backpacking' },
  { value: 'cultural', emoji: '🏛️', label: 'Cultural' },
  { value: 'foodie', emoji: '🍜', label: 'Foodie' },
  { value: 'relaxed', emoji: '🌴', label: 'Relaxed' },
  { value: 'party', emoji: '🎉', label: 'Party' },
  { value: 'budget', emoji: '💸', label: 'Budget' },
]

const PACE_LABELS: Record<string, string> = { slow: '☕ Slow & Steady', balanced: '⚖️ Balanced', fast: '⚡ Fast-paced' }
const ENERGY_LABELS: Record<string, string> = { introvert: '🌙 Introvert', extrovert: '☀️ Extrovert', ambivert: '🌗 Ambivert' }
const PLANNING_LABELS: Record<string, string> = { planner: '📋 Planner', spontaneous: '🎲 Spontaneous', flexible: '🤸 Flexible' }
const EXP_LABELS: Record<string, string> = { beginner: '🌱 Beginner', intermediate: '🌿 Intermediate', experienced: '✈️ Experienced', expert: '🌍 Expert' }
const GENDER_LABELS: Record<string, string> = { male: '👨 Man', female: '👩 Woman', other: '🌟 Non-binary' }
const TRAVEL_WITH_LABELS: Record<string, string> = { everyone: '🌍 Everyone', female: '👩 Women only', male: '👨 Men only' }

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
            <button onClick={() => onRemove(item)} className="text-white/30 hover:text-white/60 text-xs leading-none">✕</button>
          </div>
        ))}
        <button onClick={() => setAdding(true)} className="text-accent text-xs px-3 py-1.5 bg-white/4 rounded-full border border-white/10">
          + Add
        </button>
      </div>
      {adding && (
        <form onSubmit={e => { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(''); setAdding(false) } }}
          className="flex gap-2">
          <input
            autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
            className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30"
          />
          <button type="submit" className="bg-white text-black font-semibold px-4 rounded-2xl text-sm">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-white/30 px-2 text-sm">✕</button>
        </form>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit states
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [countryVal, setCountryVal] = useState('')
  const [editingBasic, setEditingBasic] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/'); return }
      const p = await getProfile(data.user.id)
      if (p) {
        setProfile(p)
        setName(p.name ?? '')
        setBio(p.bio ?? '')
        setCity(p.city ?? '')
        setCountryVal(p.country ?? '')
      }
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
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/profile.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await save({ profile_photo: publicUrl })
    } finally {
      setUploading(false)
    }
  }

  const handlePhotoGridUpload = async (file: File) => {
    if (!profile) return
    setUploading(true)
    try {
      const ts = Date.now()
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/${ts}.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const newPhotos = [...(profile.photos ?? []), publicUrl]
      await save({ photos: newPhotos })
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (url: string) => {
    if (!profile) return
    save({ photos: profile.photos.filter(p => p !== url) })
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="pt-14 min-h-screen bg-black flex items-center justify-center">
          <div className="text-white/30 text-sm">Loading...</div>
        </main>
      </>
    )
  }

  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-black pb-20 md:pb-8">
        <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-6">

          {/* Hero photo */}
          <div className="relative w-full aspect-[3/2] rounded-3xl overflow-hidden bg-white/6">
            {profile?.profile_photo ? (
              <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">👤</div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl"
            >
              {uploading ? '...' : '📷 Change photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
          </div>

          {/* Basic info */}
          <Section title="About You">
            {editingBasic ? (
              <div className="flex flex-col gap-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                  className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30" />
                <div className="flex gap-3">
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="City"
                    className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30" />
                  <input value={countryVal} onChange={e => setCountryVal(e.target.value)} placeholder="Country"
                    className="flex-1 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30" />
                </div>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Bio..."
                  className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 resize-none placeholder-white/25" />
                <div className="flex gap-3">
                  <button onClick={() => { save({ name, bio, city, country: countryVal }); setEditingBasic(false) }}
                    disabled={saving}
                    className="flex-1 bg-white text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingBasic(false)}
                    className="flex-1 bg-white/8 text-white/60 font-medium py-3 rounded-2xl text-sm">
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
                    <p className="text-white/30 text-xs mt-1">{profile?.email}</p>
                  </div>
                  <button onClick={() => setEditingBasic(true)} className="text-white/40 text-sm hover:text-white">Edit</button>
                </div>
                {profile?.bio ? (
                  <p className="text-white/50 text-sm leading-relaxed">{profile.bio}</p>
                ) : (
                  <p className="text-white/20 text-sm italic">No bio yet</p>
                )}
                {saved && <p className="text-green-400 text-xs mt-2">Saved ✓</p>}
              </div>
            )}
          </Section>

          {/* Travel DNA */}
          <Section title="Travel DNA">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Pace', value: profile?.travel_pace ? PACE_LABELS[profile.travel_pace] : null },
                { label: 'Social', value: profile?.social_energy ? ENERGY_LABELS[profile.social_energy] : null },
                { label: 'Planning', value: profile?.planning_style ? PLANNING_LABELS[profile.planning_style] : null },
                { label: 'Experience', value: profile?.experience_level ? EXP_LABELS[profile.experience_level] : null },
                { label: 'Gender', value: profile?.gender ? GENDER_LABELS[profile.gender] : null },
                { label: 'Travel with', value: profile?.travel_with ? TRAVEL_WITH_LABELS[profile.travel_with] : null },
              ].map(item => item.value && (
                <div key={item.label} className="bg-white/4 rounded-2xl px-4 py-3">
                  <p className="text-white/30 text-xs mb-1">{item.label}</p>
                  <p className="text-white text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            {profile?.travel_styles && profile.travel_styles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.travel_styles.map(s => {
                  const style = TRAVEL_STYLES.find(ts => ts.value === s)
                  return style ? (
                    <span key={s} className="text-xs bg-white/8 rounded-full px-3 py-1.5 text-white/60">
                      {style.emoji} {style.label}
                    </span>
                  ) : null
                })}
              </div>
            )}
            <button
              onClick={() => router.push('/travel-dna')}
              className="mt-3 text-accent text-sm"
            >
              Edit Travel DNA →
            </button>
          </Section>

          {/* Photos grid */}
          <Section title="Photos">
            <div className="grid grid-cols-3 gap-1.5">
              {(profile?.photos ?? []).map((url, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden relative group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >✕</button>
                </div>
              ))}
              {(profile?.photos?.length ?? 0) < 10 && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoGridUpload(f) }} />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-white/30 text-2xl">+</span>
                    <span className="text-white/20 text-xs">Add</span>
                  </div>
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
            <ChipList
              items={profile?.places_visited ?? []}
              onAdd={v => save({ places_visited: [...(profile?.places_visited ?? []), v] })}
              onRemove={v => save({ places_visited: (profile?.places_visited ?? []).filter(x => x !== v) })}
              placeholder="e.g. Japan"
              emoji="🌍"
            />
          </Section>

          {/* Bucket list */}
          <Section title="Bucket List">
            <ChipList
              items={profile?.bucket_list ?? []}
              onAdd={v => save({ bucket_list: [...(profile?.bucket_list ?? []), v] })}
              onRemove={v => save({ bucket_list: (profile?.bucket_list ?? []).filter(x => x !== v) })}
              placeholder="e.g. Patagonia"
              emoji="✈️"
            />
          </Section>

          {/* Sign out */}
          <div className="pt-4 pb-8">
            <button
              onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
              className="w-full text-red-400 border border-red-400/20 font-semibold py-3.5 rounded-2xl text-sm hover:bg-red-400/8 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
