import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY! // Service role key (inte anon!)

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Helper funktioner för vanliga operationer
export class SupabaseAdminService {
  
  // Hitta kund baserat på ClickUp list-namn
  async findCustomerByListName(listName: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('id, company_name, contact_person')
        .eq('company_name', listName)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      return data
    } catch (error) {
      console.error('Error finding customer:', error)
      return null
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

      if (error) {
        throw error
      }

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

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Error updating case:', error)
      throw error
    }
  }
}

export const supabaseAdminService = new SupabaseAdminService()