'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const FEATURES = [
  'Browsing trips',
  'Creating a trip',
  'Matching with travelers',
  'Chatting',
  'Profile & travel DNA',
  'Notifications',
]

const NPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function BetaFeedbackPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [liked, setLiked] = useState('')
  const [improved, setImproved] = useState('')
  const [featuresUsed, setFeaturesUsed] = useState<string[]>([])
  const [hasBug, setHasBug] = useState<boolean | null>(null)
  const [bugDesc, setBugDesc] = useState('')
  const [nps, setNps] = useState<number | null>(null)
  const [wishlist, setWishlist] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? '')
        supabase.from('users').select('name').eq('id', data.user.id).single()
          .then(({ data: u }) => { if (u?.name) setUserName(u.name) })
      }
    })
  }, [])

  const toggleFeature = (f: string) =>
    setFeaturesUsed(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  const canSubmit = rating !== null && liked.trim().length > 0 && nps !== null

  const submit = async () => {
    if (!canSubmit) return
    setState('submitting')

    const payload = {
      name: userName,
      email: userEmail,
      overall_rating: rating,
      liked_most: liked,
      needs_improvement: improved,
      features_used: featuresUsed.join(', '),
      found_bugs: hasBug ? `Yes — ${bugDesc}` : 'No',
      would_use_score: nps,
      feature_wishlist: wishlist,
    }

    // Submit to Formspree for email notification
    try {
      await fetch('https://formspree.io/f/xgojwbgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...payload, _subject: `🧪 Beta Feedback — ${userName || userEmail}` }),
      })
    } catch {}

    setState('done')
  }

  if (state === 'done') {
    return (
      <main style={{ background: '#000', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🙏</div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Thank you!</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, lineHeight: 1.6 }}>
            Your feedback helps shape TripAlong. We read every single response.
          </p>
          <button
            onClick={() => router.replace('/feed')}
            style={{ marginTop: 32, padding: '14px 32px', borderRadius: 16, background: '#F0EBE3', color: '#000', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}
          >
            Back to app
          </button>
        </div>
      </main>
    )
  }

  const label = (text: string, required = false) => (
    <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
      {text}{required && <span style={{ color: 'rgba(255,100,100,0.8)', marginLeft: 4 }}>*</span>}
    </p>
  )

  const textarea = (val: string, setter: (v: string) => void, placeholder: string) => (
    <textarea
      value={val}
      onChange={e => setter(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        width: '100%', padding: '14px 16px',
        borderRadius: 14, fontSize: 14, lineHeight: 1.55,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#fff', outline: 'none', resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  )

  return (
    <main style={{ background: '#000', minHeight: '100dvh', paddingBottom: 80 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 20px' }}>
        {/* Header */}
        <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)', paddingBottom: 32 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 14, cursor: 'pointer', padding: '4px 0', marginBottom: 24 }}
          >
            ← Back
          </button>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>
            Beta Tester
          </p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.15, marginBottom: 8 }}>
            How was it?
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, lineHeight: 1.5 }}>
            Honest feedback only. Takes about 2 minutes.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Q1: Overall rating */}
          <div>
            {label('Overall, how would you rate TripAlong?', true)}
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 20,
                  background: rating === n ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: rating === n ? '1.5px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {['😞', '😕', '😐', '😊', '🤩'][n - 1]}
                </button>
              ))}
            </div>
          </div>

          {/* Q2: What did you like most */}
          <div>
            {label('What did you like most?', true)}
            {textarea(liked, setLiked, 'The matching flow, the vibe, the design...')}
          </div>

          {/* Q3: What needs improvement */}
          <div>
            {label('What felt confusing or could be better?')}
            {textarea(improved, setImproved, 'Anything that frustrated you or wasn\'t clear...')}
          </div>

          {/* Q4: Features used */}
          <div>
            {label('Which features did you actually use?')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FEATURES.map(f => (
                <button key={f} onClick={() => toggleFeature(f)} style={{
                  padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                  background: featuresUsed.includes(f) ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                  border: featuresUsed.includes(f) ? '1.5px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: featuresUsed.includes(f) ? '#fff' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Q5: Bugs */}
          <div>
            {label('Did you run into any bugs?')}
            <div style={{ display: 'flex', gap: 10, marginBottom: hasBug ? 12 : 0 }}>
              {[true, false].map(b => (
                <button key={String(b)} onClick={() => setHasBug(b)} style={{
                  flex: 1, padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  background: hasBug === b ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: hasBug === b ? '1.5px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: hasBug === b ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {b ? 'Yes' : 'Nope, smooth!'}
                </button>
              ))}
            </div>
            {hasBug && textarea(bugDesc, setBugDesc, 'Describe what happened...')}
          </div>

          {/* Q6: NPS */}
          <div>
            {label('How likely are you to use TripAlong when it launches? (1–10)', true)}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NPS.map(n => (
                <button key={n} onClick={() => setNps(n)} style={{
                  width: 42, height: 42, borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: nps === n ? '#F0EBE3' : 'rgba(255,255,255,0.05)',
                  border: nps === n ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: nps === n ? '#000' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Not likely</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Definitely!</span>
            </div>
          </div>

          {/* Q7: Wishlist */}
          <div>
            {label('Any features you\'d love to see?')}
            {textarea(wishlist, setWishlist, 'Group trips, itinerary builder, maps...')}
          </div>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={!canSubmit || state === 'submitting'}
            style={{
              width: '100%', padding: '18px 0',
              borderRadius: 18, fontWeight: 800, fontSize: 16,
              background: canSubmit ? '#F0EBE3' : 'rgba(255,255,255,0.08)',
              color: canSubmit ? '#000' : 'rgba(255,255,255,0.2)',
              border: 'none', cursor: canSubmit ? 'pointer' : 'default',
              transition: 'all 0.2s',
              marginBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
            }}
          >
            {state === 'submitting' ? 'Sending...' : 'Send Feedback →'}
          </button>

          <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, textAlign: 'center', marginTop: -16, paddingBottom: 20 }}>
            * required fields
          </p>
        </div>
      </div>
    </main>
  )
}
