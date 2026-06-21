import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import Script from 'next/script'
import { Providers } from '@/lib/providers'
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
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4803256414426915"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={outfit.className} style={{ margin: 0, background: '#000', color: '#fff' }}>
        <Providers>
          {children}
          <BottomTabBar />
        </Providers>
      </body>
    </html>
  )
}
