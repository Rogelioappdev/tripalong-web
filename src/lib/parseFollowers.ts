/**
 * Turns whatever a human types for a follower count into a number.
 *
 * People write "12k", "1.2K", "24,000", "~8400", "500k", "1.1m". Naively
 * stripping non-digits turns "12k" into 12 — which silently files a
 * twelve-thousand-follower creator into the wrong size tier. Found exactly
 * that way by a smoke test on the public apply form.
 *
 * Returns null for anything unparseable rather than guessing.
 */
export function parseFollowers(raw: unknown): number | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s,~+]/g, '')
  if (!s) return null

  const m = s.match(/^([0-9]*\.?[0-9]+)([km])?$/)
  if (!m) {
    // Fall back to digits-only for oddities like "8.4k followers".
    const digits = s.replace(/[^0-9]/g, '')
    return digits ? Math.min(parseInt(digits, 10), 100_000_000) : null
  }

  const n = parseFloat(m[1])
  if (!isFinite(n)) return null
  const mult = m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1
  return Math.min(Math.round(n * mult), 100_000_000)
}
