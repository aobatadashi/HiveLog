-- HiveLog Simulation Cleanup
-- Run this in the Supabase SQL Editor to remove all simulation data.
-- Cascade deletes will remove colonies, events, queens, and treatment_details.

DELETE FROM yards
WHERE owner_id = '4c7a331b-d9ad-4660-9c2e-acd74f98d400'
AND name IN ('Harris Ranch East', 'Lerdo Hwy', 'Rosedale North', 'Weedpatch', 'Panama Ln', 'Lamont South', 'Edison Rd', 'Arvin West', 'Shafter #2', 'McFarland', 'Bear Mountain', 'Caliente Creek', 'Woody', 'Glennville', 'Alta Sierra', 'Sand Canyon', 'Bodfish', 'Lake Isabella');

-- Verify cleanup:
SELECT count(*) as remaining_yards FROM yards WHERE owner_id = '4c7a331b-d9ad-4660-9c2e-acd74f98d400';
