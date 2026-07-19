-- ============================================================
-- Message delete / "unsend" fix — group chats (trip_messages) + DMs (messages)
--
-- SYMPTOM: a user deletes/unsends their own message (text OR photo) and it
-- either doesn't go away, or briefly vanishes then reappears (optimistic
-- removal snaps back on the next 3s poll), and it never disappears for the
-- other participants in real time.
--
-- TWO root causes, both DB-side:
--
--  1. Realtime DELETE never fires. Both chat pages already subscribe to
--     postgres_changes DELETE events *with a filter*
--     (trip_chat_id=eq.<id> / conversation_id=eq.<id>). Supabase can only
--     evaluate a filter — and RLS — on a DELETE event when the table is set
--     to REPLICA IDENTITY FULL; with the default replica identity the "old"
--     record in the WAL contains only the primary key, so the filtered
--     subscription can never match and the event is dropped. Neither
--     trip_messages nor messages was ever set to FULL, so unsend never
--     propagates to other clients over realtime (only the sender's own
--     invalidate/refetch reflected it).
--
--  2. trip_messages delete RLS may be missing/diverged. These tables were
--     originally created by hand in the Supabase dashboard (see
--     20260714_dm_delivery_fix.sql). 20260606 committed a
--     "trip_messages_delete_own" policy and 20260714 re-asserted the DM
--     "messages_delete_own" policy, but the live trip_messages policy set was
--     never re-verified. If RLS is enabled with no working DELETE policy, the
--     delete silently affects 0 rows (no error) and the message stays. This
--     re-asserts the correct sender-owns-row DELETE policy on BOTH tables,
--     idempotently, so a hard delete by the sender always succeeds.
--
-- Photo vs text: delete is by primary key (id) and is type-agnostic, so this
-- covers image messages exactly the same as text ones.
--
-- Safe to re-run: every statement is guarded / idempotent.
-- ============================================================


-- ── 1. Delete RLS: the sender may hard-delete their own message ─────────────

ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_messages_delete_own" ON trip_messages;
CREATE POLICY "trip_messages_delete_own" ON trip_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());


-- ── 2. REPLICA IDENTITY FULL — so filtered realtime DELETE events fire ──────
-- Required for the existing DELETE subscriptions (which filter by
-- trip_chat_id / conversation_id) to receive events and for RLS to be
-- evaluated against the deleted row. Without this, unsend never reaches the
-- other participants over realtime.
ALTER TABLE trip_messages REPLICA IDENTITY FULL;
ALTER TABLE messages       REPLICA IDENTITY FULL;


-- ── 3. Make sure both tables are actually in the realtime publication ───────
-- messages/conversations/etc. were added in 20260714; trip_messages is
-- assumed already present (group INSERTs already stream live). Guarded so
-- ADD TABLE never throws on an existing member — keeps this idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
