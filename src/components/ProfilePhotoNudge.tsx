'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { updateProfile } from '@/lib/queries'
import { haptic } from '@/lib/haptics'
import type { TripWithDetails } from '@/lib/types'

interface ProfilePhotoNudgeProps {
  trip: TripWithDetails
  userId: string
  onDone: () => void
}

export function ProfilePhotoNudge({ trip, userId, onDone }: ProfilePhotoNudgeProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/profile.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setPhotoUrl(publicUrl)
    } catch {
      setError('Upload failed — try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!photoUrl) return
    setSaving(true)
    try {
      await updateProfile(userId, { profile_photo: photoUrl })
    } catch {}
    haptic([15, 30, 15])
    onDone()
  }

  const handleSkip = () => {
    haptic(4)
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden"
    >
      {/* Blurred cover background */}
      {trip.cover_image && (
        <img
          src={trip.cover_image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(22px)', transform: 'scale(1.12)', opacity: 0.25 }}
        />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }} />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.05 }}
        className="relative flex-1 flex flex-col items-center justify-center px-8 text-center"
      >
        {/* Photo picker */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-8 relative active:scale-[0.97] transition-transform"
          style={{
            width: 160,
            height: 200,
            borderRadius: 24,
            border: photoUrl ? '2px solid rgba(240,235,227,0.5)' : '2px dashed rgba(255,255,255,0.18)',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {photoUrl ? (
            <>
              <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: '#30D158' }}
              >
                ✓
              </div>
            </>
          ) : uploading ? (
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          ) : (
            <>
              <span style={{ fontSize: 36 }}>📷</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Add photo</span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
        />

        <h2
          className="text-white font-extrabold tracking-tight mb-2"
          style={{ fontSize: 28, lineHeight: '32px', letterSpacing: '-0.8px' }}
        >
          Put a face to your adventure.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, lineHeight: '20px' }}>
          Your travel crew wants to know<br />who's joining them in {trip.destination}.
        </p>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34, delay: 0.18 }}
        className="relative px-5 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
      >
        <button
          type="button"
          onClick={() => { haptic(10); handleSave() }}
          disabled={!photoUrl || saving || uploading}
          className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-30"
          style={{ backgroundColor: '#F0EBE3', color: '#000' }}
        >
          {saving ? 'Saving...' : "I'm in — let's go →"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="w-full py-2 text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Skip for now
        </button>
      </motion.div>
    </motion.div>
  )
}
