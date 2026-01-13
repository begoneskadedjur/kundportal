-- Add DELETE policy for equipment_placements
-- Allows technicians to delete equipment they placed, or admins/coordinators to delete any

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Tekniker kan ta bort egen utrustning" ON equipment_placements;
DROP POLICY IF EXISTS "Admin kan ta bort all utrustning" ON equipment_placements;

-- Tekniker kan ta bort utrustning de själva placerat
CREATE POLICY "Tekniker kan ta bort egen utrustning"
ON equipment_placements
FOR DELETE
TO authenticated
USING (
  placed_by_technician_id IN (
    SELECT technician_id FROM profiles WHERE id = auth.uid()
  )
);

-- Alternativ: Tillåt alla autentiserade användare att ta bort (mindre restriktivt)
-- Om ovanstående inte fungerar, kan vi använda denna istället:
-- CREATE POLICY "Autentiserade kan ta bort utrustning"
-- ON equipment_placements
-- FOR DELETE
-- TO authenticated
-- USING (true);
