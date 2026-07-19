-- ============================================================
-- Unread badge fix — don't count your OWN messages as unread
--
-- SYMPTOM: the Messages-tab dot (and the global unread count) stays lit even
-- after you've clearly seen a thread — e.g. right after YOU send a message in
-- a group chat. It never clears.
--
-- ROOT CAUSE: get_total_unread_count sums two branches. The DM (`messages`)
-- branch already excludes the caller's own messages
-- (`msg.sender_id <> auth.uid()`), but the group-chat (`trip_messages`)
-- branch does NOT. So every message you send in a group chat counts as one
-- unread against yourself until last_read_at happens to advance past it —
-- which, on your own send, it may never reliably do. This re-creates the
-- function with the matching sender-exclusion on the trip_messages branch so
-- the two branches behave identically.
--
-- This is a straight copy of the live definition (see
-- 20260714_dm_delivery_fix.sql) with a single added predicate; safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_total_unread_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT SUM(unread)::bigint FROM (
      SELECT (
        SELECT COUNT(*)::bigint
        FROM trip_messages tm
        WHERE tm.trip_chat_id = tcm.trip_chat_id
          AND tm.type <> 'system'
          AND tm.sender_id <> auth.uid()          -- ← added: your own messages are never unread
          AND (tcm.last_read_at IS NULL OR tm.created_at > tcm.last_read_at)
      ) AS unread
      FROM trip_chat_members tcm
      WHERE tcm.user_id = auth.uid()
      UNION ALL
      SELECT (
        SELECT COUNT(*)::bigint
        FROM messages msg
        WHERE msg.conversation_id = cm.conversation_id
          AND msg.sender_id <> auth.uid()
          AND (cm.last_read_at IS NULL OR msg.created_at > cm.last_read_at)
      ) AS unread
      FROM conversation_members cm
      WHERE cm.user_id = auth.uid()
    ) AS counts
  ), 0)::bigint;
$function$;

-- ── FOLLOW-UP (per-chat list badge) ─────────────────────────────────────────
-- The per-group-chat unread_count shown in the conversations list comes from
-- the RPC `get_my_trip_chats`, which was created by hand in the Supabase
-- dashboard and is NOT in this repo, so it can't be patched here. It almost
-- certainly has the SAME missing exclusion in its per-chat unread subquery.
-- Fix it the same way — dump the current definition and re-create it with
-- `AND tm.sender_id <> auth.uid()` added to its unread count subquery:
--   select pg_get_functiondef('get_my_trip_chats'::regproc);
-- (get_my_dms, the DM equivalent, already excludes own messages — leave it.)
