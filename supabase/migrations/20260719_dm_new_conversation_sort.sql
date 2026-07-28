-- get_my_dms (defined in 20260714_dm_delivery_fix.sql) already falls back to
-- conversations.created_at when there's no message yet, via
-- COALESCE(m.created_at, c.created_at). That covers a truly brand-new DM,
-- but not the case where get_or_create_dm resolves to an existing-but-empty
-- conversation (e.g. matched a while ago, never messaged) — c.created_at is
-- old there too, so reopening it still doesn't bubble it to the top.
--
-- Fold in cm1.last_read_at (bumped to now() by markDMRead when the user opens
-- the DM) via GREATEST, so "just opened" counts as "most recent" the same as
-- "just created" — while conversations that already have messages keep
-- sorting purely by last_message_at, unaffected by read state.
CREATE OR REPLACE FUNCTION public.get_my_dms()
RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, other_user_id uuid, other_user_name text, other_user_photo text, last_message text, last_message_at timestamp with time zone, last_message_sender_id uuid, last_read_at timestamp with time zone, other_last_read_at timestamp with time zone, unread_count bigint, is_pinned boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.created_at,
    c.updated_at,
    u.id             AS other_user_id,
    u.name           AS other_user_name,
    u.profile_photo  AS other_user_photo,
    m.content        AS last_message,
    m.created_at     AS last_message_at,
    m.sender_id      AS last_message_sender_id,
    cm1.last_read_at,
    cm2.last_read_at AS other_last_read_at,
    (
      SELECT COUNT(*)::bigint
      FROM messages msg
      WHERE msg.conversation_id = c.id
        AND msg.sender_id <> auth.uid()
        AND (cm1.last_read_at IS NULL OR msg.created_at > cm1.last_read_at)
    ) AS unread_count,
    cm1.is_pinned
  FROM conversations c
  JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = auth.uid()
  JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id <> auth.uid()
  JOIN users u ON u.id = cm2.user_id
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.type = 'direct'
  ORDER BY
    cm1.is_pinned DESC,
    COALESCE(m.created_at, GREATEST(c.created_at, cm1.last_read_at)) DESC;
$function$;

-- NOTE: get_my_dms may since have been hand-edited directly in the Supabase
-- dashboard (this project's push-notification RPCs already drifted from
-- their repo definitions that way). Before assuming this migration is a
-- no-op, diff what's actually live with:
--   select pg_get_functiondef('get_my_dms'::regproc);
-- User must run this migration in the Supabase SQL editor.
