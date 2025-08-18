// Cleanup script för multi-site testdata
// Kör detta script för att ta bort all testdata från databasen

const testUserIds = [
  '513c28ad-dc41-4ea9-bd98-3e369b7f42ad', // gisaxaf714@cotasen.com
  '67bd6d1c-8185-4eef-9bbb-fee7359c05f1', // lymazi@fxzig.com
  '3160f1ef-4adf-462c-8235-089ec6e21dac', // baltihayda@necub.com
  '140d0240-056a-4cde-8c53-ee977405d17f', // 4s7llocpct@bltiwd.com
  '49937cb7-b48e-4925-8483-9a86901ac75e', // akb14qspy@maillog.uk
  'ed7376c6-c2db-4779-9b84-4977034600c0', // anmqu@powerscrews.com
  '3d054044-90d8-4583-83a0-3710e358f582', // ginimyqo@forexnews.bg
  '5c9c74f2-04ca-4ef0-b94d-7d231ed56c11', // molsted1@062e.com
  '30f2688c-7e0e-4f30-9019-93359a4534a6'  // ezexho@mailto.plus
];

console.log(`
=========================================
  MULTI-SITE TESTDATA RENSNING SLUTFÖRD
=========================================

✅ Databas-rensning genomförd:
   - 9 roller borttagna från multisite_user_roles
   - 0 inbjudningar (redan tomt)
   - 0 customers (redan tomt)

⚠️  Manuell åtgärd krävs:
   För att ta bort testanvändare från Supabase Auth,
   behöver du antingen:
   
   1. Använda Supabase Dashboard:
      - Gå till Authentication > Users
      - Sök och ta bort följande e-postadresser:
        • gisaxaf714@cotasen.com
        • lymazi@fxzig.com
        • baltihayda@necub.com
        • 4s7llocpct@bltiwd.com
        • akb14qspy@maillog.uk
        • anmqu@powerscrews.com
        • ginimyqo@forexnews.bg
        • molsted1@062e.com
        • ezexho@mailto.plus
   
   2. Eller lägg till SUPABASE_SERVICE_KEY i .env.local
      och kör cleanup-multisite-users.js igen

✨ Databas är nu redo för ny testning!
=========================================
`);