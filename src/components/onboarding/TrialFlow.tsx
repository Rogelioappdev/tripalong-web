'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { registerPush, getNotificationStatusAsync, type NotificationStatus } from '@/lib/push'
import { TripPreviewCard } from './TripPreviewCard'
import { TrialOfferPaywall } from './TrialOfferPaywall'
import type { UserProfile } from '@/lib/types'

// The three-beat run-up to the paywall, modelled on Cal AI's sequence:
//
//   1. intro     — "we want you to try it free", product shown in use
//   2. reminder  — "we'll tell you before it ends", the risk-reversal beat
//   3. paywall   — the actual offer (our existing TrialOfferPaywall)
//
// Steps 1 and 2 sell nothing. Their whole job is that by the time the plan
// cards appear, the user has already been told twice that today costs nothing
// and that they'll be warned before it doesn't. The "no payment due now"
// footer is deliberately identical on all three screens — it's the one line
// that has to survive the whole sequence.

type Step = 'intro' | 'reminder' | 'paywall'

interface Props {
  userId: string
  onDone: (profile: UserProfile | null) => void
  source?: 'onboarding' | 'swipe_wall'
  // The swipe wall is itself the intro beat — it already showed the locked
  // deck and made the free-days offer — so it enters at the reminder step
  // rather than pitching the product to someone mid-swipe.
  startAt?: Step
}

const CREAM = '#F0EBE3'

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

export function TrialFlow({ userId, onDone, source = 'onboarding', startAt = 'intro' }: Props) {
  const [step, setStep] = useState<Step>(startAt)
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    getNotificationStatusAsync().then(setNotifStatus)
  }, [])

  useEffect(() => {
    if (step === 'paywall') return // TrialOfferPaywall fires its own paywall_viewed
    track('trial_flow_step_viewed', { step, source })
  }, [step, source])

  const close = useCallback(() => { haptic(6); onDone(null) }, [onDone])

  // Ask for notification permission from the reminder screen itself. Mirrors
  // NotificationPrompt's dual-rail handling (the web Notification API is
  // inert inside the native WebView, so native has to be asked over the
  // bridge) without pulling in that component's full-screen UI.
  const enableNotifications = useCallback(async () => {
    if (enabling) return
    setEnabling(true)
    haptic(10)
    try {
      if ((window as any).ReactNativeWebView) {
        ;(window as any).__tripalongNotificationsDone = () => {
          delete (window as any).__tripalongNotificationsDone
          getNotificationStatusAsync().then(setNotifStatus)
          setEnabling(false)
        }
        ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'request_notifications' }))
        return
      }
      if (!('Notification' in window)) { setEnabling(false); return }
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        registerPush(userId).catch(() => {})
        setNotifStatus('granted')
      } else {
        setNotifStatus(permission === 'denied' ? 'denied' : 'default')
      }
    } catch {
      // Permission failures must never block the flow — the trial offer is
      // still perfectly valid without notifications.
    } finally {
      if (!(window as any).ReactNativeWebView) setEnabling(false)
    }
  }, [enabling, userId])

  if (step === 'paywall') {
    return (
      <TrialOfferPaywall
        userId={userId}
        source={source}
        onDone={onDone}
      />
    )
  }

  const granted = notifStatus === 'granted'
  const askable = notifStatus !== 'granted' && notifStatus !== 'unsupported'

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: 'easeInOut' }}
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
        {/* Top bar — back on the reminder step (when there's something to go
            back to), X everywhere else. Never a hidden or delayed dismiss. */}
        <div className="flex items-center justify-between shrink-0" style={{ marginBottom: 6 }}>
          {step === 'reminder' && startAt === 'intro' ? (
            <button
              type="button"
              onClick={() => { haptic(6); setStep('intro') }}
              className="active:opacity-60"
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Back"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : <div style={{ width: 34 }} />}
          <button
            type="button"
            onClick={close}
            className="active:opacity-60"
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Skip"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'intro' ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
              className="flex-1 min-h-0 flex flex-col"
            >
              <h1
                className="text-center font-extrabold"
                style={{ color: '#fff', fontSize: 32, lineHeight: 1.15, letterSpacing: '-1px', marginTop: 10 }}
              >
                We want you to try
                <br />
                <span style={{ color: CREAM }}>TripAlong+</span> for free
              </h1>

              {/* The product actually running — real trips from the live feed,
                  cycling with real Pass/Join/Save states. Not a screenshot. */}
              <div className="flex-1 min-h-0 flex items-center justify-center" style={{ paddingBlock: 18 }}>
                <div
                  style={{
                    padding: 8, borderRadius: 34,
                    backgroundColor: '#111',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                  }}
                >
                  <div style={{ borderRadius: 27, overflow: 'hidden' }}>
                    <TripPreviewCard />
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <NoPaymentDue />
                <PrimaryButton
                  label="Try it free"
                  onClick={() => { haptic(12); setStep('reminder') }}
                />
              </div>
            </motion.div>
          ) : (
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
              <p
                className="text-center"
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 10 }}
              >
                {granted
                  ? 'Notifications are on — we’ll give you a heads up on day 2.'
                  : 'Turn on notifications and we’ll give you a heads up on day 2.'}
              </p>

              <div className="flex-1 min-h-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 240, damping: 18 }}
                  style={{ position: 'relative' }}
                >
                  <svg width="132" height="132" viewBox="0 0 24 24" fill="none">
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
                      position: 'absolute', top: 8, right: -2,
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: '#FF453A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 20, fontWeight: 800,
                    }}
                  >
                    1
                  </motion.div>
                </motion.div>
              </div>

              <div className="shrink-0">
                {askable && (
                  <button
                    type="button"
                    onClick={enableNotifications}
                    disabled={enabling}
                    className="w-full py-3 rounded-2xl font-semibold text-sm active:opacity-70 disabled:opacity-50"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      border: '0.5px solid rgba(255,255,255,0.12)',
                      color: '#fff', marginBottom: 10,
                    }}
                  >
                    {enabling ? 'Asking…' : 'Turn on notifications'}
                  </button>
                )}
                <NoPaymentDue />
                <PrimaryButton
                  label="Continue for free"
                  onClick={() => { haptic(12); setStep('paywall') }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )

  return createPortal(content, document.body)
}
