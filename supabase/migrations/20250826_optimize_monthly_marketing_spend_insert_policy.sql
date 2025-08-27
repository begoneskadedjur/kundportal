-- STEG 3B: Optimera INSERT policy för monthly_marketing_spend
-- Använder optimerad auth-kontroll istället för upprepade auth.jwt() anrop

DO $$
BEGIN
    -- Kontrollera om policy redan finns och ta bort den
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'monthly_marketing_spend' 
        AND policyname = 'Enable insert for admin users'
    ) THEN
        DROP POLICY "Enable insert for admin users" ON monthly_marketing_spend;
        RAISE NOTICE 'Gammal INSERT policy borttagen';
    END IF;
    
    -- Skapa optimerad INSERT policy
    CREATE POLICY "Enable insert for admin users" ON monthly_marketing_spend
        FOR INSERT
        WITH CHECK (current_user_role() = 'admin');
    
    RAISE NOTICE 'Optimerad INSERT policy skapad för monthly_marketing_spend';
    
END $$;