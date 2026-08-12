-- Deferred deep linking: remembering which trip someone tapped BEFORE they
-- installed the app, so we can show it to them after onboarding.
--
-- iOS passes nothing through an App Store install — the browser that opened
-- the link and the freshly installed app are separate sandboxes with no
-- shared storage. The only way across that boundary is to recognise the
-- device on the other side, which is what this table exists for: a short-
-- lived record of "someone on this network, with this device shape, was
-- looking at this trip N minutes ago".
--
-- This is inherently probabilistic. It is the same technique Branch and
-- AppsFlyer use, and it fails the same ways: iCloud Private Relay and IPv6
-- rotation change the address between Safari and the app, and two people on
-- one office WiFi can look alike. Treat a match as a good guess, never as
-- proof of identity, and never let it grant access to anything — it only
-- ever decides which trip card to show first.

create table if not exists public.deep_link_clicks (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,

  -- Salted hash, never the raw address. This is the matching key.
  ip_hash     text not null,

  -- Coarse device shape, used to break ties when several people share an IP.
  -- Deliberately low-resolution: enough to separate an iPhone from an iPad on
  -- the same WiFi, not enough to be a device fingerprint we'd have to treat
  -- as tracking data.
  platform    text,
  tz          text,
  lang        text,
  screen      text,

  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  claimed_by  uuid references public.users(id) on delete set null
);

-- The only read pattern: most recent unclaimed click from this IP.
create index if not exists deep_link_clicks_match_idx
  on public.deep_link_clicks (ip_hash, created_at desc)
  where claimed_at is null;

-- Retention. These rows are only useful for the minutes between tapping a
-- link and finishing onboarding, and they're the closest thing here to
-- personal data, so they are swept rather than kept.
create index if not exists deep_link_clicks_created_idx
  on public.deep_link_clicks (created_at);

-- Service-role only, matching the creator_* tables: every read and write goes
-- through a server route. RLS on with no policies means the anon key cannot
-- touch this at all, which matters because the table maps network identity to
-- browsing activity.
alter table public.deep_link_clicks enable row level security;
