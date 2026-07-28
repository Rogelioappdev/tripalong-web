-- Request-to-join for full trips: instead of silently allowing anyone to
-- join a full trip (soft capacity, see 20260716_soft_trip_capacity.sql) or
-- blocking them outright, a stranger can send a request that the trip
-- creator must review (via the requester's public profile) before it takes
-- effect. Distinct from trip_invites (a member inviting a known contact,
-- which still joins instantly on accept) and from the ordinary joinTrip()
-- path used when a trip isn't full.
create table trip_join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  requester_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (trip_id, requester_id)
);

create index idx_trip_join_requests_trip on trip_join_requests(trip_id);
create index idx_trip_join_requests_requester on trip_join_requests(requester_id) where status = 'pending';

alter table trip_join_requests enable row level security;

-- No UPDATE policy for regular users at all — status only ever changes via
-- respond_to_join_request() below, which runs as SECURITY DEFINER after
-- verifying the caller is actually the trip's creator. This rules out a
-- requester ever flipping their own row to 'accepted' via a direct REST call.
create policy "Requester and trip creator can view requests" on trip_join_requests
  for select using (
    (select auth.uid()) = requester_id
    or exists (
      select 1 from trips
      where trips.id = trip_join_requests.trip_id
        and trips.creator_id = (select auth.uid())
    )
  );

create policy "Users can request to join a trip" on trip_join_requests
  for insert with check ((select auth.uid()) = requester_id);

-- Accept/decline. trip_members/trip_chat_members INSERT policies only allow
-- self-inserts (user_id = auth.uid()), so the creator approving someone
-- else's request has to go through a SECURITY DEFINER function that
-- verifies authorization itself rather than relying on RLS.
create or replace function respond_to_join_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_trip_id uuid;
  v_requester_id uuid;
  v_status text;
  v_creator_id uuid;
  v_chat_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select trip_id, requester_id, status into v_trip_id, v_requester_id, v_status
  from trip_join_requests where id = p_request_id;

  if v_trip_id is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if v_status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'already_responded');
  end if;

  select creator_id into v_creator_id from trips where id = v_trip_id;
  if v_creator_id is null or v_creator_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_accept then
    insert into trip_members (trip_id, user_id, status)
    values (v_trip_id, v_requester_id, 'in')
    on conflict (trip_id, user_id) do update set status = 'in';

    select id into v_chat_id from trip_chats where trip_id = v_trip_id limit 1;
    if v_chat_id is not null then
      insert into trip_chat_members (trip_chat_id, user_id, last_read_at)
      values (v_chat_id, v_requester_id, now())
      on conflict (trip_chat_id, user_id) do nothing;
    end if;

    insert into saved_trips (trip_id, user_id)
    values (v_trip_id, v_requester_id)
    on conflict (trip_id, user_id) do nothing;

    update trip_join_requests set status = 'accepted', responded_at = now() where id = p_request_id;
  else
    update trip_join_requests set status = 'declined', responded_at = now() where id = p_request_id;
  end if;

  return jsonb_build_object('success', true, 'trip_id', v_trip_id, 'chat_id', v_chat_id);
end;
$$;

grant execute on function respond_to_join_request(uuid, boolean) to authenticated;

-- Explicit server-side filter (not left to RLS + a client .eq()) so a
-- requester never sees their own outgoing requests mixed into this list —
-- same bug class as the trip_invites banner fix, avoided here from the start.
create or replace function get_my_pending_join_requests()
returns table (
  id uuid,
  trip_id uuid,
  created_at timestamptz,
  requester_id uuid,
  requester_name text,
  requester_photo text,
  trip_destination text,
  trip_country text,
  trip_cover_image text
)
language sql
stable
security definer
set search_path = public
as $$
  select jr.id, jr.trip_id, jr.created_at,
         u.id, u.name, u.profile_photo,
         t.destination, t.country, t.cover_image
  from trip_join_requests jr
  join trips t on t.id = jr.trip_id
  join users u on u.id = jr.requester_id
  where jr.status = 'pending' and t.creator_id = auth.uid()
  order by jr.created_at desc;
$$;

grant execute on function get_my_pending_join_requests() to authenticated;

-- Push-recipient lookups scoped to a single request — mirrors the
-- trip_invites push RPCs, authorizing via "does a pending request from me
-- to this trip's creator exist" instead of chat/trip membership.
create or replace function get_join_request_push_subscriptions(p_request_id uuid)
returns table (endpoint text, p256dh text, auth_key text)
language sql
security definer
set search_path = public
stable
as $$
  select ps.endpoint, ps.p256dh, ps.auth as auth_key
  from push_subscriptions ps
  join trip_join_requests jr on jr.id = p_request_id
  join trips t on t.id = jr.trip_id
  where ps.user_id = t.creator_id
    and jr.requester_id = auth.uid()
    and jr.status = 'pending';
$$;

create or replace function get_join_request_native_push_tokens(p_request_id uuid)
returns table (expo_push_token text)
language sql
security definer
set search_path = public
stable
as $$
  select npt.expo_push_token
  from native_push_tokens npt
  join trip_join_requests jr on jr.id = p_request_id
  join trips t on t.id = jr.trip_id
  where npt.user_id = t.creator_id
    and jr.requester_id = auth.uid()
    and jr.status = 'pending';
$$;

grant execute on function get_join_request_push_subscriptions(uuid) to authenticated;
grant execute on function get_join_request_native_push_tokens(uuid) to authenticated;
