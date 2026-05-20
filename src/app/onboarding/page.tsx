'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createProfile, getProfile } from '@/lib/queries'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Pre-fill name from Google OAuth if available
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.full_name) {
        setName(data.user.user_metadata.full_name)
      } else if (data.user?.user_metadata?.name) {
        setName(data.user.user_metadata.name)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const ageNum = parseInt(age)
    if (!name.trim()) return setError('Name is required')
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 99) return setError('Age must be between 18 and 99')

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      await createProfile(user.id, user.email ?? '', name.trim(), ageNum)
      router.replace('/feed')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome 👋</h1>
          <p className="text-white/40 text-sm">Just a couple things before we start</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Your name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Your age</label>
            <input
              type="number"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 24"
              min={18}
              max={99}
              className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/20 text-sm outline-none focus:border-white/30"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-semibold py-4 rounded-2xl text-sm hover:bg-white/90 transition-colors disabled:opacity-40 mt-2"
          >
            {loading ? 'Setting up...' : "Let's go →"}
          </button>
        </form>
      </div>
    </main>
  )
}
