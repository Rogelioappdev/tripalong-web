-- Blurred "who viewed you" teaser to drive TripAlong+ conversions.
--
-- Previously get_my_viewers() returned an EMPTY set to free users, so all they
-- saw was a count ("2 people viewed your profile"). Now it returns the viewer
-- rows to everyone so the client can render blurred faces as the hook — but for
-- free users the identity is MASKED server-side (first name only, no country /
-- travel styles) so we never ship full profile data to a non-paying client.
-- Plus users still get the complete, unmasked list.
--
-- NOTE: the return signature is unchanged, so CREATE OR REPLACE is safe (no DROP).
-- Photos are public storage URLs, so the blur is a visual gate, not a hard one —
-- acceptable for a growth surface (same pattern as dating apps' "who liked you").

CREATE OR REPLACE FUNCTION get_my_viewers(p_limit integer DEFAULT 50)
RETURNS TABLE(
  viewer_id     uuid,
  viewed_at     timestamptz,
  name          text,
  profile_photo text,
  travel_styles text[],
  country       text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     uuid := auth.uid();
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

  IF v_is_plus THEN
    -- Paid: full, unmasked list.
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
  ELSE
    -- Free: blurred teaser. First name only + photo (blurred client-side);
    -- country and travel styles withheld until they upgrade.
    RETURN QUERY
      SELECT
        pv.viewer_id,
        pv.viewed_at,
        split_part(u.name, ' ', 1)::text,  -- first name only
        u.profile_photo::text,             -- rendered blurred in the client
        NULL::text[],                      -- hide travel styles
        NULL::text                         -- hide country
      FROM profile_views pv
      JOIN users u ON u.id = pv.viewer_id
      WHERE pv.viewed_user_id = v_uid
      ORDER BY pv.viewed_at DESC
      LIMIT p_limit;
  END IF;
END;
$$;
