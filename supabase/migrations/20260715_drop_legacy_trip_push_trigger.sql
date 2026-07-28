-- Superseded by the client-triggered push path (src/app/api/push/send/route.ts),
-- which uses the current native_push_tokens/push_subscriptions tables and now
-- has the corrected "[Group] - [Sender]" title format. This legacy trigger
-- called an Edge Function reading the old single-column users.push_token
-- (still populated for 11 users), so those users were getting a second,
-- differently-formatted push for every trip chat message.
DROP TRIGGER IF EXISTS on_new_trip_message ON public.trip_messages;
