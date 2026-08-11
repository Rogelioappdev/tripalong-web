-- Time-limited creator comps.
--
-- The original creator_access_codes (20260806) granted PERMANENT free Plus:
-- the redeem route wrote subscription_expires_at = null and nothing ever
-- downgraded the account. That's right for some creators and wrong for a
-- one-year deal, so a code can now carry its own duration.
--
-- grant_months IS NULL keeps the old behaviour exactly (permanent), so the
-- two codes minted before today are untouched and still mean what they meant
-- when they were handed out.
alter table creator_access_codes
  add column if not exists grant_months integer,
  add column if not exists note text;

comment on column creator_access_codes.grant_months is
  'Months of free Plus this code grants on redemption. NULL = permanent, the pre-2026-08-11 behaviour.';
comment on column creator_access_codes.note is
  'Who this code was minted for, e.g. "Kyle - creator, 12mo". Admin-only: the table is deny-all under RLS, service-role access only.';

-- Supports the /api/cron/expire-comps sweep, which is the only thing that
-- ever ends a comp. Partial index: comps are a handful of rows next to the
-- whole users table, and this keeps the daily scan off a seq scan.
create index if not exists idx_users_creator_comp_expiry
  on users (subscription_expires_at)
  where subscription_status = 'creator_comp';
