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

  // DNA per-field edit
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState<string | string[]>('')

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
                      onClick={() => isEditing ? setEditingField(null) : openFieldEdit(field)}
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
                            <button type="button" onClick={() => saveField(field.key, fieldDraft as string[])}
                              disabled={saving}
                              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                              style={{ backgroundColor: '#F0EBE3', color: '#000' }}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => setEditingField(null)}
                              className="px-5 py-2.5 rounded-2xl text-sm"
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
