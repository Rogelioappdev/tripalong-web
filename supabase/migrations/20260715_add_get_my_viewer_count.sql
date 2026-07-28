-- get_my_viewers(p_limit) caps at p_limit (default 50) rows, and every
-- client-side consumer was treating that capped array's length as the true
-- total view count — so the displayed count silently froze at 50 once a
-- user had 50+ actual views.
--
-- This RPC returns a real COUNT(*), and deliberately does NOT mirror
-- get_my_viewers' Plus/trial gate: the count itself should be visible to
-- every user (that's what makes the paywall's "X travelers checked your
-- profile" copy meaningful) — only the viewer IDENTITY list stays gated.
-- Previously the paywall's count was wired to viewers.length from the
-- gated list, so free users always saw "0 travelers checked your profile"
-- on the exact screen meant to convert them.
CREATE OR REPLACE FUNCTION public.get_my_viewer_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_count FROM profile_views WHERE viewed_user_id = v_uid;
  RETURN v_count;
END;
$function$;
