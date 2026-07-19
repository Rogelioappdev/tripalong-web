-- Make trip capacity a SOFT target: full trips stay visible on the feed + globe
-- and remain joinable. This replaces fn_enforce_trip_member_constraints to drop
-- the TRIP_FULL capacity check while KEEPING the gender-restriction enforcement.
-- (Applied manually in the Supabase SQL editor, per project convention.)
CREATE OR REPLACE FUNCTION public.fn_enforce_trip_member_constraints()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gender text;
  v_group_pref text;
  v_max int;
  v_creator_id uuid;
BEGIN
  IF NEW.status = 'in' THEN
    SELECT group_preference, max_group_size, creator_id
      INTO v_group_pref, v_max, v_creator_id
      FROM public.trips WHERE id = NEW.trip_id;

    IF NEW.user_id <> v_creator_id THEN
      -- Gender restriction stays enforced.
      IF v_group_pref IN ('male', 'female') THEN
        SELECT gender INTO v_gender FROM public.users WHERE id = NEW.user_id;
        IF v_gender IS NULL OR v_gender <> v_group_pref THEN
          RAISE EXCEPTION 'GENDER_RESTRICTED: this trip is restricted by gender' USING ERRCODE = 'P0001';
        END IF;
      END IF;

      -- Capacity is now a soft target: full trips remain joinable, so the
      -- previous TRIP_FULL check (v_current_in >= v_max) has been removed.
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
