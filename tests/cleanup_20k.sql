-- ============================================================
-- HiveLog: Clean up all data for newguy@admin.com
-- Run this to reset and re-run the seed if needed
-- ============================================================
-- Cascade: deleting yards removes colonies and their events

DELETE FROM yards
WHERE owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a';

-- Verify clean
SELECT 'Yards remaining' AS check,
  COUNT(*) AS count
FROM yards WHERE owner_id = '3fcf2c23-d30e-4520-95a9-16671f48dd4a';
