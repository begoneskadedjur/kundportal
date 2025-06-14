// Lägg till dessa metoder i din supabase-admin.ts klass:

async findCustomerByListId(listId: string) {
  const { data, error } = await this.supabase
    .from('customers')
    .select('*')
    .eq('clickup_list_id', listId)
    .single();
  
  if (error) {
    console.error('Error finding customer by list ID:', error);
    return null;
  }
  
  return data;
}

async findCustomerByListName(listName: string) {
  // Först, försök hitta via clickup_list_name
  let { data, error } = await this.supabase
    .from('customers')
    .select('*')
    .eq('clickup_list_name', listName)
    .single();
  
  if (!error && data) {
    return data;
  }
  
  // Om ingen matchning, försök med company_name
  ({ data, error } = await this.supabase
    .from('customers')
    .select('*')
    .eq('company_name', listName)
    .single());
  
  if (error) {
    console.error('Error finding customer:', error);
    return null;
  }
  
  return data;
}

// Om du behöver hämta avtalstyp-information också:
async getCustomerWithContractType(customerId: string) {
  const { data, error } = await this.supabase
    .from('customers')
    .select(`
      *,
      contract_types (
        id,
        name
      )
    `)
    .eq('id', customerId)
    .single();
  
  if (error) {
    console.error('Error fetching customer with contract type:', error);
    return null;
  }
  
  return data;
}