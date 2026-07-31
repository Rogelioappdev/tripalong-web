-- Backs a real (non-fabricated) "N travelers active this month" stat for the
-- onboarding momentum screen, modeled on a competitor's "1.8M+ travelers
-- waiting to meet you" screen (see tripalong_nomadtable_screens.md) but with
-- an honest, real number instead of a vanity figure. Also intended to later
-- replace the onboarding auth screen's non-numeric social-proof pill, which
-- was deliberately left without a number because this column didn't exist
-- yet (see tripalong_onboarding_strategy.md).
--
-- last_active_at is touched by SessionKeeper (src/components/SessionKeeper.tsx)
-- on app foreground/focus, throttled client-side to roughly once per hour per
-- device so this never becomes a write-heavy column.
alter table users add column if not exists last_active_at timestamptz;

create index if not exists users_last_active_at_idx on users (last_active_at);

-- SECURITY DEFINER + granted to anon (not just authenticated) so the
-- pre-signup auth screen can use this too — it only ever returns a single
-- aggregate count, never row-level data, so there's no PII exposure in
-- allowing anonymous callers.
create or replace function public.get_active_users_30d()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  select count(*) into v_count
  from users
  where last_active_at > now() - interval '30 days';
  return v_count;
end;
$function$;

grant execute on function public.get_active_users_30d() to anon, authenticated;
