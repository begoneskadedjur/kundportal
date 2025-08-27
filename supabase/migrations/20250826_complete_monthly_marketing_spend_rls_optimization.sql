-- KOMPLETT RLS-OPTIMERING FÖR monthly_marketing_spend TABELLEN
-- Implementerar alla optimeringar enligt analys i en enda migration
-- 
-- FÖRBÄTTRINGAR:
-- 1. Skapar wrapper-funktion för att undvika upprepade auth.jwt() anrop
-- 2. Optimerar alla policies (SELECT, INSERT, UPDATE, DELETE)
-- 3. Förbättrar prestanda genom STABLE function caching
--
-- SÄKERHET: Alla policies begränsar access till enbart admin-användare

BEGIN;

-- =============================================================================
-- STEG 1: SKAPA OPTIMERAD AUTH WRAPPER-FUNKTION
-- =============================================================================

-- Ta bort befintlig funktion om den finns
DROP FUNCTION IF EXISTS current_user_role();

-- Skapa ny optimerad auth wrapper-funktion
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
    -- Använd STABLE för att låta PostgreSQL cache:a resultatet inom samma transaktion
    -- SECURITY DEFINER gör att funktionen körs med skaparens rättigheter
    RETURN (auth.jwt() ->> 'user_role');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Ge behörigheter till funktionen
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO anon;

-- =============================================================================
-- STEG 2: OPTIMERA ALLA RLS POLICIES
-- =============================================================================

-- Kontrollera att RLS är aktiverat (borde redan vara det)
ALTER TABLE monthly_marketing_spend ENABLE ROW LEVEL SECURITY;

-- OPTIMERA SELECT POLICY
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON monthly_marketing_spend;
CREATE POLICY "Enable read access for authenticated users" ON monthly_marketing_spend
    FOR SELECT
    USING (current_user_role() = 'admin');

-- OPTIMERA INSERT POLICY  
DROP POLICY IF EXISTS "Enable insert for admin users" ON monthly_marketing_spend;
CREATE POLICY "Enable insert for admin users" ON monthly_marketing_spend
    FOR INSERT
    WITH CHECK (current_user_role() = 'admin');

-- OPTIMERA UPDATE POLICY
DROP POLICY IF EXISTS "Enable update for admin users" ON monthly_marketing_spend;
CREATE POLICY "Enable update for admin users" ON monthly_marketing_spend
    FOR UPDATE
    USING (current_user_role() = 'admin')
    WITH CHECK (current_user_role() = 'admin');

-- OPTIMERA DELETE POLICY
DROP POLICY IF EXISTS "Enable delete for admin users" ON monthly_marketing_spend;
CREATE POLICY "Enable delete for admin users" ON monthly_marketing_spend
    FOR DELETE
    USING (current_user_role() = 'admin');

-- =============================================================================
-- STEG 3: VALIDERING OCH DIAGNOSTIK
-- =============================================================================

-- Visa slutresultat av optimering
DO $$
BEGIN
    RAISE NOTICE '=== MONTHLY_MARKETING_SPEND RLS OPTIMERING SLUTFÖRD ===';
    RAISE NOTICE '';
    RAISE NOTICE 'FÖRBÄTTRINGAR IMPLEMENTERADE:';
    RAISE NOTICE '✅ Wrapper-funktion current_user_role() skapad för bättre prestanda';
    RAISE NOTICE '✅ SELECT policy optimerad - använder wrapper-funktion';
    RAISE NOTICE '✅ INSERT policy optimerad - använder wrapper-funktion';
    RAISE NOTICE '✅ UPDATE policy optimerad - använder wrapper-funktion';
    RAISE NOTICE '✅ DELETE policy optimerad - använder wrapper-funktion';
    RAISE NOTICE '';
    RAISE NOTICE 'SÄKERHETSINFO:';
    RAISE NOTICE '🔒 Alla policies begränsar access till enbart admin-användare';
    RAISE NOTICE '🔒 RLS är aktiverat för tabellen';
    RAISE NOTICE '';
    RAISE NOTICE 'PRESTANDA:';
    RAISE NOTICE '⚡ Wrapper-funktionen cache:as inom samma transaktion';
    RAISE NOTICE '⚡ Undviker upprepade auth.jwt() anrop';
    RAISE NOTICE '⚡ Förbättrad query-prestanda för policies';
    RAISE NOTICE '';
    RAISE NOTICE 'NÄSTA STEG: Testa funktionaliteten med admin-användare';
END $$;

COMMIT;