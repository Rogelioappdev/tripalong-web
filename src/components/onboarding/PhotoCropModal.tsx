'use client'

import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { haptic } from '@/lib/haptics'
import { getCroppedImage } from '@/lib/cropImage'

interface PhotoCropModalProps {
  imageSrc: string
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}

// Fullscreen crop step shown right after a photo is picked, before it's
// handed to handlePhotoUpload. Was previously a round 1:1 crop (reasoning:
// avatars render as circles everywhere via .ta-avatar) — but the actual
// most-prominent display of this exact photo is PublicProfileModal's hero
// carousel, a tall portrait frame (~66dvh tall, full width — roughly 3:4 on
// most phones), not a small circle. A 1:1 crop threw away real image data
// (more of the photo above/below the face) that the hero carousel is fully
// capable of showing, and that a user cropping tightly to a circle would
// have no way to know they were discarding. 3:4 is a much closer match to
// that real display, and still crops fine into the small round avatars
// elsewhere (chat, member chips) via their own object-fit: cover — losing a
// little off the sides there is a far smaller tradeoff than losing the top
// of someone's head in the one place their photo is shown large.
const CROP_ASPECT = 3 / 4

export function PhotoCropModal({ imageSrc, onConfirm, onCancel }: PhotoCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels || processing) return
    haptic(8)
    setProcessing(true)
    setError('')
    try {
      const blob = await getCroppedImage(imageSrc, croppedAreaPixels)
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' })
      onConfirm(file)
    } catch (e: any) {
      setError(e?.message ?? 'Could not crop that photo. Try again.')
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black">
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={CROP_ASPECT}
          cropShape="rect"
          showGrid={false}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div
        className="flex flex-col gap-4 px-6"
        style={{ paddingTop: 20, paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/35 text-base leading-none select-none">−</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: '#F0EBE3' }}
            aria-label="Zoom"
          />
          <span className="text-white/35 text-base leading-none select-none">+</span>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => { haptic(4); onCancel() }}
            disabled={processing}
            className="flex-1 py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!croppedAreaPixels || processing}
            className="flex-1 py-4 rounded-2xl font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            {processing ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
