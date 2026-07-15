// Requests a resized/recompressed variant of a Supabase Storage public URL via
// its on-the-fly image transformation endpoint, instead of shipping the full
// original upload (up to 1440px) to every avatar chip and card. Non-Supabase
// URLs (e.g. a Google OAuth profile photo) pass through unchanged.
const OBJECT_PATH = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'

export function resizedImage(url: string | null | undefined, width: number, quality = 70): string {
  if (!url) return ''
  if (!url.includes(OBJECT_PATH)) return url
  const [path, query] = url.split('?')
  const params = new URLSearchParams(query)
  params.set('width', String(width))
  params.set('quality', String(quality))
  return `${path.replace(OBJECT_PATH, RENDER_PATH)}?${params.toString()}`
}
