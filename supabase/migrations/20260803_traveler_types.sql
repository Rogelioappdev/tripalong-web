-- "Traveler type" identity labels (up to 2, e.g. "Digital Nomad" / "Weekend
-- Tripper") — collected during onboarding, shown on the public profile.
-- See src/lib/travelerTypes.ts for the fixed set of values this array holds.
alter table users add column if not exists traveler_types text[] not null default '{}';
