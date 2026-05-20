'use client'

import { useEffect, useState } from 'react'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/lib/queries'
import type { UserProfile } from '@/lib/types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const p = await getProfile(data.user.id)
      setProfile(p)
      setName(p?.name ?? '')
      setBio(p?.bio ?? '')
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      await updateProfile(profile.id, { name, bio })
      setProfile(p => p ? { ...p, name, bio } : p)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
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
      <main className="pt-14 min-h-screen bg-black">
        <div className="max-w-lg mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-white">Profile</h1>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-white/40 hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-2xl">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                profile?.name?.[0]?.toUpperCase() ?? '?'
              )}
            </div>
            <div>
              <p className="text-white font-semibold">{profile?.name}</p>
              <p className="text-white/40 text-sm">{profile?.email}</p>
              {profile?.age && <p className="text-white/30 text-sm">{profile.age} years old</p>}
            </div>
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell others about yourself..."
                  className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 resize-none placeholder-white/20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-white text-black font-semibold py-3.5 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setName(profile?.name ?? ''); setBio(profile?.bio ?? '') }}
                  className="flex-1 bg-white/8 text-white/60 font-medium py-3.5 rounded-2xl text-sm hover:bg-white/12 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {profile?.bio && (
                <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                  <p className="text-white/60 text-sm leading-relaxed">{profile.bio}</p>
                </div>
              )}
              {!profile?.bio && (
                <p className="text-white/20 text-sm">No bio yet. Tap Edit to add one.</p>
              )}
              {saved && <p className="text-green-400 text-xs">Profile saved ✓</p>}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
