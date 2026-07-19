-- Attribute each user's first TripAlong+ conversion to the paywall that drove it.
-- Values: 'swipes' | 'rewind' | 'who-viewed' | 'compatibility' | 'upgrade'
-- (First-write-wins — never overwritten once set, so it reflects the *initial*
-- wall that converted them, not a later re-subscribe.)
alter table users add column if not exists conversion_trigger text;

comment on column users.conversion_trigger is
  'Which paywall trigger drove this user''s first TripAlong+ conversion (swipes / rewind / who-viewed / compatibility / upgrade). First-write-wins.';
