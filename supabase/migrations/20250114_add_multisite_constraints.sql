-- Migration: Lägg till constraints för multisite-kunder
-- Syfte: Säkerställa dataintegritet för multisite utan att påverka vanliga kunder
-- Datum: 2025-01-14

-- 1. Lägg till check constraint för site_type
-- Endast tillåt site_type för multisite-kunder
ALTER TABLE customers 
ADD CONSTRAINT check_site_type_multisite 
CHECK (
  (is_multisite = true AND site_type IN ('huvudkontor', 'enhet'))
  OR
  (is_multisite = false AND site_type IS NULL)
  OR
  (is_multisite IS NULL AND site_type IS NULL)
);

-- 2. Lägg till check constraint för parent_customer_id
-- parent_customer_id får endast finnas för enheter
ALTER TABLE customers 
ADD CONSTRAINT check_parent_customer_multisite 
CHECK (
  (site_type = 'enhet' AND parent_customer_id IS NOT NULL)
  OR
  (site_type != 'enhet' AND parent_customer_id IS NULL)
  OR
  (site_type IS NULL AND parent_customer_id IS NULL)
);

-- 3. Lägg till check constraint för organization_id
-- organization_id krävs för multisite-kunder
ALTER TABLE customers 
ADD CONSTRAINT check_organization_id_multisite 
CHECK (
  (is_multisite = true AND organization_id IS NOT NULL)
  OR
  (is_multisite = false)
  OR
  (is_multisite IS NULL)
);

-- 4. Skapa index för bättre prestanda på multisite-queries
CREATE INDEX IF NOT EXISTS idx_customers_multisite 
ON customers(organization_id, site_type, is_multisite) 
WHERE is_multisite = true;

-- 5. Skapa index för parent-child relationer
CREATE INDEX IF NOT EXISTS idx_customers_parent 
ON customers(parent_customer_id) 
WHERE parent_customer_id IS NOT NULL;

-- 6. Skapa funktion för att validera att parent_customer_id pekar på huvudkontor
CREATE OR REPLACE FUNCTION validate_parent_is_huvudkontor()
RETURNS TRIGGER AS $$
BEGIN
  -- Endast validera för multisite-enheter
  IF NEW.site_type = 'enhet' AND NEW.parent_customer_id IS NOT NULL THEN
    -- Kontrollera att parent är ett huvudkontor
    IF NOT EXISTS (
      SELECT 1 FROM customers 
      WHERE id = NEW.parent_customer_id 
      AND site_type = 'huvudkontor'
      AND is_multisite = true
    ) THEN
      RAISE EXCEPTION 'parent_customer_id måste peka på ett huvudkontor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Skapa trigger för validering
DROP TRIGGER IF EXISTS validate_parent_trigger ON customers;
CREATE TRIGGER validate_parent_trigger
BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION validate_parent_is_huvudkontor();

-- 8. Uppdatera RLS policy för att säkerställa separation
-- Lägg till extra säkerhet för multisite-användare
DROP POLICY IF EXISTS "Multisite users can view their organization customers" ON customers;
CREATE POLICY "Multisite users can view their organization customers" ON customers
FOR SELECT 
USING (
  -- Multisite-användare kan endast se customers inom sin organisation
  -- och endast om det är multisite-kunder
  is_multisite = true 
  AND organization_id IN (
    SELECT organization_id 
    FROM multisite_user_roles 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- 9. Lägg till kommentarer för dokumentation
COMMENT ON COLUMN customers.is_multisite IS 'Flagga som indikerar om kunden är del av en multisite-organisation';
COMMENT ON COLUMN customers.site_type IS 'Typ av multisite-enhet: huvudkontor eller enhet. NULL för vanliga kunder';
COMMENT ON COLUMN customers.organization_id IS 'Unikt ID för multisite-organisationen. NULL för vanliga kunder';
COMMENT ON COLUMN customers.parent_customer_id IS 'Referens till huvudkontorets customer.id för enheter. NULL för huvudkontor och vanliga kunder';
COMMENT ON COLUMN customers.site_name IS 'Namnet på enheten för multisite. NULL för vanliga kunder';
COMMENT ON COLUMN customers.site_code IS 'Unik kod för enheten. NULL för vanliga kunder';
COMMENT ON COLUMN customers.region IS 'Region för multisite-enheter. Kan användas för vanliga kunder också';

-- 10. Verifiera att inga vanliga kunder påverkas
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Kontrollera att inga vanliga kunder har multisite-fält satta felaktigt
  SELECT COUNT(*) INTO invalid_count
  FROM customers
  WHERE (is_multisite = false OR is_multisite IS NULL)
  AND (site_type IS NOT NULL OR organization_id IS NOT NULL OR parent_customer_id IS NOT NULL);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Det finns % vanliga kunder med multisite-fält satta. Dessa bör rensas.', invalid_count;
  END IF;
END $$;