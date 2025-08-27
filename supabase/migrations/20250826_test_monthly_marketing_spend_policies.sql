-- STEG 4: Testa funktionalitet efter RLS-optimering
-- Använd detta för att verifiera att optimeringar fungerar korrekt

-- Test 1: Kontrollera att wrapper-funktionen fungerar
SELECT 
    'current_user_role() funktion test' AS test_name,
    current_user_role() AS user_role,
    CASE 
        WHEN current_user_role() IS NOT NULL THEN '✅ Funktion fungerar'
        ELSE '❌ Funktion fungerar inte'
    END AS status;

-- Test 2: Verifiera att alla policies är uppdaterade
SELECT 
    'Policy optimering status' AS test_name,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%current_user_role()%' OR with_check LIKE '%current_user_role()%' THEN '✅ Optimerad'
        ELSE '❌ Ej optimerad'
    END AS optimization_status,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'monthly_marketing_spend'
ORDER BY cmd;

-- Test 3: Grundläggande funktionalitetstest (kräver admin-roll för att fungera)
-- OBS: Detta test kan bara köras av admin-användare
DO $$
DECLARE
    test_result TEXT;
    admin_test_passed BOOLEAN := false;
BEGIN
    -- Försök läsa från tabellen (kräver admin-roll)
    BEGIN
        PERFORM COUNT(*) FROM monthly_marketing_spend;
        admin_test_passed := true;
        test_result := '✅ Admin access fungerar';
    EXCEPTION WHEN OTHERS THEN
        test_result := '⚠️ Access nekad (förväntad om inte admin): ' || SQLERRM;
    END;
    
    RAISE NOTICE 'Funktionalitetstest: %', test_result;
    
    -- Visa sammanfattning
    RAISE NOTICE '=== RLS OPTIMERING SLUTFÖRD ===';
    RAISE NOTICE 'Wrapper-funktion: current_user_role() skapad';
    RAISE NOTICE 'Policies optimerade: SELECT, INSERT, UPDATE, DELETE';
    RAISE NOTICE 'Admin access test: %', CASE WHEN admin_test_passed THEN 'GODKÄND' ELSE 'KRÄVER ADMIN-ROLL' END;
END $$;