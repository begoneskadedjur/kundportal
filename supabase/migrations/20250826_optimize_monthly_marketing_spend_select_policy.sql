-- STEG 3A: Optimera SELECT policy för monthly_marketing_spend
-- Använder optimerad auth-kontroll istället för upprepade auth.jwt() anrop

DO $$
BEGIN
    -- Kontrollera om policy redan finns och ta bort den
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'monthly_marketing_spend' 
        AND policyname = 'Enable read access for authenticated users'
    ) THEN
        DROP POLICY "Enable read access for authenticated users" ON monthly_marketing_spend;
        RAISE NOTICE 'Gammal SELECT policy borttagen';
    END IF;
    
    -- Skapa optimerad SELECT policy
    CREATE POLICY "Enable read access for authenticated users" ON monthly_marketing_spend
        FOR SELECT
        USING (current_user_role() = 'admin');
    
    RAISE NOTICE 'Optimerad SELECT policy skapad för monthly_marketing_spend';
    
    -- Testa policy (valfritt - kräver admin-användare för att returnera rader)
    -- SELECT COUNT(*) FROM monthly_marketing_spend;
    
END $$;