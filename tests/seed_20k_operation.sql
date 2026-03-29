-- ============================================================
-- HiveLog: 20,000-Hive Commercial Operation — 7-Day Simulation
-- User: newguy@admin.com (3fcf2c23-d30e-4520-95a9-16671f48dd4a)
-- ============================================================
-- This script creates a realistic commercial beekeeping operation:
--   • ~250 yards across 6 states (CA, ND, TX, MT, FL, SD)
--   • ~20,000 colonies total
--   • 7 days of realistic field operations (Mon 3/24 → Sun 3/30)
--   • Mixed event types: inspection, treatment, feed, split, loss, requeen, harvest
--   • Some dead-out colonies for realism
--
-- Run this in the Supabase SQL Editor.
-- After running, use verification_20k.sql to generate the cross-reference sheet.
-- ============================================================

DO $$
DECLARE
  uid UUID := '3fcf2c23-d30e-4520-95a9-16671f48dd4a';
  yard_id UUID;
  colony_id UUID;
  yard_rec RECORD;
  col_rec RECORD;
  i INT;
  j INT;
  prefix TEXT;
  colony_count INT;
  pad_len INT;
  base_ts TIMESTAMPTZ;
  event_ts TIMESTAMPTZ;
  rand_val FLOAT;

  -- ── Yard definitions ──────────────────────────────────────
  -- Format: name | location_note | colony_count | prefix
  TYPE yard_def IS RECORD (
    name TEXT, loc TEXT, cnt INT, pfx TEXT
  );
BEGIN

  -- ═══════════════════════════════════════════════════════════
  -- PHASE 1: CREATE YARDS & COLONIES
  -- ═══════════════════════════════════════════════════════════

  -- ── CALIFORNIA — Almond Pollination (winter/spring) ──────
  -- 80 yards × 80 hives = 6,400 hives
  FOR i IN 1..20 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'Kern Almonds Block ' || LPAD(i::TEXT, 2, '0'),
      'Kern County CA — Wonderful Orchards, Row ' || chr(64+((i-1)%26)+1));
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'KA' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  FOR i IN 1..20 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'Fresno Almonds Block ' || LPAD(i::TEXT, 2, '0'),
      'Fresno County CA — Blue Diamond grower, Section ' || i);
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'FA' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  FOR i IN 1..20 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'Madera Almonds Block ' || LPAD(i::TEXT, 2, '0'),
      'Madera County CA — Johnson Ranch, Gate ' || chr(64+((i-1)%26)+1));
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'MA' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  FOR i IN 1..20 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'Stanislaus Almonds Block ' || LPAD(i::TEXT, 2, '0'),
      'Stanislaus County CA — Turlock area, off Hwy 99');
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'SA' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  -- ── NORTH DAKOTA — Summer Honey Production ───────────────
  -- 40 yards × 96 hives = 3,840 hives
  FOR i IN 1..40 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'ND Honey Yard ' || LPAD(i::TEXT, 2, '0'),
      'Williams County ND — T' || (140 + (i % 10)) || 'N R' || (95 + (i % 8)) || 'W, Section ' || ((i * 7) % 36 + 1));
    FOR j IN 1..96 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'ND' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  -- ── TEXAS — Holding / Staging Yards ──────────────────────
  -- 20 yards × 96 hives = 1,920 hives
  FOR i IN 1..20 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'TX Holding Yard ' || LPAD(i::TEXT, 2, '0'),
      'Ellis County TX — FM ' || (2180 + i) || ', ' || CASE WHEN i % 2 = 0 THEN 'north gate' ELSE 'south gate' END);
    FOR j IN 1..96 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'TX' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  -- ── MONTANA — Summer Honey Production ────────────────────
  -- 30 yards × 80 hives = 2,400 hives
  FOR i IN 1..30 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'MT Clover Yard ' || LPAD(i::TEXT, 2, '0'),
      'Cascade County MT — Belt Creek area, mile ' || (i * 3));
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'MT' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  -- ── FLORIDA — Early Spring Build-up ──────────────────────
  -- 30 yards × 80 hives = 2,400 hives
  FOR i IN 1..30 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'FL Citrus Yard ' || LPAD(i::TEXT, 2, '0'),
      'Polk County FL — Hwy 27 corridor, grove ' || chr(64+((i-1)%26)+1));
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'FL' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  -- ── SOUTH DAKOTA — Honey + Holding ───────────────────────
  -- 40 yards × 80 hives = 3,200 hives
  FOR i IN 1..40 LOOP
    yard_id := gen_random_uuid();
    INSERT INTO yards (id, owner_id, name, location_note)
    VALUES (yard_id, uid,
      'SD Prairie Yard ' || LPAD(i::TEXT, 2, '0'),
      'Harding County SD — Section ' || ((i * 13) % 36 + 1) || ', T' || (20 + (i % 5)) || 'N');
    FOR j IN 1..80 LOOP
      INSERT INTO colonies (id, yard_id, label, status)
      VALUES (gen_random_uuid(), yard_id, 'SD' || LPAD(i::TEXT, 2, '0') || '-' || LPAD(j::TEXT, 3, '0'), 'active');
    END LOOP;
  END LOOP;

  -- Total: 20 + 20 + 20 + 20 + 40 + 20 + 30 + 30 + 40 = 240 yards
  -- Hives: 1600 + 1600 + 1600 + 1600 + 3840 + 1920 + 2400 + 2400 + 3200 = 20,160

  -- ═══════════════════════════════════════════════════════════
  -- PHASE 2: MARK SOME COLONIES AS DEAD OUT (realistic ~2%)
  -- ═══════════════════════════════════════════════════════════
  UPDATE colonies SET status = 'deadout'
  WHERE id IN (
    SELECT c.id FROM colonies c
    JOIN yards y ON c.yard_id = y.id
    WHERE y.owner_id = uid
    AND c.status = 'active'
    ORDER BY random()
    LIMIT 400  -- ~2% dead-out rate
  );

  -- ═══════════════════════════════════════════════════════════
  -- PHASE 3: SIMULATE 7 DAYS OF OPERATIONS
  -- ═══════════════════════════════════════════════════════════
  -- Week of Mon 3/24/2026 → Sun 3/30/2026
  -- Realistic daily pattern for a 4-person crew managing 20K hives

  -- ── DAY 1: Monday 3/24 — Almond inspection push ─────────
  -- Inspect 10 CA almond yards (800 hives), treat 2 yards for varroa
  base_ts := '2026-03-24 07:30:00-07'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'Kern Almonds%' ORDER BY name LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Almond bloom check — clusters look good, 6+ frames', uid, base_ts + (random() * interval '8 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'Fresno Almonds%' ORDER BY name LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Bloom check — good pollen intake, brood pattern solid', uid, base_ts + (random() * interval '8 hours'));
    END LOOP;
  END LOOP;
  -- Treat 2 Kern yards for varroa
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'Kern Almonds%' ORDER BY name LIMIT 2
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'treatment', 'OA dribble — mite wash showed 4/300', uid, base_ts + interval '9 hours' + (random() * interval '2 hours'));
    END LOOP;
  END LOOP;

  -- ── DAY 2: Tuesday 3/25 — Feed TX holding yards ─────────
  -- Feed 8 TX yards (768 hives), inspect 4 FL yards
  base_ts := '2026-03-25 06:45:00-05'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'TX Holding%' ORDER BY name LIMIT 8
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'feed', '1:1 syrup — 1 gal per hive, building up for move north', uid, base_ts + (random() * interval '10 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'FL Citrus%' ORDER BY name LIMIT 4
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Spring buildup check — queens laying well, 4-5 frames brood', uid, base_ts + interval '2 hours' + (random() * interval '6 hours'));
    END LOOP;
  END LOOP;

  -- ── DAY 3: Wednesday 3/26 — Treatment day (Madera + Stanislaus) ──
  -- Treat 10 yards (800 hives) + feed 5 FL yards
  base_ts := '2026-03-26 07:00:00-07'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'Madera Almonds%' ORDER BY name LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'treatment', 'Apivar strips in — 42 day treatment', uid, base_ts + (random() * interval '7 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'Stanislaus Almonds%' ORDER BY name LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'treatment', 'Apivar strips in — 42 day treatment', uid, base_ts + interval '4 hours' + (random() * interval '5 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'FL Citrus%' ORDER BY name OFFSET 4 LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'feed', 'Pollen patties + 1:1 syrup — spring buildup', uid, base_ts + interval '5 hours' + (random() * interval '5 hours'));
    END LOOP;
  END LOOP;

  -- ── DAY 4: Thursday 3/27 — Splits + Requeen day ─────────
  -- Split 2 strong TX yards (192 splits), requeen 1 yard (96 requeens)
  -- Also inspect 5 SD yards
  base_ts := '2026-03-27 07:15:00-05'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'TX Holding%' ORDER BY name OFFSET 8 LIMIT 2
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'split', 'Walk-away split — left queen cell, moved 3 frames to nuc', uid, base_ts + (random() * interval '8 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'TX Holding%' ORDER BY name OFFSET 10 LIMIT 1
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'requeen', 'Italian queen from Olivarez — marked yellow', uid, base_ts + interval '3 hours' + (random() * interval '5 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'SD Prairie%' ORDER BY name LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Pre-season check — some low on stores, will feed next trip', uid, base_ts + interval '6 hours' + (random() * interval '4 hours'));
    END LOOP;
  END LOOP;

  -- ── DAY 5: Friday 3/28 — Harvest + Loss recording ───────
  -- Harvest 3 FL citrus yards (240 hives), log losses on 2 CA yards
  base_ts := '2026-03-28 06:30:00-04'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'FL Citrus%' ORDER BY name OFFSET 9 LIMIT 3
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'harvest', 'Pulled 2 supers — citrus honey, light amber, est 60 lbs/hive', uid, base_ts + (random() * interval '10 hours'));
    END LOOP;
  END LOOP;
  -- Log losses on CA yards (just the deadout colonies)
  FOR col_rec IN
    SELECT c.id FROM colonies c
    JOIN yards y ON c.yard_id = y.id
    WHERE y.owner_id = uid AND y.name LIKE 'Kern Almonds%' AND c.status = 'deadout'
    LIMIT 50
  LOOP
    INSERT INTO events (colony_id, type, notes, logged_by, created_at)
    VALUES (col_rec.id, 'loss', 'Found dead — no bees, small cluster on bottom board, suspect starvation', uid, base_ts + interval '4 hours' + (random() * interval '4 hours'));
  END LOOP;

  -- ── DAY 6: Saturday 3/29 — Big inspection + feed push ───
  -- Inspect 8 ND yards (768 hives), feed 10 SD yards (800 hives)
  -- Inspect 5 MT yards (400 hives)
  base_ts := '2026-03-29 07:00:00-06'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'ND Honey%' ORDER BY name LIMIT 8
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Spring arrival check — snow melting, bees flying, need feed', uid, base_ts + (random() * interval '9 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'SD Prairie%' ORDER BY name OFFSET 5 LIMIT 10
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'feed', '2:1 syrup — heavy feed, colonies light after winter', uid, base_ts + interval '3 hours' + (random() * interval '7 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'MT Clover%' ORDER BY name LIMIT 5
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Early season check — still cold, clusters tight, queens present', uid, base_ts + interval '5 hours' + (random() * interval '4 hours'));
    END LOOP;
  END LOOP;

  -- ── DAY 7: Sunday 3/30 — Light day + catch-up ───────────
  -- Inspect 3 Fresno yards (240 hives), requeen 1 FL yard (80 requeens)
  -- Feed 3 MT yards (240 hives)
  base_ts := '2026-03-30 08:00:00-07'::TIMESTAMPTZ;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'Fresno Almonds%' ORDER BY name OFFSET 5 LIMIT 3
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'inspection', 'Post-bloom check — almonds done, prep for move to ND in April', uid, base_ts + (random() * interval '6 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'FL Citrus%' ORDER BY name OFFSET 12 LIMIT 1
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'requeen', 'Replaced failing queen — new Carniolan from Koehnen', uid, base_ts + interval '3 hours' + (random() * interval '4 hours'));
    END LOOP;
  END LOOP;
  FOR yard_rec IN
    SELECT id FROM yards WHERE owner_id = uid AND name LIKE 'MT Clover%' ORDER BY name OFFSET 5 LIMIT 3
  LOOP
    FOR col_rec IN SELECT id FROM colonies WHERE yard_id = yard_rec.id AND status = 'active' LOOP
      INSERT INTO events (colony_id, type, notes, logged_by, created_at)
      VALUES (col_rec.id, 'feed', 'Pollen sub + 1:1 syrup — building for dandelion flow', uid, base_ts + interval '4 hours' + (random() * interval '5 hours'));
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed complete.';
END $$;
