-- Creator deal pipeline: everything that happens BEFORE a creator_codes row
-- exists.
--
-- creator_codes is the signed roster — code is NOT NULL, so someone who has
-- only sent an Instagram DM can't be represented there without inventing a
-- code for a deal they haven't agreed to. That's why this is its own table:
-- a lead is a conversation, a creator_codes row is a contract.
--
-- On conversion the lead keeps its history and points at the code it became
-- (code_id), so the pipeline can show real signups/revenue next to the deal
-- it came from rather than losing the thread at handoff.
create table if not exists creator_leads (
  id uuid primary key default gen_random_uuid(),

  handle text not null,                 -- instagram handle, stored without '@'
  name text,
  platform text not null default 'instagram',
  followers integer,

  -- Deliberately a small, closed set. A free-text status field is how a
  -- pipeline turns back into the mess it was meant to replace.
  --   new      inbound, not replied to yet
  --   waiting  we replied, ball is in their court
  --   call     call booked (call_at)
  --   closed   agreed, content in progress
  --   live     content published
  --   dead     passed, ghosted, or not a fit
  stage text not null default 'new'
    check (stage in ('new','waiting','call','closed','live','dead')),

  notes text,
  deal_terms text,                      -- what was actually agreed
  call_at timestamptz,                  -- scheduled call
  last_contact_at timestamptz,          -- last time a message went either way

  -- Set when the lead becomes a real creator. Null for everyone still in play.
  code_id uuid references creator_codes(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per person. The bulk importer relies on this to make re-pasting the
-- same batch a no-op instead of creating 40 duplicates.
--
-- Plain column, not lower(handle): ON CONFLICT (handle) cannot target an
-- expression index. Case-insensitivity is instead guaranteed on the way in —
-- normHandle() in the API lowercases every handle before it is written, so
-- two casings can never both land.
create unique index if not exists idx_creator_leads_handle
  on creator_leads (handle);

-- The two reads the admin actually does: the board grouped by stage, and
-- "what needs me today" ordered by call time.
create index if not exists idx_creator_leads_stage on creator_leads (stage);
create index if not exists idx_creator_leads_call_at on creator_leads (call_at)
  where call_at is not null;

-- RLS on with zero policies = deny-all for anon/authenticated. Only the
-- service-role client behind /api/admin/creator-leads can touch it, same as
-- the rest of the admin surface. This holds names and deal terms of real
-- people and must never be readable from the app.
alter table creator_leads enable row level security;
