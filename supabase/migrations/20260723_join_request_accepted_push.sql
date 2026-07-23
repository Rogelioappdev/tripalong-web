-- Push-recipient lookup for notifying the REQUESTER once their join request
-- is accepted — mirrors get_join_request_push_subscriptions but reversed:
-- authorized via "is the caller the trip's creator for this request" since
-- the creator is the one triggering this notification.
create or replace function get_join_request_requester_push_subscriptions(p_request_id uuid)
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
  where ps.user_id = jr.requester_id
    and t.creator_id = auth.uid()
    and jr.status = 'accepted';
$$;

create or replace function get_join_request_requester_native_push_tokens(p_request_id uuid)
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
  where npt.user_id = jr.requester_id
    and t.creator_id = auth.uid()
    and jr.status = 'accepted';
$$;

grant execute on function get_join_request_requester_push_subscriptions(uuid) to authenticated;
grant execute on function get_join_request_requester_native_push_tokens(uuid) to authenticated;
