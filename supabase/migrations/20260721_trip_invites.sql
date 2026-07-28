-- Direct in-app trip invites: a trip member picks a "friend" (someone they
-- share a DM or an existing trip with) and invites them onto an existing
-- trip. Distinct from the existing link-share invite in TripGroupInfoSheet,
-- which has no specific recipient and no accept/reject step.
create table trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  invited_by uuid not null references users(id) on delete cascade,
  invited_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (trip_id, invited_user_id)
);

create index idx_trip_invites_invited_user on trip_invites(invited_user_id) where status = 'pending';
create index idx_trip_invites_trip on trip_invites(trip_id);

alter table trip_invites enable row level security;

create policy "Invitee and inviter can view their invites" on trip_invites
  for select using ((select auth.uid()) = invited_user_id or (select auth.uid()) = invited_by);

create policy "Trip members can invite others" on trip_invites
  for insert with check (
    (select auth.uid()) = invited_by
    and exists (
      select 1 from trip_members
      where trip_members.trip_id = trip_invites.trip_id
        and trip_members.user_id = (select auth.uid())
        and trip_members.status = 'in'
    )
  );

-- Two update policies: the invitee accepts/rejects; the inviter may re-send
-- (upsert back to pending) an invite that wasn't already accepted, e.g. after
-- a rejection.
create policy "Invitee can respond to their invite" on trip_invites
  for update using ((select auth.uid()) = invited_user_id)
  with check ((select auth.uid()) = invited_user_id);

create policy "Inviter can re-send a non-accepted invite" on trip_invites
  for update using ((select auth.uid()) = invited_by and status <> 'accepted')
  with check ((select auth.uid()) = invited_by);

create policy "Inviter can cancel a pending invite" on trip_invites
  for delete using ((select auth.uid()) = invited_by);

-- "Friends" = anyone you share a DM conversation with, or anyone you share
-- an active trip with. No dedicated friends table — this is computed live.
create or replace function get_my_friends()
returns table (id uuid, name text, profile_photo text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct u.id, u.name, u.profile_photo
  from users u
  where u.id <> auth.uid()
  and u.id in (
    select cm2.user_id
    from conversation_members cm1
    join conversation_members cm2
      on cm2.conversation_id = cm1.conversation_id and cm2.user_id <> cm1.user_id
    where cm1.user_id = auth.uid()
    union
    select tm2.user_id
    from trip_members tm1
    join trip_members tm2
      on tm2.trip_id = tm1.trip_id and tm2.user_id <> tm1.user_id
    where tm1.user_id = auth.uid() and tm1.status = 'in' and tm2.status = 'in'
  )
  order by u.name;
$$;

grant execute on function get_my_friends() to authenticated;

-- Scoped push-recipient lookups for a single trip invite — mirrors
-- get_chat_push_subscriptions/get_chat_native_push_tokens, but authorizes via
-- "does a pending invite from me to this user exist" instead of chat
-- membership, since the invitee isn't in the trip chat yet.
create or replace function get_trip_invite_push_subscriptions(p_invite_id uuid)
returns table (endpoint text, p256dh text, auth_key text)
language sql
security definer
set search_path = public
stable
as $$
  select ps.endpoint, ps.p256dh, ps.auth as auth_key
  from push_subscriptions ps
  join trip_invites ti on ti.invited_user_id = ps.user_id
  where ti.id = p_invite_id
    and ti.invited_by = auth.uid()
    and ti.status = 'pending';
$$;

create or replace function get_trip_invite_native_push_tokens(p_invite_id uuid)
returns table (expo_push_token text)
language sql
security definer
set search_path = public
stable
as $$
  select npt.expo_push_token
  from native_push_tokens npt
  join trip_invites ti on ti.invited_user_id = npt.user_id
  where ti.id = p_invite_id
    and ti.invited_by = auth.uid()
    and ti.status = 'pending';
$$;

grant execute on function get_trip_invite_push_subscriptions(uuid) to authenticated;
grant execute on function get_trip_invite_native_push_tokens(uuid) to authenticated;
