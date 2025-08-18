const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initiera Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Miljövariabler saknas! Kontrollera VITE_SUPABASE_URL och SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Lista över testanvändare som ska tas bort
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

async function deleteTestUsers() {
  console.log('🧹 Startar borttagning av multi-site testanvändare...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const userId of testUserIds) {
    try {
      // Hämta användarinfo först
      const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (fetchError) {
        console.log(`⚠️  Användare ${userId} finns inte eller är redan borttagen`);
        continue;
      }
      
      // Ta bort användaren
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteError) {
        console.error(`❌ Fel vid borttagning av ${user?.email || userId}:`, deleteError.message);
        errorCount++;
      } else {
        console.log(`✅ Tog bort användare: ${user?.email || userId}`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Oväntat fel för ${userId}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n📊 Sammanfattning:');
  console.log(`✅ Borttagna: ${successCount} användare`);
  console.log(`❌ Fel: ${errorCount} användare`);
  console.log(`⚠️  Redan borttagna/saknas: ${testUserIds.length - successCount - errorCount} användare`);
  
  // Verifiera att roller också är borta
  console.log('\n🔍 Verifierar att multisite_user_roles är tomma...');
  const { data: remainingRoles, error: rolesError } = await supabaseAdmin
    .from('multisite_user_roles')
    .select('id')
    .in('user_id', testUserIds);
  
  if (rolesError) {
    console.error('❌ Kunde inte verifiera roller:', rolesError.message);
  } else if (remainingRoles && remainingRoles.length > 0) {
    console.log(`⚠️  ${remainingRoles.length} roller hittades fortfarande (borde vara 0)`);
  } else {
    console.log('✅ Alla multisite_user_roles är borttagna!');
  }
  
  console.log('\n✨ Rensning klar! Du kan nu testa multi-site registrering på nytt.');
}

// Kör rensningen
deleteTestUsers().catch(console.error);