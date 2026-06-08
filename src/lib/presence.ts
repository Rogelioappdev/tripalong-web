'use client'

import { supabase } from './supabase'
import { useEffect, useState } from 'react'

// ── Singleton presence channel ─────────────────────────────────────────────
let _channel: ReturnType<typeof supabase.channel> | null = null
let _onlineUsers = new Set<string>()
const _listeners = new Set<(u: Set<string>) => void>()

function _notify() {
  const snap = new Set(_onlineUsers)
  _listeners.forEach(fn => fn(snap))
}

async function _updateLastSeen(userId: string) {
  await supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
}

// Call once when userId is known — safe to call multiple times (no-op after first)
export function initPresence(userId: string) {
  if (_channel) return

  _updateLastSeen(userId)
  setInterval(() => _updateLastSeen(userId), 300_000) // 5 min — was 60s, 5x fewer DB writes

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') _updateLastSeen(userId)
    })
  }

  _channel = supabase
    .channel('tripalong:presence')
    .on('presence', { event: 'sync' }, () => {
      if (!_channel) return
      const state = _channel.presenceState<{ user_id: string }>()
      _onlineUsers = new Set(
        Object.values(state)
          .flat()
          .map((p: any) => p.user_id)
          .filter(Boolean)
      )
      _notify()
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await _channel!.track({ user_id: userId })
      }
    })
}

// React hook — returns live Set of online user IDs
export function useOnlineUsers(): Set<string> {
  const [users, setUsers] = useState<Set<string>>(() => new Set(_onlineUsers))

  useEffect(() => {
    _listeners.add(setUsers)
    setUsers(new Set(_onlineUsers))
    return () => { _listeners.delete(setUsers) }
  }, [])

  return users
}

// Format presence status — Instagram style
export function formatLastSeen(dateStr: string | null | undefined, isOnline: boolean): string {
  if (isOnline) return 'Active now'
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 120) return 'Active just now'
  if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `Active ${Math.floor(diff / 86400)}d ago`
  return `Active ${new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
