// Requests a resized/recompressed variant of a Supabase Storage public URL via
// its on-the-fly image transformation endpoint, instead of shipping the full
// original upload (up to 1440px) to every avatar chip and card. Non-Supabase
// URLs (e.g. a Google OAuth profile photo) pass through unchanged.
const OBJECT_PATH = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'

// width-only requests don't do what they look like they do: verified live that
// Supabase's transform endpoint returns the ORIGINAL height untouched when only
// `width` is set (e.g. width=100 on a 1179x2556 photo comes back 100x2556, not
// 100x216) — no proportional scaling, and no file-size win either, since the
// tall dimension never actually shrinks. That 100x2556 sliver is then what
// object-fit:cover has to crop a square avatar out of, landing on a near-random
// strip of the photo instead of the face. Passing an explicit height + resize:
// cover makes the transform actually crop server-side, which is what every call
// site here already assumes it's getting.
export function resizedImage(url: string | null | undefined, width: number, quality = 70, height?: number): string {
  if (!url) return ''
  if (!url.includes(OBJECT_PATH)) return url
  const [path, query] = url.split('?')
  const params = new URLSearchParams(query)
  params.set('width', String(width))
  params.set('quality', String(quality))
  if (height) {
    params.set('height', String(height))
    params.set('resize', 'cover')
  }
  return `${path.replace(OBJECT_PATH, RENDER_PATH)}?${params.toString()}`
}

// Square person-avatar variant — every avatar chip in the app is a circle or
// rounded-square, so width and height are always equal.
export function resizedAvatar(url: string | null | undefined, size: number, quality = 70): string {
  return resizedImage(url, size, quality, size)
}
