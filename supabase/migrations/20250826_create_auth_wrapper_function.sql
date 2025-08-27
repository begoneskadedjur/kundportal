-- STEG 2: Skapa optimerad auth wrapper-funktion för bättre prestanda
-- Detta förhindrar upprepade auth.jwt() anrop i policies

-- Kontrollera om funktionen redan finns
DO $$
BEGIN
    -- Ta bort befintlig funktion om den finns
    DROP FUNCTION IF EXISTS current_user_role();
    
    -- Skapa ny optimerad auth wrapper-funktion
    CREATE OR REPLACE FUNCTION current_user_role()
    RETURNS TEXT AS $func$
    BEGIN
        -- Använd STABLE för att låta PostgreSQL cache:a resultatet inom samma transaktion
        RETURN (auth.jwt() ->> 'user_role');
    END;
    $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
    
    -- Ge behörigheter
    GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
    GRANT EXECUTE ON FUNCTION current_user_role() TO anon;
    
    RAISE NOTICE 'Auth wrapper-funktion current_user_role() skapad eller uppdaterad';
END $$;