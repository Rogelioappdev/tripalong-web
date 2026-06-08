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
}

export default nextConfig
