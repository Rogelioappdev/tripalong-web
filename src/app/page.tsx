'use client'

import { useState } from 'react'

export default function Home() {
  const [tapped, setTapped] = useState(false)

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-4xl font-bold text-white">TripAlong</h1>
      <button
        type="button"
        onClick={() => setTapped(true)}
        className="bg-white text-black font-semibold px-8 py-4 rounded-2xl w-full max-w-sm"
        style={{ touchAction: 'manipulation' }}
      >
        {tapped ? 'It works! ✓' : 'Tap me'}
      </button>
    </main>
  )
}
