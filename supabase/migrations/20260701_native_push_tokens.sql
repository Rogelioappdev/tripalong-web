-- ============================================================
-- native_push_tokens — Expo push tokens for the native app
-- Mirrors push_subscriptions' RLS pattern (user owns their own rows)
-- ============================================================

CREATE TABLE IF NOT EXISTS native_push_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token  text NOT NULL,
  platform         text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS native_push_tokens_user_id_idx ON native_push_tokens (user_id);

ALTER TABLE native_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own native tokens" ON native_push_tokens;

CREATE POLICY "Users manage own native tokens" ON native_push_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- get_chat_native_push_tokens — native equivalent of
-- get_chat_push_subscriptions, for fanning out Expo push notifications
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_chat_native_push_tokens(p_chat_id uuid, p_exclude_user_id uuid)
 RETURNS TABLE(expo_push_token text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT npt.expo_push_token
  FROM native_push_tokens npt
  JOIN trip_chat_members tcm ON tcm.user_id = npt.user_id
  WHERE tcm.trip_chat_id = p_chat_id
    AND npt.user_id != p_exclude_user_id
    AND tcm.is_muted = false
    AND EXISTS (
      SELECT 1 FROM trip_chat_members
      WHERE trip_chat_id = p_chat_id AND user_id = p_exclude_user_id
    );
$function$;
