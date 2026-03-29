-- ============================================================
-- HiveLog: 20K Operation — Verification Cross-Reference Sheet
-- Run in Supabase SQL Editor after seed_20k_operation.sql
-- ============================================================
-- Produces a single result set you can export to CSV/spreadsheet.
-- Cross-reference each row against the app to verify data integrity.
-- ============================================================

-- ─── SECTION 1: OPERATION OVERVIEW ──────────────────────────
-- One row summarizing the entire operation
SELECT '=== OPERATION OVERVIEW ===' AS section,
  NULL AS detail, NULL AS sub_detail, NULL AS count, NULL AS notes;

SELECT 'Total Yards' AS section,
  COUNT(*)::TEXT AS detail,
  NULL AS sub_detail,
  NULL::BIGINT AS count,
  NULL AS notes
FROM yards WHERE owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'

UNION ALL

SELECT 'Total Colonies',
  COUNT(*)::TEXT, NULL, NULL, NULL
FROM colonies c JOIN yards y ON c.yard_id = y.id
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'

UNION ALL

SELECT 'Active Colonies',
  COUNT(*)::TEXT, NULL, NULL, NULL
FROM colonies c JOIN yards y ON c.yard_id = y.id
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a' AND c.status = 'active'

UNION ALL

SELECT 'Dead Out Colonies',
  COUNT(*)::TEXT, NULL, NULL, NULL
FROM colonies c JOIN yards y ON c.yard_id = y.id
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a' AND c.status = 'deadout'

UNION ALL

SELECT 'Total Events',
  COUNT(*)::TEXT, NULL, NULL, NULL
FROM events e JOIN colonies c ON e.colony_id = c.id
JOIN yards y ON c.yard_id = y.id
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a';


-- ─── SECTION 2: YARDS BY STATE ──────────────────────────────
SELECT '=== YARDS BY STATE ===' AS section,
  NULL AS detail, NULL AS sub_detail, NULL AS count, NULL AS notes;

SELECT 'Yards by State' AS section,
  CASE
    WHEN name LIKE 'Kern%' OR name LIKE 'Fresno%' OR name LIKE 'Madera%' OR name LIKE 'Stanislaus%' THEN 'CA — Almonds'
    WHEN name LIKE 'ND%' THEN 'ND — Honey'
    WHEN name LIKE 'TX%' THEN 'TX — Holding'
    WHEN name LIKE 'MT%' THEN 'MT — Clover'
    WHEN name LIKE 'FL%' THEN 'FL — Citrus'
    WHEN name LIKE 'SD%' THEN 'SD — Prairie'
    ELSE 'Other'
  END AS detail,
  COUNT(*)::TEXT AS sub_detail,
  SUM(
    (SELECT COUNT(*) FROM colonies WHERE yard_id = yards.id)
  ) AS count,
  'yards | hives' AS notes
FROM yards
WHERE owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'
GROUP BY detail
ORDER BY count DESC;


-- ─── SECTION 3: DAILY ACTIVITY LOG ─────────────────────────
-- One row per day per event type — THE KEY CROSS-REFERENCE
SELECT '=== DAILY ACTIVITY LOG ===' AS section,
  NULL AS detail, NULL AS sub_detail, NULL AS count, NULL AS notes;

SELECT
  'Day ' || EXTRACT(DOW FROM e.created_at AT TIME ZONE 'America/Chicago')::TEXT
    || ' — ' || TO_CHAR(e.created_at AT TIME ZONE 'America/Chicago', 'Dy MM/DD') AS section,
  UPPER(e.type) AS detail,
  (SELECT CASE
    WHEN y2.name LIKE 'Kern%' OR y2.name LIKE 'Fresno%' OR y2.name LIKE 'Madera%' OR y2.name LIKE 'Stanislaus%' THEN 'CA'
    WHEN y2.name LIKE 'ND%' THEN 'ND'
    WHEN y2.name LIKE 'TX%' THEN 'TX'
    WHEN y2.name LIKE 'MT%' THEN 'MT'
    WHEN y2.name LIKE 'FL%' THEN 'FL'
    WHEN y2.name LIKE 'SD%' THEN 'SD'
    ELSE '??'
  END FROM yards y2 WHERE y2.id = y.id) AS sub_detail,
  COUNT(*) AS count,
  LEFT(e.notes, 60) AS notes
FROM events e
JOIN colonies c ON e.colony_id = c.id
JOIN yards y ON c.yard_id = y.id
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'
  AND e.created_at >= '2026-03-24'
  AND e.created_at < '2026-03-31'
GROUP BY
  TO_CHAR(e.created_at AT TIME ZONE 'America/Chicago', 'Dy MM/DD'),
  EXTRACT(DOW FROM e.created_at AT TIME ZONE 'America/Chicago'),
  e.type, y.id, e.notes
ORDER BY
  MIN(e.created_at),
  e.type;


-- ─── SECTION 4: EVENT TOTALS BY TYPE (FULL WEEK) ───────────
SELECT '=== WEEKLY TOTALS BY EVENT TYPE ===' AS section,
  NULL AS detail, NULL AS sub_detail, NULL AS count, NULL AS notes;

SELECT 'Weekly Total' AS section,
  UPPER(e.type) AS detail,
  NULL AS sub_detail,
  COUNT(*) AS count,
  NULL AS notes
FROM events e
JOIN colonies c ON e.colony_id = c.id
JOIN yards y ON c.yard_id = y.id
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'
  AND e.created_at >= '2026-03-24'
  AND e.created_at < '2026-03-31'
GROUP BY e.type
ORDER BY count DESC;


-- ─── SECTION 5: YARD-LEVEL DETAIL (spot check any yard) ────
SELECT '=== TOP 20 YARDS BY EVENT COUNT ===' AS section,
  NULL AS detail, NULL AS sub_detail, NULL AS count, NULL AS notes;

SELECT 'Yard Detail' AS section,
  y.name AS detail,
  y.location_note AS sub_detail,
  COUNT(e.id) AS count,
  (SELECT COUNT(*) FROM colonies WHERE yard_id = y.id)::TEXT || ' colonies' AS notes
FROM yards y
LEFT JOIN colonies c ON c.yard_id = y.id
LEFT JOIN events e ON e.colony_id = c.id
  AND e.created_at >= '2026-03-24'
  AND e.created_at < '2026-03-31'
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'
GROUP BY y.id, y.name, y.location_note
HAVING COUNT(e.id) > 0
ORDER BY count DESC
LIMIT 20;


-- ─── SECTION 6: DATA INTEGRITY CHECKS ──────────────────────
SELECT '=== INTEGRITY CHECKS ===' AS section,
  NULL AS detail, NULL AS sub_detail, NULL AS count, NULL AS notes;

-- Check: no orphan colonies (colony without a yard)
SELECT 'Orphan colonies (should be 0)' AS section,
  COUNT(*)::TEXT AS detail,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS sub_detail,
  NULL::BIGINT AS count, NULL AS notes
FROM colonies c
WHERE NOT EXISTS (SELECT 1 FROM yards y WHERE y.id = c.yard_id);

-- Check: no orphan events (event without a colony)
SELECT 'Orphan events (should be 0)' AS section,
  COUNT(*)::TEXT AS detail,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS sub_detail,
  NULL::BIGINT AS count, NULL AS notes
FROM events e
WHERE NOT EXISTS (SELECT 1 FROM colonies c WHERE c.id = e.colony_id);

-- Check: no events on wrong user's colonies
SELECT 'Cross-user events (should be 0)' AS section,
  COUNT(*)::TEXT AS detail,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS sub_detail,
  NULL::BIGINT AS count, NULL AS notes
FROM events e
JOIN colonies c ON e.colony_id = c.id
JOIN yards y ON c.yard_id = y.id
WHERE e.logged_by = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'
  AND y.owner_id != '3fcf2c23-d30e-4520-95a9-16671f48dd4a';

-- Check: dead-out colonies have loss events
SELECT 'Dead outs with loss event' AS section,
  COUNT(DISTINCT c.id)::TEXT || ' of ' ||
    (SELECT COUNT(*) FROM colonies c2 JOIN yards y2 ON c2.yard_id = y2.id
     WHERE y2.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a' AND c2.status = 'deadout')::TEXT
  AS detail,
  NULL AS sub_detail,
  NULL::BIGINT AS count, NULL AS notes
FROM colonies c
JOIN yards y ON c.yard_id = y.id
JOIN events e ON e.colony_id = c.id AND e.type = 'loss'
WHERE y.owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a'
  AND c.status = 'deadout';
