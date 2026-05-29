'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/NavBar'
import { supabase } from '@/lib/supabase'

// ── Primitives ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-12 h-7 rounded-full relative flex items-center shrink-0 transition-colors duration-200"
      style={{ backgroundColor: value ? '#30D158' : 'rgba(255,255,255,0.15)', padding: 2 }}
    >
      <div
        className="w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/30 text-xs font-semibold uppercase tracking-widest px-1 mb-2">{title}</p>
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function Row({
  label, sub, value, chevron, danger, right, onPress, border = true,
}: {
  label: string
  sub?: string
  value?: string
  chevron?: boolean
  danger?: boolean
  right?: React.ReactNode
  onPress?: () => void
  border?: boolean
}) {
  const inner = (
    <div className={`flex items-center justify-between px-4 py-3.5 ${border ? 'border-b' : ''}`}
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div>
        <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {value && <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{value}</span>}
        {right}
        {chevron && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</span>}
      </div>
    </div>
  )
  if (onPress) {
    return (
      <button type="button" onClick={onPress} className="w-full text-left active:bg-white/5 transition-colors">
        {inner}
      </button>
    )
  }
  return inner
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [provider, setProvider] = useState<string>('email')

  // Password change
  const [changingPw, setChangingPw] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  // Delete account
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'typing'>('idle')
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Notification toggles (localStorage)
  const [notifMessages, setNotifMessages] = useState(true)
  const [notifInvites, setNotifInvites] = useState(true)
  const [notifUpdates, setNotifUpdates] = useState(true)

  // Privacy toggles (localStorage)
  const [privOnline, setPrivOnline] = useState(true)
  const [privReceipts, setPrivReceipts] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      setEmail(user.email ?? '')
      const p = user.identities?.[0]?.provider ?? 'email'
      setProvider(p)
    })
    // Restore toggles from localStorage
    const load = (key: string, def: boolean) => {
      const v = localStorage.getItem(key)
      return v === null ? def : v === 'true'
    }
    setNotifMessages(load('ta_notif_messages', true))
    setNotifInvites(load('ta_notif_invites', true))
    setNotifUpdates(load('ta_notif_updates', true))
    setPrivOnline(load('ta_privacy_online', true))
    setPrivReceipts(load('ta_privacy_receipts', true))
  }, [router])

  const setToggle = (key: string, val: boolean) => {
    localStorage.setItem(key, String(val))
  }

  const handleChangePw = async () => {
    setPwError('')
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    setTimeout(() => { setPwSuccess(false); setChangingPw(false) }, 2000)
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <>
      <NavBar />
      <main className="pt-14 min-h-screen bg-black pb-28 md:pb-10">
        {/* Page header */}
        <div className="max-w-lg mx-auto px-5 pt-4 pb-2 flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="text-white/40 text-sm hover:text-white transition-colors">
            ← Back
          </button>
          <h1 className="text-white font-bold text-lg flex-1 text-center pr-10">Settings</h1>
        </div>

        <div className="max-w-lg mx-auto px-5 py-4 flex flex-col gap-5">

          {/* ── Account ── */}
          <Group title="Account">
            <Row label="Email" value={email} border />
            <Row label="Sign-in method" value={provider === 'google' ? 'Google' : 'Email & Password'} border={provider !== 'google'} />
            {provider !== 'google' && (
              <>
                <Row
                  label="Change Password"
                  chevron={!changingPw}
                  border={false}
                  onPress={changingPw ? undefined : () => setChangingPw(true)}
                />
                {changingPw && (
                  <div className="px-4 pb-4 flex flex-col gap-3"
                    style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                    {pwSuccess ? (
                      <p className="text-green-400 text-sm text-center py-2">Password updated ✓</p>
                    ) : (
                      <>
                        <input
                          type="password"
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          placeholder="New password"
                          className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 mt-3"
                          style={{ fontSize: 16 }}
                        />
                        <input
                          type="password"
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/30"
                          style={{ fontSize: 16 }}
                        />
                        {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setChangingPw(false); setNewPw(''); setConfirmPw(''); setPwError('') }}
                            className="flex-1 py-3 rounded-2xl text-sm"
                            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                            Cancel
                          </button>
                          <button type="button" onClick={handleChangePw} disabled={pwSaving}
                            className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-40"
                            style={{ backgroundColor: '#F0EBE3', color: '#000' }}>
                            {pwSaving ? 'Saving…' : 'Update'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </Group>

          {/* ── Notifications ── */}
          <Group title="Notifications">
            <Row label="New messages" sub="Someone sent you a message"
              right={<Toggle value={notifMessages} onChange={v => { setNotifMessages(v); setToggle('ta_notif_messages', v) }} />}
              border />
            <Row label="Trip invites" sub="You've been invited to a trip"
              right={<Toggle value={notifInvites} onChange={v => { setNotifInvites(v); setToggle('ta_notif_invites', v) }} />}
              border />
            <Row label="Trip activity" sub="New messages in your trips"
              right={<Toggle value={notifUpdates} onChange={v => { setNotifUpdates(v); setToggle('ta_notif_updates', v) }} />}
              border={false} />
          </Group>

          {/* ── Privacy ── */}
          <Group title="Privacy">
            <Row label="Show online status" sub="Others can see when you're active"
              right={<Toggle value={privOnline} onChange={v => { setPrivOnline(v); setToggle('ta_privacy_online', v) }} />}
              border />
            <Row label="Read receipts" sub="Show when you've read messages"
              right={<Toggle value={privReceipts} onChange={v => { setPrivReceipts(v); setToggle('ta_privacy_receipts', v) }} />}
              border={false} />
          </Group>

          {/* ── Support ── */}
          <Group title="Support">
            <Row label="Help & FAQ" chevron border
              onPress={() => window.open('mailto:support@tripalong.app', '_blank')} />
            <Row label="Report a bug" chevron border
              onPress={() => window.open('mailto:bugs@tripalong.app?subject=Bug report', '_blank')} />
            <Row label="Terms of Service" chevron border onPress={() => router.push('/terms')} />
            <Row label="Privacy Policy" chevron border={false} onPress={() => router.push('/privacy')} />
          </Group>

          {/* ── App info ── */}
          <Group title="About">
            <Row label="Version" value="1.0.0" border={false} />
          </Group>

          {/* ── Danger zone ── */}
          <Group title="Danger Zone">
            {deletePhase === 'idle' && (
              <Row label="Delete Account" danger chevron border={false}
                onPress={() => setDeletePhase('confirm')} />
            )}
            {deletePhase === 'confirm' && (
              <div className="px-4 py-4 flex flex-col gap-3">
                <p className="text-white/70 text-sm leading-relaxed">
                  This will permanently delete your account, profile, messages, and trips. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDeletePhase('idle')}
                    className="flex-1 py-3 rounded-2xl text-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => setDeletePhase('typing')}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                    style={{ backgroundColor: '#FF3B30', color: '#fff' }}>
                    Continue
                  </button>
                </div>
              </div>
            )}
            {deletePhase === 'typing' && (
              <div className="px-4 py-4 flex flex-col gap-3">
                <p className="text-white/60 text-sm">
                  Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm
                </p>
                <input
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-white/6 border rounded-2xl px-4 py-3 text-red-400 font-mono text-sm outline-none"
                  style={{ borderColor: deleteInput === 'DELETE' ? '#FF3B30' : 'rgba(255,255,255,0.12)', fontSize: 16 }}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDeletePhase('idle'); setDeleteInput('') }}
                    className="flex-1 py-3 rounded-2xl text-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleDeleteAccount}
                    disabled={deleteInput !== 'DELETE' || deleting}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-30"
                    style={{ backgroundColor: '#FF3B30', color: '#fff' }}>
                    {deleting ? 'Deleting…' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            )}
          </Group>

        </div>
      </main>
    </>
  )
}
