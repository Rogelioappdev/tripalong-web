'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const SECTIONS = [
  {
    title: '🚀 Getting Started',
    items: [
      {
        q: 'What is TripAlong?',
        a: 'TripAlong is a travel-social app that connects you with people who share your travel style. You can browse and join trips others are planning, create your own trip and invite people, and chat with your travel crew — all in one place.',
      },
      {
        q: 'Is TripAlong free to use?',
        a: 'Yes, TripAlong is completely free. Create an account, browse trips, and connect with other travelers at no cost.',
      },
      {
        q: 'How do I create an account?',
        a: 'Download the app or visit tripalong.app and sign up with your email and a password, or continue with Google. After signing up you\'ll go through a quick onboarding to set up your profile and Travel DNA.',
      },
      {
        q: 'What is Travel DNA?',
        a: 'Travel DNA is your personal travel profile — it captures your travel style, daily pace, social energy, planning style, experience level, and who you prefer to travel with. It helps us surface trips and people that are a good match for you.',
      },
    ],
  },
  {
    title: '✈️ Trips',
    items: [
      {
        q: 'How do I create a trip?',
        a: 'Tap the + button in the bottom bar to open the Create Trip screen. Fill in the destination, dates, a short description, and optionally a cover photo. Once created, your trip appears on the feed for others to discover and join.',
      },
      {
        q: 'How do I join a trip?',
        a: 'Browse the feed and tap on any trip card that interests you. On the trip detail page, tap "Join Trip." You\'ll be added to the trip\'s group chat immediately.',
      },
      {
        q: 'Can I leave a trip I joined?',
        a: 'Yes. Open the trip chat, tap the ⓘ info icon in the top right to open Group Info, then scroll to the bottom and tap "Leave Trip."',
      },
      {
        q: 'Can I delete a trip I created?',
        a: 'Yes. Open the trip, tap ⓘ for Group Info, and use the Delete Trip option. This removes the trip and its chat for all members.',
      },
      {
        q: 'How many people can join a trip?',
        a: 'There is currently no hard cap on trip members. You can keep your trip open for anyone to join, or message members directly to manage the group.',
      },
    ],
  },
  {
    title: '💬 Chat',
    items: [
      {
        q: 'How does the group chat work?',
        a: 'Every trip has a group chat that all trip members can see and post in. Messages appear in real time. You can react to messages, reply to specific messages, and see read receipts.',
      },
      {
        q: 'Can I message someone directly?',
        a: 'Yes. Tap on anyone\'s profile and use the message button to start a direct message (DM). DMs are private between you and that person.',
      },
      {
        q: 'How do I mute a trip chat?',
        a: 'Open the trip chat, tap ⓘ for Group Info, then tap the bell icon in the top right of the sheet to mute notifications for that conversation. The trip will still appear in your messages list but won\'t notify you.',
      },
      {
        q: 'Can I delete a message I sent?',
        a: 'Press and hold any message you sent to open the message menu, then select Delete.',
      },
    ],
  },
  {
    title: '👤 Profile',
    items: [
      {
        q: 'How do I edit my profile?',
        a: 'Go to the Profile tab. Tap Edit next to your name and bio to update your basic info. Tap any Travel DNA row to update that field individually. Tap the photo grid to add or remove photos.',
      },
      {
        q: 'Can other users see my profile?',
        a: 'Yes — your profile (name, photos, bio, age, location, and Travel DNA) is visible to all logged-in TripAlong users when you appear on the feed or in a trip. You can preview exactly what others see by tapping the 👁 Preview button on your profile.',
      },
      {
        q: 'How do I change my profile photo?',
        a: 'On your Profile tab, tap the 📷 Change photo button overlaid on your main photo. Select an image from your camera roll.',
      },
      {
        q: 'How do I hide my online status or read receipts?',
        a: 'Go to Settings (gear icon on the Profile tab) → Privacy. You can toggle "Show online status" and "Read receipts" off independently.',
      },
    ],
  },
  {
    title: '🔒 Account & Security',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Settings → Account → Change Password. Enter your new password twice and tap Update. Passwords must be at least 8 characters.',
      },
      {
        q: 'I signed in with Google — can I set a password?',
        a: 'Google Sign-In accounts don\'t use a TripAlong password. Your login is managed entirely by Google. To change your Google password, visit myaccount.google.com.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings → Danger Zone → Delete Account. You\'ll be asked to confirm by typing DELETE. Once confirmed, your account, profile, messages, and trips are permanently removed. This cannot be undone.',
      },
      {
        q: 'How do I report a user?',
        a: 'Press and hold a message from that user in any chat and select Report, or visit their profile and use the report option. You can also email us at support@tripalong.app with the user\'s name and details.',
      },
      {
        q: 'What should I do if I feel unsafe?',
        a: 'If you are in immediate danger, contact local emergency services. To report a safety concern to TripAlong, email safety@tripalong.app. We take all safety reports seriously and respond promptly.',
      },
    ],
  },
  {
    title: '🛡️ Privacy',
    items: [
      {
        q: 'Who can see my messages?',
        a: 'Group chat messages are visible to all members of that trip. Direct messages are visible only to you and the recipient. TripAlong staff may access messages only when investigating reported safety or abuse issues.',
      },
      {
        q: 'Does TripAlong sell my data?',
        a: 'No. We do not sell your personal information to third parties or advertisers. See our Privacy Policy for full details.',
      },
      {
        q: 'How do I request a copy of my data?',
        a: 'Email privacy@tripalong.app with subject "Data Request" and we will send you a copy of your personal data within 30 days.',
      },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-white leading-snug flex-1">{q}</span>
        <span className="text-lg shrink-0 mt-0.5 transition-transform duration-200"
          style={{ color: 'rgba(255,255,255,0.3)', transform: open ? 'rotate(45deg)' : 'none' }}>
          +
        </span>
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {a}
        </p>
      )}
    </div>
  )
}

export default function FaqPage() {
  const router = useRouter()
  return (
    <div style={{ background: '#080808', minHeight: '100vh' }}>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b flex items-center justify-between px-5 pb-3"
        style={{ background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.07)', paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <Link href="/" className="font-bold text-white text-base tracking-tight">TripAlong</Link>
        <button type="button" onClick={() => router.back()}
          className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Back
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-5 pb-36 pt-10">

        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>Support</p>
          <h1 className="font-bold text-white text-3xl mb-3">Help & FAQ</h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Answers to the most common questions about TripAlong. Can&apos;t find what you need?{' '}
            <a href="mailto:support@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Email us
            </a>.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-xs font-semibold uppercase tracking-widest px-1 mb-2"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {section.title}
              </p>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {section.items.map(item => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-white font-semibold mb-1">Still need help?</p>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Our team usually responds within 24 hours.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="mailto:support@tripalong.app"
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold"
              style={{ background: '#F0EBE3', color: '#000' }}>
              Email Support
            </a>
            <Link href="/report-bug"
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
              Report a Bug
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-5 mt-12 pt-8 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Link href="/" className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>← Back to TripAlong</Link>
          <Link href="/terms" className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Terms of Service</Link>
          <Link href="/privacy" className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Privacy Policy</Link>
        </div>
      </main>
    </div>
  )
}
