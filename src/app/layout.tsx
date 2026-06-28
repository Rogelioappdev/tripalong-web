import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from '@/lib/providers'
import { PostHogProvider } from '@/components/PostHogProvider'
import { BottomTabBar } from '@/components/BottomTabBar'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'TripAlong',
  description: 'Find your travel crew',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8644781373903568"
          crossOrigin="anonymous"
        />
      </head>
      <body className={outfit.className} style={{ margin: 0, background: '#000', color: '#fff' }}>
        <PostHogProvider>
          <Providers>
            {children}
            <BottomTabBar />
          </Providers>
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
