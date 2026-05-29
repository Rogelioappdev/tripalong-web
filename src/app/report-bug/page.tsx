'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SUBJECTS = [
  'Something is broken',
  'App is crashing',
  'Can\'t log in or sign up',
  'Photos not loading',
  'Chat not working',
  'Trip features not working',
  'Profile not saving',
  'Notifications not working',
  'Other',
]

export default function ReportBugPage() {
  const router = useRouter()
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        setEmail(data.user.email ?? '')
      }
    })
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (description.trim().length < 10) {
      setError('Please describe the issue in a bit more detail.')
      return
    }
    setSubmitting(true)
    try {
      const { error: dbErr } = await supabase.from('bug_reports').insert({
        user_id: userId ?? null,
        email: email.trim() || null,
        subject,
        description: description.trim(),
      })
      if (dbErr) throw dbErr
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again or email bugs@tripalong.app.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: '#080808', minHeight: '100vh' }}>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <Link href="/" className="font-bold text-white text-base tracking-tight">TripAlong</Link>
        <button type="button" onClick={() => router.back()}
          className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Back
        </button>
      </header>

      <main className="max-w-lg mx-auto px-5 pb-36 pt-10">

        {submitted ? (
          <div className="flex flex-col items-center justify-center text-center pt-16 gap-5">
            <div className="text-5xl">🐛</div>
            <h1 className="font-bold text-white text-2xl">Report received!</h1>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Thanks for taking the time to report this. We&apos;ll look into it and fix it as soon as
              possible. If you left your email we&apos;ll follow up with you.
            </p>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => router.back()}
                className="px-6 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: '#F0EBE3', color: '#000' }}>
                Back to Settings
              </button>
              <Link href="/faq"
                className="px-6 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
                View FAQ
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'rgba(255,255,255,0.3)' }}>Support</p>
              <h1 className="font-bold text-white text-3xl mb-3">Report a Bug</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Found something broken? Tell us what happened and we&apos;ll fix it.
              </p>
            </div>

            <div className="flex flex-col gap-4">

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest block mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  What&apos;s the issue?
                </label>
                <div className="relative">
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full appearance-none rounded-2xl px-4 py-3.5 text-white text-sm outline-none pr-10"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: 16,
                    }}
                  >
                    {SUBJECTS.map(s => (
                      <option key={s} value={s} style={{ background: '#1a1a1a' }}>{s}</option>
                    ))}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>▾</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest block mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Describe what happened
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. When I tap 'Join Trip' on the feed, nothing happens and the button stays greyed out..."
                  rows={5}
                  className="w-full rounded-2xl px-4 py-3.5 text-white text-sm outline-none resize-none placeholder-white/20"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 16,
                  }}
                />
                <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Include steps to reproduce the bug if you can.
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest block mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Your email (optional — for follow-up)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-2xl px-4 py-3.5 text-white text-sm outline-none placeholder-white/20"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 16,
                  }}
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || description.trim().length < 10}
                className="w-full py-4 rounded-2xl text-sm font-bold mt-2 disabled:opacity-40 transition-opacity"
                style={{ background: '#F0EBE3', color: '#000' }}
              >
                {submitting ? 'Sending…' : 'Send Report'}
              </button>

              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                You can also email us directly at{' '}
                <a href="mailto:bugs@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  bugs@tripalong.app
                </a>
              </p>

            </div>
          </>
        )}
      </main>
    </div>
  )
}
