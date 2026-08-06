-- One-time, server-validated codes redeemable for a permanent, free
-- TripAlong+ grant (Settings -> About -> "Are you a TripAlong Content
-- Creator?", handled by /api/redeem-creator-code). Only code_hash (SHA-256)
-- is ever stored — the raw code is generated once, handed to whoever it's
-- given to, and never written anywhere else, so it can't be read back out
-- of the database by anyone, including us.
create table if not exists creator_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  redeemed_by uuid references users(id),
  redeemed_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS enabled with zero policies = deny-all for anon/authenticated roles.
-- Only the service-role client (used exclusively by
-- /api/redeem-creator-code) can ever read or write this table.
alter table creator_access_codes enable row level security;
