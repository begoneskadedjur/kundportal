-- STEG 3C: Optimera UPDATE policy för monthly_marketing_spend
-- Använder optimerad auth-kontroll istället för upprepade auth.jwt() anrop

DO $$
BEGIN
    -- Kontrollera om policy redan finns och ta bor den
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'monthly_marketing_spend' 
        AND policyname = 'Enable update for admin users'
    ) THEN
        DROP POLICY "Enable update for admin users" ON monthly_marketing_spend;
        RAISE NOTICE 'Gammal UPDATE policy borttagen';
    END IF;
    
    -- Skapa optimerad UPDATE policy
    CREATE POLICY "Enable update for admin users" ON monthly_marketing_spend
        FOR UPDATE
        USING (current_user_role() = 'admin')
        WITH CHECK (current_user_role() = 'admin');
    
    RAISE NOTICE 'Optimerad UPDATE policy skapad för monthly_marketing_spend';
    
END $$;