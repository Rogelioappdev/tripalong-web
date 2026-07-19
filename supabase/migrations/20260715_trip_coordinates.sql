-- TripAlong World: geographic coordinates for trips.
-- Adds latitude/longitude so trips can be plotted on the 3D globe (/world).
-- Populated by the geocoder (/api/geocode) on trip creation, and backfilled
-- for existing rows via scripts/backfill-coords.mjs.
--
-- Idempotent — safe to re-run. Apply MANUALLY in the Supabase dashboard
-- (SQL Editor → new query → paste → Run on main | PRODUCTION); committing
-- this file does NOT apply it.

alter table trips
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

-- Speeds up "trips that have coordinates" lookups used by getTripsForMap().
create index if not exists trips_lat_lng_idx
  on trips (latitude, longitude);
