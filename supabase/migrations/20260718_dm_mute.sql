-- DM mute: adds is_muted to conversation_members (mirrors trip_chat_members.is_muted).
-- The client toggle reads/writes this column. Muting only silences PUSH — the two
-- DM push RPCs must also filter it (done separately; see note below), otherwise the
-- toggle persists but notifications still fire.
ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false;

-- STEP 2 (push suppression): the recipient-selector RPCs get_dm_native_push_tokens
-- and get_dm_push_subscriptions were applied by hand and aren't in this repo. Each
-- needs `AND cm.is_muted = false` on its conversation_members join, mirroring the
-- chat RPCs (see 20260701_native_push_tokens.sql:42). Dump the current defs with
--   select pg_get_functiondef('get_dm_native_push_tokens'::regproc);
--   select pg_get_functiondef('get_dm_push_subscriptions'::regproc);
-- then re-CREATE each with the mute filter added.
