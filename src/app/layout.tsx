import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { Providers } from '@/lib/providers'
import { BottomTabBar } from '@/components/BottomTabBar'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'TripAlong',
  description: 'Find your travel crew',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={outfit.className} style={{ margin: 0, background: '#000', color: '#fff' }}>
        <Providers>
          {children}
          <BottomTabBar />
        </Providers>
      </body>
    </html>
  )
}
