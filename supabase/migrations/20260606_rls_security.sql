-- ============================================================
-- TripAlong RLS Security Policies
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. USERS ─────────────────────────────────────────────────
-- Public profile fields readable by all authenticated users.
-- Users can update their own profile — but NOT subscription/payment fields.
-- Only service role (API routes) can write subscription_tier, trial_start_at, etc.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- Any logged-in user can read any profile (needed for matching, trip members, etc.)
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (true);

-- New users can create their own profile row
CREATE POLICY "users_insert" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile, but not subscription or payment fields
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent clients from writing these fields (service role bypasses RLS)
    -- Enforced by only allowing changes where these cols stay the same
    -- Real enforcement is via the WITH CHECK below + service-role-only API routes
  );

-- Block direct client writes to subscription fields via a column-level check function
-- (Service role in API routes bypasses RLS entirely — this only limits anon/auth clients)
CREATE OR REPLACE FUNCTION prevent_subscription_field_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- If the request is from service role, allow everything
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Authenticated clients cannot change subscription/payment fields
  IF NEW.subscription_tier      IS DISTINCT FROM OLD.subscription_tier      OR
     NEW.trial_start_at         IS DISTINCT FROM OLD.trial_start_at         OR
     NEW.subscription_status    IS DISTINCT FROM OLD.subscription_status    OR
     NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
     NEW.stripe_customer_id     IS DISTINCT FROM OLD.stripe_customer_id
  THEN
    RAISE EXCEPTION 'Cannot modify subscription or payment fields directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_subscription_fields ON users;
CREATE TRIGGER guard_subscription_fields
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_subscription_field_tampering();


-- ── 2. PROFILE_VIEWS ─────────────────────────────────────────
-- Viewers can record a view. Users can only read their OWN viewers.
-- Plus enforcement is done server-side via get_my_viewers() function below.

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_views_insert" ON profile_views;
DROP POLICY IF EXISTS "profile_views_select_own" ON profile_views;

-- Any authenticated user can record that they viewed someone
CREATE POLICY "profile_views_insert" ON profile_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- Users can only see views OF their own profile
CREATE POLICY "profile_views_select_own" ON profile_views
  FOR SELECT TO authenticated
  USING (viewed_user_id = auth.uid());

-- Server-side Plus-gated viewer list — bypasses RLS via SECURITY DEFINER
-- Call this via supabase.rpc('get_my_viewers', { p_limit: 50 })
CREATE OR REPLACE FUNCTION get_my_viewers(p_limit integer DEFAULT 50)
RETURNS TABLE(
  viewer_id    uuid,
  viewed_at    timestamptz,
  name         text,
  profile_photo text,
  travel_styles text[],
  country      text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_is_plus boolean := false;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT (
    subscription_tier IN ('plus', 'pro')
    OR (trial_start_at IS NOT NULL
        AND trial_start_at > NOW() - INTERVAL '7 days')
  )
  INTO v_is_plus
  FROM users WHERE id = v_uid;

  IF NOT v_is_plus THEN
    RETURN; -- Empty result for free users
  END IF;

  RETURN QUERY
    SELECT
      pv.viewer_id,
      pv.viewed_at,
      u.name::text,
      u.profile_photo::text,
      u.travel_styles,
      u.country::text
    FROM profile_views pv
    JOIN users u ON u.id = pv.viewer_id
    WHERE pv.viewed_user_id = v_uid
    ORDER BY pv.viewed_at DESC
    LIMIT p_limit;
END;
$$;


-- ── 3. TRIPS ─────────────────────────────────────────────────

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trips_select" ON trips;
DROP POLICY IF EXISTS "trips_insert" ON trips;
DROP POLICY IF EXISTS "trips_update_own" ON trips;
DROP POLICY IF EXISTS "trips_delete_own" ON trips;

CREATE POLICY "trips_select" ON trips
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "trips_insert" ON trips
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "trips_update_own" ON trips
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "trips_delete_own" ON trips
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());


-- ── 4. TRIP_MEMBERS ──────────────────────────────────────────

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_members_select" ON trip_members;
DROP POLICY IF EXISTS "trip_members_insert" ON trip_members;
DROP POLICY IF EXISTS "trip_members_delete_own" ON trip_members;

CREATE POLICY "trip_members_select" ON trip_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "trip_members_insert" ON trip_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can leave (delete own membership); trip creator can remove anyone
CREATE POLICY "trip_members_delete_own" ON trip_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM trips WHERE id = trip_members.trip_id AND creator_id = auth.uid()
    )
  );


-- ── 5. SAVED_TRIPS ───────────────────────────────────────────

ALTER TABLE saved_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_trips_own" ON saved_trips;

CREATE POLICY "saved_trips_own" ON saved_trips
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── 6. MESSAGES / TRIP_MESSAGES ──────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_delete_own" ON messages;

-- Users can read messages in conversations they belong to
CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());


-- ── 7. TRIP_MESSAGES ─────────────────────────────────────────

ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_messages_select" ON trip_messages;
DROP POLICY IF EXISTS "trip_messages_insert" ON trip_messages;
DROP POLICY IF EXISTS "trip_messages_delete_own" ON trip_messages;

CREATE POLICY "trip_messages_select" ON trip_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_chat_members
      WHERE trip_chat_id = trip_messages.trip_chat_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "trip_messages_insert" ON trip_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trip_chat_members
      WHERE trip_chat_id = trip_messages.trip_chat_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "trip_messages_delete_own" ON trip_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());


-- ── 8. BLOCKED_USERS ─────────────────────────────────────────

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_own" ON blocked_users;

CREATE POLICY "blocked_users_own" ON blocked_users
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());


-- ── 9. USER_REPORTS ──────────────────────────────────────────

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reports_insert" ON user_reports;
DROP POLICY IF EXISTS "user_reports_select_own" ON user_reports;

CREATE POLICY "user_reports_insert" ON user_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "user_reports_select_own" ON user_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
