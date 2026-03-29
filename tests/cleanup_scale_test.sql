-- HiveLog Scale Test Cleanup
-- Removes all seeded test data. Run in Supabase SQL Editor while logged in.
-- WARNING: This deletes ALL yards, colonies, and events for the current user.

DO $$
DECLARE
  test_user_id UUID;
  deleted_yards INT;
BEGIN
  test_user_id := auth.uid();

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to run this cleanup script.';
  END IF;

  -- Cascading delete: yards → colonies → events
  DELETE FROM yards WHERE owner_id = test_user_id;

  GET DIAGNOSTICS deleted_yards = ROW_COUNT;
  RAISE NOTICE 'Cleanup complete: deleted % yards (and all their colonies + events)', deleted_yards;
END $$;
