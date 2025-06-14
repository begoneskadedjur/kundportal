import { createClient } from '@supabase/supabase-js'

// Se till att dessa variabler finns i din .env-fil
// Om du använder Vite är VITE_... korrekt. Om du använder Next.js ska det vara NEXT_PUBLIC_...
const supabaseUrl = process.env.VITE_SUPABASE_URL! 
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Skapa Supabase-klienten med service role key
// Denna klient kan utföra operationer som kringgår RLS.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Skapa en service-klass som samlar all admin-logik
export class SupabaseAdminService {
  
  // -- DINA NYA METODER (ANPASSADE) --

  /**
   * Hittar en kund baserat på deras ClickUp List ID.
   */
  async findCustomerByListId(listId: string) {
    // Använd `supabaseAdmin` istället för `this.supabase`
    const { data, error } = await supabaseAdmin 
      .from('customers')
      .select('*')
      .eq('clickup_list_id', listId)
      .single();
    
    if (error) {
      // Logga felet men krascha inte om det bara är att raden inte hittades
      if (error.code !== 'PGRST116') {
        console.error('Error finding customer by list ID:', error);
      }
      return null;
    }
    
    return data;
  }

  /**
   * Hämtar en kund och dess relaterade avtalstyp.
   */
  async getCustomerWithContractType(customerId: string) {
    // Använd `supabaseAdmin` istället för `this.supabase`
    const { data, error } = await supabaseAdmin
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

  // -- DINA GAMLA, BEFINTLIGA METODER (FUNGERAR REDAN) --

  /**
   * Hitta kund baserat på ClickUp list-namn eller företagsnamn.
   * (Denna funktion från din "gamla" kod var redan bra)
   */
  async findCustomerByListName(listName: string) {
    try {
      // Försök först med exakt match på företagsnamn
      let { data, error } = await supabaseAdmin
        .from('customers')
        .select('id, company_name, contact_person, clickup_list_name')
        .eq('company_name', listName)
        .single();
      
      // Om inget hittades, försök med ClickUp-listans namn
      if (error && !data) {
        ({ data, error } = await supabaseAdmin
          .from('customers')
          .select('id, company_name, contact_person, clickup_list_name')
          .eq('clickup_list_name', listName)
          .single());
      }

      if (error && error.code !== 'PGRST116') { // Ignorera "no rows found"-felet
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in findCustomerByListName:', error);
      return null;
    }
  }

  // Hitta befintligt ärende baserat på ClickUp task ID
  async findExistingCase(clickupTaskId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .select('id, updated_at')
        .eq('clickup_task_id', clickupTaskId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    } catch (error) {
      console.error('Error finding existing case:', error)
      return null
    }
  }

  // Skapa nytt ärende
  async createCase(caseData: any) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .insert(caseData)
        .select()
        .single()

      if (error) throw error
      return data

    } catch (error) {
      console.error('Error creating case:', error)
      throw error
    }
  }

  // Uppdatera befintligt ärende
  async updateCase(caseId: string, caseData: any) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .update({
          ...caseData,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId)
        .select()
        .single()

      if (error) throw error
      return data

    } catch (error) {
      console.error('Error updating case:', error)
      throw error
    }
  }
}

// Exportera en enda instans av din service-klass.
// Då kan du importera och använda den direkt på andra ställen.
export const supabaseAdminService = new SupabaseAdminService()