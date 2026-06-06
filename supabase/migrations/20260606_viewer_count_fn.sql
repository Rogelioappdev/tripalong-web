-- Viewer count for Day 8 paywall personalization — no Plus gate, just the number
-- A count is not sensitive; showing it creates FOMO without revealing who.
CREATE OR REPLACE FUNCTION get_my_viewer_count()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  RETURN (
    SELECT COUNT(DISTINCT viewer_id)::integer
    FROM profile_views
    WHERE viewed_user_id = auth.uid()
    AND viewed_at > NOW() - INTERVAL '8 days'
  );
END;
$$;
