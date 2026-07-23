-- Backs the hidden "Are you a TripAlong member?" gate in Settings -> About:
-- once unlocked with the code, a toggle lets the user opt into seeing
-- features that are still being built/tested, gated by this flag wherever
-- those features check it.
alter table users add column if not exists is_beta_tester boolean not null default false;
