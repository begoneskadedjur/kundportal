-- STEG 3D: Optimera DELETE policy för monthly_marketing_spend
-- Använder optimerad auth-kontroll istället för upprepade auth.jwt() anrop

DO $$
BEGIN
    -- Kontrollera om policy redan finns och ta bort den
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'monthly_marketing_spend' 
        AND policyname = 'Enable delete for admin users'
    ) THEN
        DROP POLICY "Enable delete for admin users" ON monthly_marketing_spend;
        RAISE NOTICE 'Gammal DELETE policy borttagen';
    END IF;
    
    -- Skapa optimerad DELETE policy
    CREATE POLICY "Enable delete for admin users" ON monthly_marketing_spend
        FOR DELETE
        USING (current_user_role() = 'admin');
    
    RAISE NOTICE 'Optimerad DELETE policy skapad för monthly_marketing_spend';
    
END $$;