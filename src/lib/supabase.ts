import { createClient } from '@supabase/supabase-js'

// Auth is configured to stay signed in indefinitely: the session is persisted
// to storage and the token is refreshed automatically, so the only thing that
// ends a session is the user tapping "Log out" (an explicit signOut() call).
//
// NOTE: we deliberately do NOT set a custom `storageKey` — changing it would
// orphan every already-signed-in user's stored session and log them all out on
// the next load. These options are the library defaults made explicit so the
// behavior can't silently regress; the real "don't log me out" work is the
// foreground-refresh keeper in SessionKeeper.tsx.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true, // keep the session in storage across app launches
      autoRefreshToken: true, // rotate the access token before it expires
      detectSessionInUrl: true, // needed for the magic-link / OAuth callback
    },
  },
)
