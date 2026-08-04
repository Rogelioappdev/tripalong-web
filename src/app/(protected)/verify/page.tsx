'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/lib/queries'
import { LiveVerificationCapture } from '@/components/onboarding/LiveVerificationCapture'

type VerificationStatus = 'loading' | 'none' | 'pending' | 'verified' | 'rejected'

// Always-available entry point for photo verification — the onboarding step
// (src/app/(protected)/onboarding/page.tsx, 'verifyPhoto') captures the
// selfie once during signup, but this page is what "Get Verified" on Profile
// links to, both for anyone who wants to see their current status and
// (once rejected) to retry.
export default function VerifyPage() {
  const router = useRouter()
  const [status, setStatus] = useState<VerificationStatus>('loading')

  const loadStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }
    const profile = await getProfile(user.id)
    if (profile?.is_verified) { setStatus('verified'); return }
    const { data: row } = await supabase
      .from('photo_verifications')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setStatus(row?.status === 'pending' ? 'pending' : row?.status === 'rejected' ? 'rejected' : 'none')
  }

  useEffect(() => { loadStatus() }, [])

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div className="max-w-sm mx-auto w-full px-6 pb-12 flex flex-col min-h-screen" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="text-white/30 text-sm">← Back</button>
          <span className="text-white/30 text-sm">Get Verified</span>
          <span className="w-10" />
        </div>

        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {status === 'verified' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#3B82F6" />
              <path d="M8 12.5l2.5 2.5L16 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h1 className="text-white font-extrabold text-xl mb-1">You're verified</h1>
              <p className="text-white/40 text-sm">Your profile now shows the verified badge.</p>
            </div>
          </div>
        )}

        {status === 'pending' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-5xl">⏳</span>
            <div>
              <h1 className="text-white font-extrabold text-xl mb-1">Verification pending</h1>
              <p className="text-white/40 text-sm max-w-[240px]">We're reviewing your photo — this usually takes a day. Check back soon.</p>
            </div>
          </div>
        )}

        {(status === 'none' || status === 'rejected') && (
          <>
            {status === 'rejected' && (
              <div className="mb-4 rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,69,58,0.08)', border: '0.5px solid rgba(255,69,58,0.25)' }}>
                <p className="text-white/70 text-sm font-medium">Your last attempt wasn't approved — give it another try.</p>
              </div>
            )}
            <LiveVerificationCapture onComplete={() => setStatus('pending')} />
          </>
        )}
      </div>
    </main>
  )
}
