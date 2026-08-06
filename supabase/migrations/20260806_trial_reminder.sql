-- Backs the "we'll remind you before your trial ends" promise made by
-- TrialFlow's reminder screen, via /api/cron/trial-ending.
--
-- trial_ends_at is written ONLY while RevenueCat reports period_type='TRIAL'
-- (see api/revenuecat/webhook/route.ts) and cleared the moment the trial
-- converts or expires. subscription_expires_at can't serve this purpose on
-- its own: a renewing annual subscriber is also ~24h from expiry once a year,
-- which would make the reminder fire at real paying customers.
--
-- Already applied to production 2026-08-06 via the Supabase MCP; kept here as
-- the repo's record.

alter table public.users
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_reminder_sent_at timestamptz;

create index if not exists users_trial_ends_at_idx
  on public.users (trial_ends_at)
  where trial_ends_at is not null;
