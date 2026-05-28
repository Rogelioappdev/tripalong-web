'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/lib/queries'
import type { UserProfile } from '@/lib/types'

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

type DNAValues = {
  gender: string
  travel_styles: string[]
  travel_pace: string
  social_energy: string
  planning_style: string
  experience_level: string
  travel_with: string
}

function dnaFromProfile(p: UserProfile): DNAValues {
  return {
    gender: p.gender ?? '',
    travel_styles: p.travel_styles ?? [],
    travel_pace: p.travel_pace ?? '',
    social_energy: p.social_energy ?? '',
    planning_style: p.planning_style ?? '',
    experience_level: p.experience_level ?? '',
    travel_with: p.travel_with ?? '',
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────
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
  const fileRef = useRef<HTMLInputElement>(null)

  // Basic info edit
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [countryVal, setCountryVal] = useState('')
  const [editingBasic, setEditingBasic] = useState(false)

  // DNA inline edit
  const [editingDNA, setEditingDNA] = useState(false)
  const [dnaEdit, setDnaEdit] = useState<DNAValues>({
    gender: '', travel_styles: [], travel_pace: '',
    social_energy: '', planning_style: '', experience_level: '', travel_with: '',
  })

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
    setUploadingMain(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/profile.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await save({ profile_photo: publicUrl })
    } finally {
      setUploadingMain(false)
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

  // DNA helpers
  const openDNAEdit = () => {
    if (profile) setDnaEdit(dnaFromProfile(profile))
    setEditingDNA(true)
  }

  const toggleDNA = (key: string, value: string, multi: boolean) => {
    setDnaEdit(prev => {
      if (multi) {
        const arr = (prev[key as keyof DNAValues] as string[])
        return { ...prev, [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
      }
      return { ...prev, [key]: value }
    })
  }

  const isDNASelected = (key: string, value: string) => {
    const v = dnaEdit[key as keyof DNAValues]
    return Array.isArray(v) ? v.includes(value) : v === value
  }

  const saveDNA = async () => {
    await save({
      gender: (dnaEdit.gender || null) as UserProfile['gender'],
      travel_styles: dnaEdit.travel_styles,
      travel_pace: (dnaEdit.travel_pace || null) as UserProfile['travel_pace'],
      social_energy: (dnaEdit.social_energy || null) as UserProfile['social_energy'],
      planning_style: (dnaEdit.planning_style || null) as UserProfile['planning_style'],
      experience_level: (dnaEdit.experience_level || null) as UserProfile['experience_level'],
      travel_with: (dnaEdit.travel_with || null) as UserProfile['travel_with'],
    })
    setEditingDNA(false)
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="pt-14 min-h-screen bg-black flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
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
              {uploadingMain ? '...' : '📷 Change photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
          </div>

          {/* Basic info */}
          <Section title="About You">
            {editingBasic ? (
              <div className="flex flex-col gap-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
                  className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                  style={{ fontSize: 16 }} />
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
                  </div>
                  <button onClick={() => setEditingBasic(true)} className="text-white/40 text-sm hover:text-white">Edit</button>
                </div>
                {profile?.bio ? (
                  <p className="text-white/50 text-sm leading-relaxed">{profile.bio}</p>
                ) : (
                  <p className="text-white/20 text-sm italic">No bio yet — tap Edit to add one</p>
                )}
                {saved && <p className="text-green-400 text-xs mt-2">Saved ✓</p>}
              </div>
            )}
          </Section>

          {/* Travel DNA */}
          <Section title="Travel DNA">
            {editingDNA ? (
              <div className="flex flex-col gap-5">
                {DNA_FIELDS.map(field => (
                  <div key={field.key}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">{field.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {field.options.map(opt => {
                        const selected = isDNASelected(field.key, opt.value)
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleDNA(field.key, opt.value, field.multi)}
                            className="px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95"
                            style={{
                              backgroundColor: selected ? '#F0EBE3' : 'rgba(255,255,255,0.06)',
                              color: selected ? '#000' : 'rgba(255,255,255,0.6)',
                              borderColor: selected ? 'transparent' : 'rgba(255,255,255,0.12)',
                            }}
                          >
                            {opt.emoji} {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex gap-3 pt-1">
                  <button onClick={saveDNA} disabled={saving}
                    className="flex-1 bg-white text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingDNA(false)}
                    className="flex-1 bg-white/8 text-white/60 font-medium py-3 rounded-2xl text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
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
                  <div className="flex flex-wrap gap-2 mb-3">
                    {profile.travel_styles.map(s => {
                      const style = DNA_FIELDS[1].options.find(o => o.value === s)
                      return style ? (
                        <span key={s} className="text-xs bg-white/8 rounded-full px-3 py-1.5 text-white/60">
                          {style.emoji} {style.label}
                        </span>
                      ) : null
                    })}
                  </div>
                )}
                <button
                  onClick={openDNAEdit}
                  className="text-white/40 text-sm hover:text-white transition-colors"
                >
                  Edit →
                </button>
              </div>
            )}
          </Section>

          {/* Photos grid */}
          <Section title="Photos">
            <div className="grid grid-cols-3 gap-1.5">
              {(profile?.photos ?? []).map((url, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden relative">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, lineHeight: 1 }}
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
