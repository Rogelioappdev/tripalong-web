'use client'

// Live, camera-only photo verification. No file picker ever renders here —
// the only image that ever leaves the device is a single frame grabbed
// automatically mid-way through a short, randomized "prove you're really
// here" challenge (e.g. blink + turn your head), tracked in real time via
// MediaPipe's FaceLandmarker running entirely on-device (WASM, no server
// call). A static printed photo or a paused video can't follow live,
// randomized instructions, which is what makes this a real (if imperfect)
// liveness check rather than just "captured via getUserMedia."
//
// This component only handles capture + upload. The actual match decision
// happens later: a daily cron job (src/app/api/cron/verify-daily) gives each
// upload a Claude-vision advisory read, then a human makes the final call in
// /admin/verify. Nothing here auto-approves or auto-rejects anyone.

import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { supabase } from '@/lib/supabase'

type ChallengeAction = 'blink' | 'turnHead' | 'smile'

const CHALLENGE_COPY: Record<ChallengeAction, string> = {
  blink: 'Blink twice',
  turnHead: 'Turn your head to the side',
  smile: 'Give a little smile',
}

const ALL_ACTIONS: ChallengeAction[] = ['blink', 'turnHead', 'smile']

function pickChallenge(): ChallengeAction[] {
  const shuffled = [...ALL_ACTIONS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2)
}

// Blendshape score thresholds — MediaPipe's blendshape categories are 0-1.
// Picked conservatively (a real blink/smile clears these easily; passive
// resting-face scores sit well below them).
const BLINK_THRESHOLD = 0.55
const SMILE_THRESHOLD = 0.45
// Head-turn uses landmark z-depth asymmetry between left/right cheek
// (indices 234 / 454 in MediaPipe's face mesh topology) instead of a
// blendshape — turning your head makes one cheek noticeably closer to the
// camera (smaller z) than the other. Threshold is a delta from the
// per-session baseline recorded in the first live frames.
const TURN_DELTA_THRESHOLD = 0.035
const CHALLENGE_TIMEOUT_MS = 15000

type Phase = 'consent' | 'starting' | 'live' | 'uploading' | 'done' | 'error'

// Resolves the signed-in user itself (via supabase.auth.getUser(), same as
// the 'photo'/'travelPhotos' onboarding steps' upload handlers) instead of
// taking a userId prop — this step runs mid-quiz, before the quiz's own
// authedUserId state gets populated (that only happens in saveProfile(),
// once the whole quiz is submitted), so a prop here would just be null.
export function LiveVerificationCapture({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>('consent')
  const [errorMessage, setErrorMessage] = useState('')
  const [challenge] = useState<ChallengeAction[]>(pickChallenge)
  const [completedSteps, setCompletedSteps] = useState<Set<ChallengeAction>>(new Set())

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  const baselineZDeltaRef = useRef<number | null>(null)
  const completedRef = useRef<Set<ChallengeAction>>(new Set())
  const capturingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopCamera = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  useEffect(() => stopCamera, [])

  const captureFrame = async (video: HTMLVideoElement): Promise<Blob> => {
    const maxDim = 1080
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the camera frame.')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('Could not process the camera frame.')
    return blob
  }

  const finishChallenge = async () => {
    if (capturingRef.current) return
    capturingRef.current = true
    const video = videoRef.current
    stopCamera()
    setPhase('uploading')
    try {
      if (!video) throw new Error('Camera was not ready.')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in again.')
      const blob = await captureFrame(video)
      const path = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('verification-selfies')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { error: insertError } = await supabase
        .from('photo_verifications')
        .insert({ user_id: user.id, selfie_path: path, status: 'pending' })
      if (insertError) throw insertError
      setPhase('done')
      onComplete()
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Verification upload failed. Try again.')
      setPhase('error')
    }
  }

  const evaluateFrame = (result: FaceLandmarkerResult) => {
    const blendshapes = result.faceBlendshapes?.[0]?.categories
    const landmarks = result.faceLandmarks?.[0]
    if (!blendshapes || !landmarks) return

    const next = new Set(completedRef.current)

    if (challenge.includes('blink') && !next.has('blink')) {
      const left = blendshapes.find(c => c.categoryName === 'eyeBlinkLeft')?.score ?? 0
      const right = blendshapes.find(c => c.categoryName === 'eyeBlinkRight')?.score ?? 0
      if (left > BLINK_THRESHOLD || right > BLINK_THRESHOLD) next.add('blink')
    }

    if (challenge.includes('smile') && !next.has('smile')) {
      const left = blendshapes.find(c => c.categoryName === 'mouthSmileLeft')?.score ?? 0
      const right = blendshapes.find(c => c.categoryName === 'mouthSmileRight')?.score ?? 0
      if (left > SMILE_THRESHOLD || right > SMILE_THRESHOLD) next.add('smile')
    }

    if (challenge.includes('turnHead') && !next.has('turnHead')) {
      const leftCheek = landmarks[234]
      const rightCheek = landmarks[454]
      if (leftCheek && rightCheek) {
        const zDelta = rightCheek.z - leftCheek.z
        if (baselineZDeltaRef.current === null) {
          baselineZDeltaRef.current = zDelta
        } else if (Math.abs(zDelta - baselineZDeltaRef.current) > TURN_DELTA_THRESHOLD) {
          next.add('turnHead')
        }
      }
    }

    if (next.size !== completedRef.current.size) {
      completedRef.current = next
      setCompletedSteps(new Set(next))
    }
    if (challenge.every(step => next.has(step))) {
      finishChallenge()
    }
  }

  const startCamera = async () => {
    setPhase('starting')
    setErrorMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera preview was not ready.')
      video.srcObject = stream
      await video.play()

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      )
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      })
      landmarkerRef.current = landmarker

      setPhase('live')
      timeoutRef.current = setTimeout(() => {
        if (capturingRef.current) return
        stopCamera()
        setErrorMessage("Didn't catch that in time — let's try again.")
        setPhase('error')
      }, CHALLENGE_TIMEOUT_MS)

      const loop = () => {
        if (video.readyState >= 2 && landmarkerRef.current) {
          const result = landmarkerRef.current.detectForVideo(video, performance.now())
          evaluateFrame(result)
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (e: any) {
      stopCamera()
      setErrorMessage(
        e?.name === 'NotAllowedError'
          ? 'Camera access was denied. Enable camera permission for TripAlong to verify your photo.'
          : (e?.message ?? "Couldn't start the camera. Try again."),
      )
      setPhase('error')
    }
  }

  const retry = () => {
    completedRef.current = new Set()
    setCompletedSteps(new Set())
    baselineZDeltaRef.current = null
    capturingRef.current = false
    startCamera()
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-2">
      {phase === 'consent' && (
        <>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(240,235,227,0.08)', border: '1px solid rgba(240,235,227,0.16)' }}>
            <span className="text-3xl">🤳</span>
          </div>
          <div>
            <h2 className="text-white font-extrabold text-2xl mb-2">Verify it's really you</h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              We'll open your camera for a quick live check — no photo library access, nothing recorded or saved
              beyond a single verification image, which is deleted once reviewed. Your face photo is only used to
              confirm you match your profile photo.
            </p>
          </div>
          <button
            onClick={startCamera}
            className="w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            Open camera
          </button>
        </>
      )}

      {(phase === 'starting' || phase === 'live' || phase === 'uploading') && (
        <>
          <div className="relative w-full max-w-[280px] aspect-square rounded-[28px] overflow-hidden" style={{ backgroundColor: '#111' }}>
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            {phase === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/40 text-sm">Starting camera…</span>
              </div>
            )}
            {phase === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <span className="text-white/70 text-sm font-medium">Uploading…</span>
              </div>
            )}
          </div>
          {phase === 'live' && (
            <div className="flex flex-col gap-2 w-full max-w-[280px]">
              {challenge.map(step => (
                <div
                  key={step}
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: completedSteps.has(step) ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)',
                    border: completedSteps.has(step) ? '1px solid rgba(48,209,88,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span className="text-base">{completedSteps.has(step) ? '✅' : '○'}</span>
                  <span className={completedSteps.has(step) ? 'text-white/50 text-sm line-through' : 'text-white text-sm font-medium'}>
                    {CHALLENGE_COPY[step]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {phase === 'done' && (
        <>
          <span className="text-5xl">✅</span>
          <p className="text-white font-bold text-lg">Verification submitted</p>
          <p className="text-white/40 text-sm">We'll review it shortly — you're all set to continue.</p>
        </>
      )}

      {phase === 'error' && (
        <>
          <span className="text-4xl">⚠️</span>
          <p className="text-white/70 text-sm max-w-xs">{errorMessage}</p>
          <button
            onClick={retry}
            className="w-full py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#F0EBE3', color: '#000' }}
          >
            Try again
          </button>
        </>
      )}
    </div>
  )
}
