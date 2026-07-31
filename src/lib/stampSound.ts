// Synthesizes a short "rubber stamp hitting paper/desk" thud entirely
// client-side via the Web Audio API — no external audio file, no <audio>
// element, no network request. Two layered components:
//   1. a low-frequency "thump" body (the felt/give of the card absorbing
//      the impact) — a sine oscillator sweeping down slightly under a fast
//      attack / fast exponential-decay envelope
//   2. a very brief filtered-noise "crack" transient right at the start
//      (the sharp edge-contact moment before the low body settles) — noise
//      generated on the fly into an AudioBuffer, no sample file involved
//
// Reused across calls via a module-level singleton AudioContext (created
// lazily, on first use) rather than a fresh context per play — cheaper, and
// avoids browsers' per-context startup cost. Every entry point is wrapped in
// try/catch: this is a decorative flourish on top of an animation that must
// keep working even if AudioContext is unavailable, blocked, or throws for
// any browser/state-specific reason.

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return null
      sharedCtx = new AudioContextClass()
    }
    if (sharedCtx.state === 'suspended') {
      // Best-effort resume — this call is itself the direct result of a
      // user-gesture-triggered flow (tapping through onboarding), so this
      // should succeed, but autoplay-policy quirks vary by browser/state.
      void sharedCtx.resume().catch(() => {})
    }
    return sharedCtx
  } catch {
    return null
  }
}

/**
 * Plays a short synthesized "stamp impact" thud (~250ms). Fire-and-forget —
 * never throws, never returns anything to await. Safe to call from any
 * client-side event handler or animation callback.
 */
export function playStampSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)

    // --- Thump: low-frequency body of the impact (~150Hz falling to
    // ~70Hz), fast attack + fast decay, like a heavy stamp landing hard.
    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(150, now)
    thump.frequency.exponentialRampToValueAtTime(70, now + 0.14)

    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0.0001, now)
    thumpGain.gain.exponentialRampToValueAtTime(1, now + 0.008)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

    thump.connect(thumpGain)
    thumpGain.connect(master)
    thump.start(now)
    thump.stop(now + 0.24)

    // --- Crack: a few-ms filtered noise burst at the very start of impact,
    // generated as raw noise (random samples) rather than a sample file.
    const noiseDuration = 0.045
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * noiseDuration))
    const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < sampleCount; i++) {
      noiseData[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 1800
    noiseFilter.Q.value = 0.7

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.0001, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.55, now + 0.004)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration)

    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noise.start(now)
    noise.stop(now + noiseDuration + 0.01)

    // Disconnect the master gain once the sound has fully finished so its
    // nodes can be garbage collected; the shared AudioContext itself is
    // left open for any later call.
    const cleanupDelayMs = Math.max(0, (now + 0.28 - ctx.currentTime) * 1000)
    setTimeout(() => {
      try {
        master.disconnect()
      } catch {
        // already disconnected — no-op
      }
    }, cleanupDelayMs)
  } catch {
    // A failed/blocked sound should never break the visual animation.
  }
}
