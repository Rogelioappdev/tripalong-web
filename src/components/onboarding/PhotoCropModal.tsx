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
// handed to handlePhotoUpload. Profile photos render as circles everywhere in
// this app (see .ta-avatar in globals.css, and the round avatar treatment in
// PublicProfileModal), so the crop area is round + locked to a 1:1 aspect —
// there's no "portrait vs square" choice to make here.
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
          aspect={1}
          cropShape="round"
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
