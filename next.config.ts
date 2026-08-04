import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tnstvbxngubfuxatggem.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'staticfiles.net' },
    ],
    formats: ['image/avif', 'image/webp'], // serve modern formats — 40-60% smaller than JPEG
    minimumCacheTTL: 86400,                // cache optimized images 24h on CDN
    deviceSizes: [390, 768, 1080],         // match typical mobile + tablet + desktop
  },
  // Compress all responses
  compress: true,
  // Disable x-powered-by header (minor security + perf)
  poweredByHeader: false,
  // `dynamic = 'force-dynamic'` on pages like /feed and /onboarding was NOT
  // enough — Vercel's edge was still caching the HTML response and serving
  // stale HITs hours old (confirmed via curl: x-vercel-cache: HIT, age >3h),
  // so auth/redirect logic changes deployed correctly on the server were
  // invisible to real users hitting a cached copy. `max-age=0, must-revalidate`
  // was apparently not strong enough a signal — force real `no-store` on every
  // page route so this can never happen again. Static assets under
  // /_next/static and /_next/image are untouched and keep their own caching.
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
