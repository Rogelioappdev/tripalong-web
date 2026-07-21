-- DM reactions never worked: toggleReaction() inserted into message_reactions,
-- whose message_id FK only references trip_messages(id) — a DM message id
-- (from the separate `messages` table) always failed that FK check, and the
-- DM message query didn't even select reactions in the first place. Mirror
-- message_reactions but scoped to `messages` for DMs.
create table dm_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id),
  unique (message_id, user_id, emoji)
);

create index idx_dm_message_reactions_user_id on dm_message_reactions(user_id);

alter table dm_message_reactions enable row level security;

create policy "Anyone in chat can view reactions" on dm_message_reactions
  for select using (true);

create policy "Users can add own reactions" on dm_message_reactions
  for insert with check ((select auth.uid()) = user_id);

create policy "Users can remove own reactions" on dm_message_reactions
  for delete using ((select auth.uid()) = user_id);
