// src/services/customerService.ts
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export type CreateCustomerData = {
  company_name: string
  org_number: string
  contact_person: string
  email: string
  phone: string
  address: string
  contract_type_id: string
}

export const customerService = {
  async createCustomer(customerData: CreateCustomerData) {
    try {
      // Anropa API route istället för Edge Function
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerData })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa kund')
      }

      toast.success('Kund skapad och inbjudan skickad!')
      return data
    } catch (error: any) {
      console.error('Error creating customer:', error)
      toast.error(error.message || 'Ett fel uppstod')
      throw error
    }
  },

  async getCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        contract_types (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  async getCustomer(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        contract_types (
          id,
          name
        ),
        cases (
          id,
          case_number,
          title,
          status,
          priority,
          scheduled_date
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async updateCustomer(id: string, updates: Partial<CreateCustomerData>) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async toggleCustomerStatus(id: string, isActive: boolean) {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: isActive })
      .eq('id', id)

    if (error) throw error
    
    // Uppdatera även användarens profil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('customer_id', id)

    if (profileError) throw profileError
  }
}