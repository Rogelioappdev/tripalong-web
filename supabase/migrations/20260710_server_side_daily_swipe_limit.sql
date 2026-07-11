-- Server-side daily swipe limit (UTC-keyed), replacing the bypassable
-- localStorage counter. Enforced via SECURITY DEFINER functions that key off
-- auth.uid(), so a client cannot reset (timezone/clear-storage) or spoof it.
create table if not exists public.daily_swipe_counts (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  swipe_date date    not null default (now() at time zone 'utc')::date,
  count      integer not null default 0,
  primary key (user_id, swipe_date)
);

alter table public.daily_swipe_counts enable row level security;
-- No client policies on purpose: rows are only ever touched through the
-- SECURITY DEFINER functions below, so clients can neither read, reset, nor
-- inflate their own count directly.

create or replace function public.get_swipes_today()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select count from public.daily_swipe_counts
    where user_id = auth.uid()
      and swipe_date = (now() at time zone 'utc')::date
  ), 0);
$$;

create or replace function public.increment_swipes_today()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.daily_swipe_counts (user_id, swipe_date, count)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, swipe_date)
  do update set count = daily_swipe_counts.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

revoke all on function public.get_swipes_today() from public;
revoke all on function public.increment_swipes_today() from public;
grant execute on function public.get_swipes_today() to authenticated;
grant execute on function public.increment_swipes_today() to authenticated;
