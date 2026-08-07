'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { registerPush, getNotificationStatusAsync, type NotificationStatus } from '@/lib/push'
import { getTravelImages } from '@/lib/queries'
import { TrialOfferPaywall } from './TrialOfferPaywall'
import type { UserProfile } from '@/lib/types'

// The run-up to the paywall, modelled on Cal AI's sequence:
//
//   1. value     — what's free and what it unlocks, up front
//   2. reminder  — "we'll tell you before it ends", the risk-reversal beat
//   3. paywall   — the actual offer (our existing TrialOfferPaywall)
//
// The first two sell nothing. Their job is that by the time plan cards
// appear, the user has been told what they're getting and that today costs
// nothing. The "no payment due now" footer is deliberately identical on every
// screen — it's the one line that has to survive the whole sequence.

type Step = 'value' | 'reminder' | 'paywall'

interface Props {
  userId: string
  onDone: (profile: UserProfile | null) => void
  source?: 'onboarding' | 'swipe_wall'
  startAt?: Step
}

const CREAM = '#F0EBE3'

// Only features that are actually live and actually gated today. Location
// filtering is built but not wired up yet, so it is deliberately absent —
// promising it here would be the exact "misleading paywall" thing the brand
// positions against.
const VALUE = [
  { icon: '∞', label: 'Unlimited swipes', sub: 'No daily wall. Every trip in the feed, whenever you want.' },
  { icon: '👀', label: 'See who viewed you', sub: 'Know who’s been checking out your profile.' },
  { icon: '✦', label: 'Your compatibility %', sub: 'See how well you match a trip before you commit.' },
  // Held back until the thing it promises is real:
  // { icon: '🚫', label: 'No ads', sub: 'Just trips.' },
  // — the AdMob SDK is integrated but no ads run anywhere in the app, so
  // "no ads" is selling the absence of something that was never there.
  // Restore this the day ads actually ship to free users.
]

function NoPaymentDue() {
  return (
    <div className="flex items-center justify-center gap-2" style={{ marginBottom: 14 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke={CREAM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ color: CREAM, fontSize: 14, fontWeight: 600 }}>No payment due now</span>
    </div>
  )
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
      style={{ background: `linear-gradient(135deg, ${CREAM} 0%, #ddd4ca 100%)`, color: '#000' }}
    >
      {label}
    </button>
  )
}

export function TrialFlow({ userId, onDone, source = 'onboarding', startAt = 'value' }: Props) {
  const [step, setStep] = useState<Step>(startAt)
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null)
  const [notifPanel, setNotifPanel] = useState<'none' | 'granted' | 'instructions'>('none')
  const [checking, setChecking] = useState(false)
  const [bgImage, setBgImage] = useState<string | null>(null)

  useEffect(() => {
    getNotificationStatusAsync().then(setNotifStatus)
  }, [])

  // Fetch AND decode the paywall's background during the earlier steps, so the
  // final screen paints complete on its first frame instead of having the
  // blurred photo arrive a beat late (which read as the paywall still loading).
  useEffect(() => {
    let cancelled = false
    getTravelImages(12).then(imgs => {
      const url = imgs?.[0]
      if (!url || cancelled) return
      const img = new window.Image()
      img.onload = () => { if (!cancelled) setBgImage(url) }
      img.src = url
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (step === 'paywall') return // TrialOfferPaywall fires its own paywall_viewed
    track('trial_flow_step_viewed', { step, source })
  }, [step, source])

  const close = useCallback(() => { haptic(6); onDone(null) }, [onDone])

  // Tapping the notification control always answers the question "am I
  // actually going to get this reminder?" — it re-checks live rather than
  // trusting the status read on mount, then either confirms, asks, or (when
  // the OS has already said no and can't be re-prompted) shows how to fix it.
  const handleNotifTap = useCallback(async () => {
    if (checking) return
    haptic(8)
    setChecking(true)
    try {
      const live = await getNotificationStatusAsync()
      setNotifStatus(live)

      if (live === 'granted') { setNotifPanel('granted'); return }
      // 'denied' can't be re-prompted by either rail — the OS/browser only
      // shows its dialog once. Instructions are the only real path back.
      if (live === 'denied' || live === 'unsupported') { setNotifPanel('instructions'); return }

      if ((window as any).ReactNativeWebView) {
        // An app build that predates this message type never calls back, and
        // the OS prompt itself can sit open indefinitely — either way the
        // button must not be stuck on "Checking…" forever.
        const bail = setTimeout(() => {
          delete (window as any).__tripalongNotificationsDone
          getNotificationStatusAsync().then(s => {
            setNotifStatus(s)
            setNotifPanel(s === 'granted' ? 'granted' : 'instructions')
            setChecking(false)
          })
        }, 20_000)
        ;(window as any).__tripalongNotificationsDone = () => {
          clearTimeout(bail)
          delete (window as any).__tripalongNotificationsDone
          getNotificationStatusAsync().then(s => {
            setNotifStatus(s)
            setNotifPanel(s === 'granted' ? 'granted' : 'instructions')
            setChecking(false)
          })
        }
        ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'request_notifications' }))
        return // native callback owns setChecking from here
      }

      if (!('Notification' in window)) { setNotifPanel('instructions'); return }
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        registerPush(userId).catch(() => {})
        setNotifStatus('granted')
        setNotifPanel('granted')
      } else {
        setNotifStatus(permission === 'denied' ? 'denied' : 'default')
        setNotifPanel('instructions')
      }
    } catch {
      setNotifPanel('instructions')
    } finally {
      if (!(window as any).ReactNativeWebView) setChecking(false)
    }
  }, [checking, userId])

  const fromWall = source === 'swipe_wall'
  const granted = notifStatus === 'granted'
  const isNative = typeof window !== 'undefined' && !!(window as any).ReactNativeWebView
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent)

  const instructions = isNative
    ? isIOS
      ? ['Open iPhone Settings', 'Scroll down and tap TripAlong', 'Tap Notifications → Allow Notifications']
      : ['Open Settings → Apps → TripAlong', 'Tap Notifications', 'Turn on Allow notifications']
    : isIOS
      ? ['Open iPhone Settings → Notifications', 'Find TripAlong in the list', 'Turn on Allow Notifications']
      : ['Tap the lock icon in your browser’s address bar', 'Find Notifications', 'Switch it to Allow']

  const stepsOverlay = (
    <motion.div
      key="trial-flow-steps"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Held on screen while the paywall fades in over the top, so the last
      // hop is a crossfade instead of a hard cut. Unmounting this immediately
      // was what made arriving at the paywall feel snappy — there was a frame
      // with neither screen on it.
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: 'easeInOut' }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: '#050505', overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          paddingLeft: 24, paddingRight: 24,
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {/* Two different navigation models on purpose.
            Swipe wall: back arrow only, no X — the user already had a "Not
            now" on the wall itself before entering, so they're not cornered.
            Onboarding: a plain X, because this is a brand-new signup's first
            experience and burying the exit there is the wrong first
            impression (and they still have the whole app to reach). */}
        <div
          className="flex items-center shrink-0"
          style={{ marginBottom: 6, justifyContent: fromWall ? 'flex-start' : 'flex-end' }}
        >
          <button
            type="button"
            onClick={() => {
              haptic(6)
              setNotifPanel('none')
              if (!fromWall || step === startAt) { close(); return }
              setStep('value')
            }}
            className="active:opacity-60"
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label={fromWall ? 'Back' : 'Skip'}
          >
            {fromWall ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* ── 1. VALUE ─────────────────────────────────────────────── */}
          {step === 'value' && (
            <motion.div
              key="value"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
              className="flex-1 min-h-0 flex flex-col"
            >
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="font-extrabold"
                  style={{ color: CREAM, fontSize: 56, lineHeight: 1, letterSpacing: '-2.5px' }}
                >
                  FREE
                </motion.p>
                <h1
                  className="font-extrabold"
                  style={{ color: '#fff', fontSize: 24, lineHeight: 1.2, letterSpacing: '-0.6px', marginTop: 8 }}
                >
                  for 3 days — here&rsquo;s
                  <br />
                  everything that unlocks
                </h1>
              </div>

              <div className="flex-1 min-h-0 flex flex-col justify-center" style={{ gap: 16, paddingBlock: 20 }}>
                {VALUE.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.32, ease: 'easeOut' }}
                    className="flex gap-3 items-start text-left"
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: 38, height: 38, borderRadius: 13,
                        backgroundColor: 'rgba(240,235,227,0.08)',
                        border: '0.5px solid rgba(240,235,227,0.14)',
                        color: CREAM, fontSize: 16,
                      }}
                    >
                      {f.icon}
                    </div>
                    <div className="min-w-0" style={{ paddingTop: 1 }}>
                      <p style={{ color: '#fff', fontSize: 14.5, fontWeight: 700 }}>{f.label}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, lineHeight: 1.5, marginTop: 1 }}>{f.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="shrink-0">
                <NoPaymentDue />
                <PrimaryButton label="Try it free" onClick={() => { haptic(12); setStep('reminder') }} />
              </div>
            </motion.div>
          )}

          {/* ── 2. REMINDER ──────────────────────────────────────────── */}
          {step === 'reminder' && (
            <motion.div
              key="reminder"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
              className="flex-1 min-h-0 flex flex-col"
            >
              <h1
                className="text-center font-extrabold"
                style={{ color: '#fff', fontSize: 30, lineHeight: 1.18, letterSpacing: '-0.8px', marginTop: 10 }}
              >
                We&rsquo;ll remind you
                <br />
                before your trial ends
              </h1>
              <p className="text-center" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 10 }}>
                One heads up on day 2. Nothing else.
              </p>

              <div className="flex-1 min-h-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 240, damping: 18 }}
                  style={{ position: 'relative' }}
                >
                  <svg width="124" height="124" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                      stroke="rgba(240,235,227,0.22)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="rgba(240,235,227,0.10)"
                    />
                  </svg>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.42, type: 'spring', stiffness: 420, damping: 14 }}
                    style={{
                      position: 'absolute', top: 6, right: -2,
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: '#FF453A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 19, fontWeight: 800,
                    }}
                  >
                    1
                  </motion.div>
                </motion.div>
              </div>

              <div className="shrink-0">
                {/* Status control — tapping always answers "will I actually
                    get this?", rather than firing a silent permission request
                    that does nothing visible when the OS has already said no. */}
                <AnimatePresence mode="wait">
                  {notifPanel === 'none' ? (
                    <motion.button
                      key="check"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      type="button"
                      onClick={handleNotifTap}
                      disabled={checking}
                      className="w-full py-3 rounded-2xl font-semibold text-sm active:opacity-70 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.07)',
                        border: '0.5px solid rgba(255,255,255,0.12)',
                        color: '#fff', marginBottom: 10,
                      }}
                    >
                      {checking ? 'Checking…' : granted ? 'Check my notifications' : 'Turn on notifications'}
                    </motion.button>
                  ) : (
                    <motion.div
                      key="panel"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        borderRadius: 18, padding: '14px 16px', marginBottom: 10, textAlign: 'left',
                        backgroundColor: notifPanel === 'granted' ? 'rgba(48,209,88,0.09)' : 'rgba(255,255,255,0.06)',
                        border: `0.5px solid ${notifPanel === 'granted' ? 'rgba(48,209,88,0.35)' : 'rgba(255,255,255,0.12)'}`,
                      }}
                    >
                      {notifPanel === 'granted' ? (
                        <div className="flex items-start gap-2.5">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
                            <path d="M5 13l4 4L19 7" stroke="#30D158" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>
                            <strong>Notifications are on.</strong> You&rsquo;ll get your reminder on day 2.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                            Notifications are off
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                            You can still start the trial — you just won&rsquo;t get the day-2 reminder. To turn them on:
                          </p>
                          {instructions.map((line, i) => (
                            <div key={line} className="flex items-start gap-2" style={{ marginBottom: 5 }}>
                              <span style={{
                                width: 17, height: 17, borderRadius: 9, flexShrink: 0,
                                backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
                                fontSize: 10, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>{i + 1}</span>
                              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.45 }}>{line}</span>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={handleNotifTap}
                            className="active:opacity-60"
                            style={{ color: CREAM, fontSize: 12, fontWeight: 700, textDecoration: 'underline', marginTop: 6 }}
                          >
                            Check again
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <NoPaymentDue />
                <PrimaryButton label="Start my 3 free days" onClick={() => { haptic(12); setStep('paywall') }} />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  )

  return createPortal(
    <>
      <AnimatePresence>
        {step !== 'paywall' && stepsOverlay}
      </AnimatePresence>
      {/* Mounted after the steps overlay, so with equal z-index it paints on
          top while that one is still fading out. */}
      {step === 'paywall' && (
        <TrialOfferPaywall
          userId={userId}
          source={source}
          backgroundImage={bgImage}
          // Wall only — onboarding's paywall keeps its X (see the top bar above).
          onBack={fromWall ? () => { haptic(6); setStep('reminder') } : undefined}
          onDone={onDone}
        />
      )}
    </>,
    document.body
  )
}
