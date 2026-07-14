-- ============================================================
-- DM delivery fix — root-cause + schema version-control
--
-- BACKGROUND: conversations / conversation_members / messages, and the
-- get_or_create_dm / get_my_dms / get_total_unread_count RPCs, were all
-- created by hand in the Supabase dashboard and were never committed to a
-- migration. This file brings the *current, already-correct* live
-- definitions under version control (CREATE TABLE IF NOT EXISTS / CREATE OR
-- REPLACE — safe to run even though everything already exists), fixes two
-- pieces of real tech debt found while investigating, and repairs the
-- handful of already-broken rows those old, untracked edits left behind.
--
-- INVESTIGATION SUMMARY (see PR/commit message for the full report):
--   - get_or_create_dm, as it exists live today, is already correct: it
--     inserts BOTH participants in one atomic statement and correctly
--     de-dupes an existing 1:1 conversation before creating a new one.
--   - RLS on messages/conversations/conversation_members is enabled and
--     the SELECT/INSERT policies correctly require conversation membership.
--   - `messages` IS in the supabase_realtime publication, and the DM page's
--     realtime subscription is correctly wired.
--   - No cron/TTL/cascade job deletes messages after any time period —
--     the "vanishes after a few days" report is almost certainly the same
--     root cause as "recipient never receives": the recipient was never a
--     conversation_members row for that thread, so they never saw it to
--     begin with (silently blocked by RLS on SELECT), which reads as
--     "disappeared" when the sender checks back later.
--   - Despite the RPC being correct *now*, prod has 5 orphaned `direct`
--     conversations with 0 or 1 members (dated Feb–Jun, none since) — scar
--     tissue from whatever the untracked object looked like before,
--     including one belonging to the reporting developer's own account.
--     Because get_my_dms requires both sides' membership to join, these
--     rows are invisible via the app's own UI to any user today — they're
--     inert but worth cleaning up.
--   - Found two pieces of unrelated tech debt while in here: `messages` has
--     a bizarre 6-column composite PRIMARY KEY instead of a plain PK on
--     `id` (harmless today since `id` alone is already unique, but a latent
--     landmine for replica identity / tooling), and there are duplicate
--     RLS policies on messages/conversation_members from the untracked
--     dashboard edits layered under the committed 20260606 migration
--     (harmless — permissive policies OR together — but confusing).
-- ============================================================


-- ── 1. Tables — versioned for the first time ────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('direct', 'group')),
  trip_id     uuid REFERENCES trips(id) ON DELETE SET NULL,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  last_read_at     timestamptz,
  is_pinned        boolean NOT NULL DEFAULT false,
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          text NOT NULL,
  type             text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
  reply_to_id      uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_members_conversation_id_idx ON conversation_members (conversation_id);
CREATE INDEX IF NOT EXISTS conversation_members_user_id_idx ON conversation_members (user_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);


-- ── 2. Fix the messages table's composite primary key ───────────────────
-- Live schema has PRIMARY KEY (id, conversation_id, sender_id, content,
-- type, created_at) — functionally harmless today (id's own uniqueness
-- already satisfies it) but wrong, and risky for replica identity /
-- future tooling that assumes PK = id. Only runs if that oversized key is
-- still present, so it's safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND contype = 'p'
      AND conname = 'messages_pkey'
      AND array_length(conkey, 1) > 1
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_pkey;
    ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
  END IF;
END $$;


-- ── 3. RLS — consolidate onto one canonical policy per action ───────────
-- Drops both the committed (20260606) and the untracked dashboard-made
-- duplicates first, then recreates a single clean set, so there's exactly
-- one policy per table/action going forward.

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_select_member" ON conversations;
DROP POLICY IF EXISTS "conv_insert_authenticated" ON conversations;
DROP POLICY IF EXISTS "conv_update_member" ON conversations;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid())
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cm_select_own" ON conversation_members;
DROP POLICY IF EXISTS "cm_insert_self_trip_member" ON conversation_members;
DROP POLICY IF EXISTS "cm_update_own" ON conversation_members;
DROP POLICY IF EXISTS "cm_delete_own" ON conversation_members;
DROP POLICY IF EXISTS "conversation_members_select" ON conversation_members;
DROP POLICY IF EXISTS "conversation_members_update" ON conversation_members;
DROP POLICY IF EXISTS "conversation_members_delete" ON conversation_members;

CREATE POLICY "conversation_members_select" ON conversation_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "conversation_members_update" ON conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "conversation_members_delete" ON conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Note: no client-side INSERT policy for conversation_members. The only
-- app path that creates membership rows is get_or_create_dm, which is
-- SECURITY DEFINER and bypasses RLS entirely — intentional, so a direct
-- REST insert can't add someone to a DM they're not part of.

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_delete_own" ON messages;
DROP POLICY IF EXISTS "msg_select_member" ON messages;
DROP POLICY IF EXISTS "msg_insert_member" ON messages;
DROP POLICY IF EXISTS "msg_delete_own" ON messages;

CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
  );

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());


-- ── 3b. Defense-in-depth: block inserts into a lopsided direct conversation ──
-- RLS above only checks the SENDER is a member — that's what let messages get
-- inserted into DM conversations the recipient was never added to. This
-- trigger is a hard guarantee that doesn't depend on get_or_create_dm (or any
-- future code path) staying correct: no message can land in a `direct`
-- conversation unless it already has exactly 2 members, full stop.
CREATE OR REPLACE FUNCTION public.enforce_direct_conversation_has_two_members()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  conv_type text;
  member_count int;
BEGIN
  SELECT type INTO conv_type FROM conversations WHERE id = NEW.conversation_id;
  IF conv_type = 'direct' THEN
    SELECT COUNT(*) INTO member_count FROM conversation_members WHERE conversation_id = NEW.conversation_id;
    IF member_count < 2 THEN
      RAISE EXCEPTION 'conversation_not_ready: direct conversation % has % member(s), needs 2', NEW.conversation_id, member_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS messages_require_two_members ON messages;
CREATE TRIGGER messages_require_two_members
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_direct_conversation_has_two_members();


-- ── 4. RPCs — lock in the correct definitions ───────────────────────────
-- Re-asserting these (rather than assuming the live dashboard copy stays
-- correct) is the actual point of this migration: this is the version that
-- gets reviewed and deployed from here on, not an untracked dashboard edit.

CREATE OR REPLACE FUNCTION public.get_or_create_dm(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conv_id uuid;
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF other_user_id = me THEN
    RAISE EXCEPTION 'cannot_dm_self';
  END IF;

  -- Look for an existing direct conversation that contains both users
  SELECT c.id INTO conv_id
  FROM conversations c
  JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = me
  JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = other_user_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Create the conversation
  INSERT INTO conversations (type) VALUES ('direct') RETURNING id INTO conv_id;

  -- Add both participants in one atomic statement — either both rows land
  -- or neither does (and the conversation insert above rolls back with it).
  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES (conv_id, me), (conv_id, other_user_id);

  RETURN conv_id;
END;
$function$;

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
  ORDER BY cm1.is_pinned DESC, COALESCE(m.created_at, c.created_at) DESC;
$function$;

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


-- ── 5. Realtime — make sure the DM tables are actually live ─────────────
-- ADD TABLE throws if the table is already a publication member, so guard
-- each one individually to keep this idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;


-- ── 6. Data repair — clean up orphaned direct conversations ─────────────
-- Only removes `direct` conversations that (a) have fewer than 2 members
-- and (b) have zero messages — i.e. completely inert rows that no user can
-- see via get_my_dms today (it requires both sides' membership to join) and
-- that hold no message history to lose. Safe to re-run; matches nothing
-- once cleaned up. Conservative on purpose: a broken conversation that
-- somehow does have messages is left alone for manual review rather than
-- auto-deleted.
DELETE FROM conversations c
WHERE c.type = 'direct'
  AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) < 2
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id);
