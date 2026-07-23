-- Extends the existing notifications table/trigger infra (already live:
-- on_trip_member_joined / notify_trip_joined populates 'trip_joined' rows,
-- 744 of them already exist) to also cover the other activity types that
-- currently only exist as ephemeral pushes/toasts with no persistent record:
-- trip invites, join requests, and join-request acceptances. Same table,
-- same (body, chat_id, is_read) shape, so the client only needs one query
-- shape to read all four types.
create or replace function fn_notify_trip_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_destination text;
  v_chat_id uuid;
begin
  select name into v_actor_name from users where id = new.invited_by;
  select destination into v_destination from trips where id = new.trip_id;
  v_chat_id := get_trip_chat_id(new.trip_id);
  insert into notifications (user_id, actor_id, type, trip_id, chat_id, body)
  values (
    new.invited_user_id, new.invited_by, 'trip_invite', new.trip_id, v_chat_id,
    coalesce(v_actor_name, 'Someone') || ' invited you to ' || coalesce(v_destination, 'a trip')
  );
  return new;
end;
$$;

create trigger trg_notify_trip_invite
  after insert on trip_invites
  for each row
  execute function fn_notify_trip_invite();

create or replace function fn_notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_actor_name text;
  v_destination text;
  v_chat_id uuid;
begin
  select creator_id, destination into v_creator, v_destination from trips where id = new.trip_id;
  if v_creator is null then return new; end if;
  select name into v_actor_name from users where id = new.requester_id;
  v_chat_id := get_trip_chat_id(new.trip_id);
  insert into notifications (user_id, actor_id, type, trip_id, chat_id, body)
  values (
    v_creator, new.requester_id, 'join_request', new.trip_id, v_chat_id,
    coalesce(v_actor_name, 'Someone') || ' wants to join ' || coalesce(v_destination, 'your trip')
  );
  return new;
end;
$$;

create trigger trg_notify_join_request
  after insert on trip_join_requests
  for each row
  execute function fn_notify_join_request();

create or replace function fn_notify_join_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_destination text;
  v_chat_id uuid;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select creator_id, destination into v_creator, v_destination from trips where id = new.trip_id;
    v_chat_id := get_trip_chat_id(new.trip_id);
    insert into notifications (user_id, actor_id, type, trip_id, chat_id, body)
    values (
      new.requester_id, v_creator, 'join_accepted', new.trip_id, v_chat_id,
      'You were accepted to ' || coalesce(v_destination, 'the trip') || '! 🎉'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_join_accepted
  after update on trip_join_requests
  for each row
  execute function fn_notify_join_accepted();
