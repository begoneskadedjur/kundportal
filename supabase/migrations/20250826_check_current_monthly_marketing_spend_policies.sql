-- STEG 1: Kontrollera nuvarande RLS policies för monthly_marketing_spend tabellen
-- Kör detta först för att se befintliga policies

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'monthly_marketing_spend';

-- Kontrollera också om tabellen har RLS aktiverat
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE tablename = 'monthly_marketing_spend';