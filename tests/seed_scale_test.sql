-- HiveLog Scale Test Seed Data
-- Run this in Supabase SQL Editor AFTER logging in with a test account.
-- Replace YOUR_USER_ID below with the UUID from: SELECT auth.uid();
--
-- Creates: 50 yards, 10 colonies per yard (500 total), ~100 events per colony (50,000 total)
-- This simulates a large commercial beekeeper operating for ~2 years.

DO $$
DECLARE
  test_user_id UUID;
  yard_id UUID;
  colony_id UUID;
  event_types TEXT[] := ARRAY['inspection', 'treatment', 'feed', 'split', 'loss', 'requeen', 'harvest'];
  i INT;
  j INT;
  k INT;
BEGIN
  -- Get the currently authenticated user (run this while logged in)
  test_user_id := auth.uid();

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to run this seed script. Use the Supabase SQL Editor while authenticated.';
  END IF;

  RAISE NOTICE 'Seeding data for user: %', test_user_id;

  -- Create 50 yards
  FOR i IN 1..50 LOOP
    INSERT INTO yards (id, owner_id, name, location_note, created_at)
    VALUES (
      gen_random_uuid(),
      test_user_id,
      'Yard ' || i,
      CASE
        WHEN i <= 10 THEN 'North field, section ' || i
        WHEN i <= 20 THEN 'South meadow, row ' || (i - 10)
        WHEN i <= 30 THEN 'East orchard, block ' || (i - 20)
        WHEN i <= 40 THEN 'West pasture, lot ' || (i - 30)
        ELSE 'Remote site ' || (i - 40)
      END,
      now() - ((50 - i) * INTERVAL '14 days')
    )
    RETURNING id INTO yard_id;

    -- Create 10 colonies per yard
    FOR j IN 1..10 LOOP
      INSERT INTO colonies (id, yard_id, label, status, created_at)
      VALUES (
        gen_random_uuid(),
        yard_id,
        'Hive ' || j,
        CASE WHEN random() < 0.1 THEN 'deadout' ELSE 'active' END,
        now() - ((50 - i) * INTERVAL '14 days') + (j * INTERVAL '1 hour')
      )
      RETURNING id INTO colony_id;

      -- Create ~100 events per colony spread over 2 years
      FOR k IN 1..100 LOOP
        INSERT INTO events (colony_id, type, notes, logged_by, created_at)
        VALUES (
          colony_id,
          event_types[1 + floor(random() * 7)::int],
          CASE
            WHEN random() < 0.3 THEN NULL
            WHEN random() < 0.5 THEN 'Routine check, all looks good'
            WHEN random() < 0.7 THEN 'Noted some issues, will follow up'
            ELSE 'Applied standard treatment protocol'
          END,
          test_user_id,
          now() - (k * INTERVAL '7 days') + (random() * INTERVAL '6 days')
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed complete: 50 yards, 500 colonies, 50000 events';
END $$;
