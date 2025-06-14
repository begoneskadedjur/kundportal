import { createClient } from '@supabase/supabase-js'

// Se till att dessa variabler finns i din .env-fil
// OBS: För Vercel bör du använda process.env.NAMN (utan VITE_ eller NEXT_PUBLIC_) för backend-kod.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL! 
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Skapa Supabase-klienten med service role key
// Denna klient kan utföra operationer som kringgår RLS.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Typ-definitioner för att göra koden säkrare och lättare att läsa
interface NewCustomerData {
  company_name: string;
  org_number: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  contract_type_id: string;
}

interface ClickUpInfo {
  listId: string;
  listName: string;
}

// Skapa en service-klass som samlar all admin-logik
export class SupabaseAdminService {
  
  // =========================================================
  // NYA METODER FÖR ATT SKAPA OCH HANTERA KUNDER
  // =========================================================

  /**
   * Skapar en ny kund i databasen.
   */
  async createCustomer(customerData: NewCustomerData) {
    return supabaseAdmin
      .from('customers')
      .insert({ ...customerData, is_active: true })
      .select()
      .single();
  }

  /**
   * Uppdaterar en kund med ClickUp-information.
   */
  async updateCustomerWithClickUpInfo(customerId: string, clickupInfo: ClickUpInfo) {
    return supabaseAdmin
      .from('customers')
      .update({
        clickup_list_id: clickupInfo.listId,
        clickup_list_name: clickupInfo.listName
      })
      .eq('id', customerId);
  }

  // =========================================================
  // BEFINTLIGA METODER (RENSADE OCH KORREKTA)
  // =========================================================
  
  /**
   * Hittar en kund baserat på deras ClickUp List ID.
   */
  async findCustomerByListId(listId: string) {
    const { data, error } = await supabaseAdmin 
      .from('customers')
      .select('*')
      .eq('clickup_list_id', listId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error finding customer by list ID:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Hämtar en kund och dess relaterade avtalstyp.
   */
  async getCustomerWithContractType(customerId: string) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select(`*, contract_types(id, name)`)
      .eq('id', customerId)
      .single();
    
    if (error) {
      console.error('Error fetching customer with contract type:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Hitta kund baserat på ClickUp list-namn eller företagsnamn.
   */
  async findCustomerByListName(listName: string) {
    try {
      let { data, error } = await supabaseAdmin
        .from('customers')
        .select('id, company_name, contact_person, clickup_list_name')
        .eq('company_name', listName)
        .single();
      
      if (error && !data) {
        ({ data, error } = await supabaseAdmin
          .from('customers')
          .select('id, company_name, contact_person, clickup_list_name')
          .eq('clickup_list_name', listName)
          .single());
      }

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in findCustomerByListName:', error);
      return null;
    }
  }

  /**
   * Hitta befintligt ärende baserat på ClickUp task ID.
   */
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

      return data;
    } catch (error) {
      console.error('Error finding existing case:', error)
      return null
    }
  }

  /**
   * Skapa nytt ärende i databasen.
   */
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

  /**
   * Uppdatera befintligt ärende.
   */
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
// Detta är ett bra mönster (Singleton) för att undvika att skapa nya instanser överallt.
export const supabaseAdminService = new SupabaseAdminService()