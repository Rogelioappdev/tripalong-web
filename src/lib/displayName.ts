// A traveler's display name, with a clean fallback for missing names.
// Some users never set a name (null/empty), and legacy rows can hold the
// placeholder string "Unknown". Normalize them all to "Traveler" — the same
// fallback used across the app (TripDetailModal, HangDetailModal, etc.) — so
// the chat never shows "Unknown" or a blank label.
export function displayName(name?: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return 'Traveler'
  return trimmed
}
