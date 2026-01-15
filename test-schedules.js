// Snabbtest för att kolla vad getSchedules hittar
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const from = new Date('2025-01-15');
  const to = new Date('2025-01-22');

  console.log('=== TESTAR DATABASINNEHÅLL ===\n');

  // 1. Kolla private_cases
  const { data: privateCases, error: e1 } = await supabase
    .from('private_cases')
    .select('id, title, start_date, due_date, primary_assignee_id, primary_assignee_name, status_name')
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString());

  console.log(`PRIVATE_CASES (${from.toISOString().split('T')[0]} - ${to.toISOString().split('T')[0]}):`);
  console.log(`  Antal: ${privateCases?.length || 0}`);
  if (e1) console.log(`  Error: ${e1.message}`);
  privateCases?.slice(0, 5).forEach(c => {
    console.log(`  - ${c.title?.substring(0, 40)} | ${c.start_date} | ${c.primary_assignee_name}`);
  });

  // 2. Kolla business_cases
  const { data: businessCases, error: e2 } = await supabase
    .from('business_cases')
    .select('id, title, start_date, due_date, primary_assignee_id, primary_assignee_name, status_name')
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString());

  console.log(`\nBUSINESS_CASES:`);
  console.log(`  Antal: ${businessCases?.length || 0}`);
  if (e2) console.log(`  Error: ${e2.message}`);
  businessCases?.slice(0, 5).forEach(c => {
    console.log(`  - ${c.title?.substring(0, 40)} | ${c.start_date} | ${c.primary_assignee_name}`);
  });

  // 3. Kolla cases (contract)
  const { data: contractCases, error: e3 } = await supabase
    .from('cases')
    .select('id, title, scheduled_start, scheduled_end, primary_technician_id')
    .gte('scheduled_start', from.toISOString())
    .lte('scheduled_start', to.toISOString());

  console.log(`\nCASES (avtal):`);
  console.log(`  Antal: ${contractCases?.length || 0}`);
  if (e3) console.log(`  Error: ${e3.message}`);

  // 4. Kolla om det finns ärenden UTAN start_date
  const { data: noDatePrivate } = await supabase
    .from('private_cases')
    .select('id, title, status_name')
    .is('start_date', null)
    .limit(10);

  const { data: noDateBusiness } = await supabase
    .from('business_cases')
    .select('id, title, status_name')
    .is('start_date', null)
    .limit(10);

  console.log(`\n=== ÄRENDEN UTAN START_DATE ===`);
  console.log(`  private_cases utan datum: ${noDatePrivate?.length || 0}`);
  console.log(`  business_cases utan datum: ${noDateBusiness?.length || 0}`);

  // 5. Kolla hur många ärenden totalt
  const { count: totalPrivate } = await supabase.from('private_cases').select('*', { count: 'exact', head: true });
  const { count: totalBusiness } = await supabase.from('business_cases').select('*', { count: 'exact', head: true });

  console.log(`\n=== TOTALT I DATABASEN ===`);
  console.log(`  private_cases: ${totalPrivate}`);
  console.log(`  business_cases: ${totalBusiness}`);

  // 6. Kolla senaste synkade ärenden
  const { data: recentPrivate } = await supabase
    .from('private_cases')
    .select('title, start_date, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log(`\n=== SENAST UPPDATERADE PRIVATE_CASES ===`);
  recentPrivate?.forEach(c => {
    console.log(`  - ${c.title?.substring(0, 30)} | start: ${c.start_date || 'NULL'} | updated: ${c.updated_at}`);
  });
}

test().catch(console.error);
