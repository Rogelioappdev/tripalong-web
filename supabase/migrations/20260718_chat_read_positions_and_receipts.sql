-- ============================================================
-- Group-chat read receipts / "who viewed" fix
--
-- SYMPTOM (b): the message Info sheet ("Read by" / "Delivered") in a group
-- chat is always empty, and the inline seen-by avatars never appear.
--
-- ROOT CAUSE: getChatMemberReadPositions() does a direct REST select on
-- trip_chat_members, which is subject to RLS. trip_chat_members was created by
-- hand in the dashboard (not in this repo); its DM twin conversation_members
-- is restricted to `USING (user_id = auth.uid())` (see 20260714), i.e. a user
-- can only read their OWN membership row. If trip_chat_members has the same
-- policy — which the empty receipts strongly imply — the query returns only
-- the caller, so there are never any "other" members to show as viewers.
--
-- FIX: read co-members' positions through a SECURITY DEFINER RPC that checks
-- the caller is a member of the chat and then returns every member's
-- last_read_at (+ name/photo), bypassing the restrictive row policy safely.
-- This mirrors how get_my_dms / get_my_trip_chats already cross the
-- membership boundary in this codebase.
--
-- SYMPTOM (a): a viewer's "seen" state only refreshes on the group chat's 30s
-- poll, so it looks like it "doesn't update until you re-open." The client now
-- also subscribes to trip_chat_members UPDATEs and invalidates on open; for
-- those realtime events to arrive the table must be in the realtime
-- publication (its DM twin was added in 20260714 — this does the same for
-- trip_chat_members). Filtered UPDATE events match on the NEW row, which
-- carries all columns, so REPLICA IDENTITY FULL is NOT required here.
--
-- Safe to re-run: CREATE OR REPLACE + guarded publication add.
-- ============================================================

-- ── 1. SECURITY DEFINER RPC: co-member read positions for a chat ────────────
CREATE OR REPLACE FUNCTION public.get_trip_chat_read_positions(p_chat_id uuid)
RETURNS TABLE(user_id uuid, last_read_at timestamptz, name text, profile_photo text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tcm.user_id, tcm.last_read_at, u.name, u.profile_photo
  FROM trip_chat_members tcm
  JOIN users u ON u.id = tcm.user_id
  WHERE tcm.trip_chat_id = p_chat_id
    -- Only members of this chat may read its receipts.
    AND EXISTS (
      SELECT 1 FROM trip_chat_members me
      WHERE me.trip_chat_id = p_chat_id
        AND me.user_id = auth.uid()
    );
$function$;

GRANT EXECUTE ON FUNCTION public.get_trip_chat_read_positions(uuid) TO authenticated;

-- ── 2. Realtime: make sure trip_chat_members streams UPDATEs ────────────────
-- So the sender's client is notified the moment another member's last_read_at
-- advances (viewer opened the thread), instead of waiting on the 30s poll.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_chat_members;
  END IF;
END $$;
