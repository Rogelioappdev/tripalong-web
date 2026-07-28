// Chat/DM message content is either plain text or a Supabase Storage URL
// (photo or video) — the `type` column tells you which when the full message
// object is available, but list/reply previews sometimes only have the raw
// content string, so this falls back to sniffing the file extension.
export function mediaPreviewLabel(content: string | null | undefined): string | null {
  if (!content || !content.startsWith('https://')) return null
  return /\.(mp4|mov|webm)($|\?)/i.test(content) ? '🎥 Video' : '📷 Photo'
}
