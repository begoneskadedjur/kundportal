// Test script för att verifiera ärendeskapande
// Kör detta i browser console när inloggad som kund eller multisite-användare

async function testCaseCreation() {
  const { supabase } = window;
  
  // Generera case number
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const caseNumber = `TEST-${dateStr}-${Date.now().toString().slice(-6)}`;
  
  // Hämta användarens profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('customer_id, role')
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .single();
  
  console.log('User profile:', profile);
  
  // För multisite-användare, hämta en customer_id från deras organisation
  let customerId = profile.customer_id;
  
  if (!customerId) {
    // Försök hämta från multisite
    const { data: multisiteRole } = await supabase
      .from('multisite_user_roles')
      .select('organization_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user.id)
      .single();
    
    if (multisiteRole) {
      const { data: orgCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('organization_id', multisiteRole.organization_id)
        .eq('is_multisite', true)
        .limit(1)
        .single();
      
      customerId = orgCustomer?.id;
    }
  }
  
  console.log('Customer ID to use:', customerId);
  
  if (!customerId) {
    console.error('No customer_id found!');
    return;
  }
  
  // Försök skapa ärende
  const testCase = {
    customer_id: customerId,
    case_number: caseNumber,
    title: 'Test ärende från script',
    description: 'Detta är ett test för att verifiera att RLS policies fungerar',
    status: 'Öppen',
    priority: 'normal',
    service_type: 'inspection',
    contact_person: 'Test Person',
    contact_email: 'test@example.com',
    contact_phone: '0701234567'
  };
  
  console.log('Attempting to create case:', testCase);
  
  const { data, error } = await supabase
    .from('cases')
    .insert(testCase)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating case:', error);
    return { success: false, error };
  }
  
  console.log('Case created successfully:', data);
  return { success: true, data };
}

// Kör test
testCaseCreation().then(result => {
  if (result.success) {
    console.log('✅ Test successful! Case created:', result.data);
  } else {
    console.log('❌ Test failed:', result.error);
  }
});