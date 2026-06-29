'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import dynamicImport from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { getHangalongs, getUserJoinedHangalongIds } from '@/lib/queries'
import { HangSwipeStack } from '@/components/HangSwipeStack'
import { haptic } from '@/lib/haptics'
import type { HangalongWithDetails } from '@/lib/types'

const CreateHangModal = dynamicImport(() => import('@/components/CreateHangModal').then(m => ({ default: m.CreateHangModal })), { ssr: false })
const HangDetailModal = dynamicImport(() => import('@/components/HangDetailModal').then(m => ({ default: m.HangDetailModal })), { ssr: false })
const AuthGate = dynamicImport(() => import('@/components/AuthGate').then(m => ({ default: m.AuthGate })), { ssr: false })

const TAB_BAR_CLEARANCE = 82

function getDynamicHeader(): string {
  const hour = new Date().getHours()
  const day = new Date().getDay() // 0 = Sun, 5 = Fri, 6 = Sat
  if (day === 5 || day === 6) return 'Plans for the weekend?'
  if (day === 0) return 'One more adventure before the week starts'
  if (hour >= 17) return 'Plans for tonight?'
  return 'What are you doing this weekend?'
}

export default function HangPage() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [selectedHang, setSelectedHang] = useState<HangalongWithDetails | null>(null)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [joinToast, setJoinToast] = useState<HangalongWithDetails | null>(null)
  const header = getDynamicHeader()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setUserId(session.user.id)
      const ids = await getUserJoinedHangalongIds(session.user.id)
      setJoinedIds(new Set(ids))
    })
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const { data: hangalongs, isLoading, isError, refetch } = useQuery({
    queryKey: ['hangalongs'],
    queryFn: getHangalongs,
    staleTime: 2 * 60 * 1000,
  })

  function handleJoin(hang: HangalongWithDetails) {
    setJoinToast(hang)
    setTimeout(() => setJoinToast(null), 3000)
  }

  function handleJoinedIdsChange(ids: Set<string>) {
    setJoinedIds(ids)
  }

  function handleDetailJoinChange(joined: boolean) {
    if (!selectedHang) return
    const next = new Set(joinedIds)
    if (joined) {
      next.add(selectedHang.id)
      handleJoin(selectedHang)
    } else {
      next.delete(selectedHang.id)
    }
    setJoinedIds(next)
    queryClient.invalidateQueries({ queryKey: ['hangalongs'] })
  }

  return (
    <>
      <main className="bg-black flex flex-col" style={{ height: '100dvh', overflow: 'hidden' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 10 }}
        >
          <div>
            <p className="text-white/35 text-xs font-semibold tracking-wide uppercase mb-0.5">HangAlong</p>
            <h1 className="text-white font-extrabold text-xl leading-tight">{header}</h1>
          </div>
          <button
            onClick={() => { haptic(8); userId ? setShowCreate(true) : setShowAuthGate(true) }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span className="text-white text-xs font-semibold">Post</span>
          </button>
        </div>

        {/* Card area */}
        <div
          className="flex-1 min-h-0 flex items-stretch justify-center px-3"
          style={{ paddingBottom: TAB_BAR_CLEARANCE }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 w-full">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-white/30 text-sm">Loading hangalongs...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 w-full">
              <p className="text-white/30 text-sm">Couldn't load hangalongs</p>
              <button onClick={() => refetch()} className="px-5 py-2.5 rounded-2xl text-sm font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                Try again
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm h-full">
              <HangSwipeStack
                hangalongs={hangalongs ?? []}
                userId={userId}
                onHangTap={setSelectedHang}
                onJoin={handleJoin}
                onAuthRequired={() => setShowAuthGate(true)}
                joinedIds={joinedIds}
                onJoinedIdsChange={handleJoinedIdsChange}
              />
            </div>
          )}
        </div>
      </main>

      {/* Join toast */}
      <AnimatePresence>
        {joinToast && (
          <div
            className="fixed left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 90px)',
              backgroundColor: 'rgba(18,18,18,0.97)',
              border: '0.5px solid rgba(74,222,128,0.35)',
              backdropFilter: 'blur(24px)',
              maxWidth: 400,
              margin: '0 auto',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">You're in! 🙌</p>
              <p className="text-white/40 text-xs mt-0.5 truncate">{joinToast.title}</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedHang && (
          <HangDetailModal
            hang={selectedHang}
            userId={userId}
            isJoined={joinedIds.has(selectedHang.id)}
            onClose={() => setSelectedHang(null)}
            onJoinChange={handleDetailJoinChange}
            onAuthRequired={() => setShowAuthGate(true)}
          />
        )}
      </AnimatePresence>

      {showCreate && (
        <CreateHangModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['hangalongs'] })
            setShowCreate(false)
          }}
        />
      )}

      <AnimatePresence>
        {showAuthGate && (
          <AuthGate onClose={() => setShowAuthGate(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
