-- Persists which season quick-chip (if any) was picked when creating a trip.
-- Previously, picking a season only set is_flexible_dates=true with null
-- start/end dates and the season itself was never saved anywhere — making
-- the feed's date/season filter unable to distinguish "Summer 2026" from
-- "Winter 2026" trips (both looked identically "flexible").
alter table trips add column if not exists season_label text;
