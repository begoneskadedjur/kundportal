// src/services/customerService.ts - Utökad med getAllCustomers och deleteCustomer
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// Utökad type med alla nya fält
export type CreateCustomerData = {
  // Grundinformation
  company_name: string
  org_number: string
  contact_person: string
  email: string
  phone: string
  address: string
  contract_type_id: string
  business_type: string
  
  // Nya avtalsfält
  contract_start_date?: string
  contract_length_months?: string
  annual_premium?: string
  total_contract_value?: string
  contract_description?: string
  assigned_account_manager?: string
}

export const customerService = {
  async createCustomer(customerData: CreateCustomerData) {
    try {
      // Anropa API route med utökad data
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData) // Skicka direkt utan wrapping
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

  // TILLÄGD: Alias för getAllCustomers för bakåtkompatibilitet
  async getAllCustomers() {
    return this.getCustomers()
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
    // Konvertera string-värden till rätt datatyper för databas
    const dbUpdates: any = { ...updates }
    
    if (updates.contract_length_months) {
      dbUpdates.contract_length_months = parseInt(updates.contract_length_months)
    }
    if (updates.annual_premium) {
      dbUpdates.annual_premium = parseFloat(updates.annual_premium)
    }
    if (updates.total_contract_value) {
      dbUpdates.total_contract_value = parseFloat(updates.total_contract_value)
    }
    
    // Sätt updated_at timestamp
    dbUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('customers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async toggleCustomerStatus(id: string, isActive: boolean) {
    const { error } = await supabase
      .from('customers')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (error) throw error
    
    // Uppdatera även användarens profil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', id)
    
    if (profileError) throw profileError
    
    toast.success(`Kund ${isActive ? 'aktiverad' : 'inaktiverad'}`)
  },

  // TILLÄGD: deleteCustomer funktion
  async deleteCustomer(id: string) {
    try {
      // Först, hämta kundens ClickUp lista för att kunna radera den
      const customer = await this.getCustomer(id)
      
      // Radera kunden från databas
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      // TODO: Radera även ClickUp lista om det behövs
      // Detta kräver ClickUp API-anrop
      
      toast.success('Kund raderad')
      return true
    } catch (error: any) {
      console.error('Error deleting customer:', error)
      toast.error(error.message || 'Kunde inte radera kund')
      throw error
    }
  },

  // Nya funktioner för avancerad kundhantering
  async getCustomerStats() {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('is_active, contract_status, annual_premium, total_contract_value')

      if (error) throw error

      const stats = {
        total: customers?.length || 0,
        active: customers?.filter(c => c.is_active)?.length || 0,
        inactive: customers?.filter(c => !c.is_active)?.length || 0,
        totalAnnualRevenue: customers?.reduce((sum, c) => sum + (c.annual_premium || 0), 0) || 0,
        totalContractValue: customers?.reduce((sum, c) => sum + (c.total_contract_value || 0), 0) || 0,
        averageContractValue: 0
      }

      if (stats.total > 0) {
        stats.averageContractValue = stats.totalContractValue / stats.total
      }

      return stats
    } catch (error) {
      console.error('Error fetching customer stats:', error)
      return {
        total: 0,
        active: 0,
        inactive: 0,
        totalAnnualRevenue: 0,
        totalContractValue: 0,
        averageContractValue: 0
      }
    }
  },

  async getCustomersByAccountManager(accountManager: string) {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        contract_types (
          id,
          name
        )
      `)
      .eq('assigned_account_manager', accountManager)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  async getExpiringContracts(daysAhead: number = 90) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysAhead)
    
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        contract_types (
          id,
          name
        )
      `)
      .not('contract_start_date', 'is', null)
      .not('contract_length_months', 'is', null)
      .eq('is_active', true)
      .order('contract_start_date', { ascending: true })
    
    if (error) throw error
    
    // Filtrera kunder vars kontrakt löper ut inom angiven period
    const expiringCustomers = data?.filter(customer => {
      if (!customer.contract_start_date || !customer.contract_length_months) return false
      
      const startDate = new Date(customer.contract_start_date)
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + customer.contract_length_months)
      
      return endDate <= futureDate && endDate >= new Date()
    }) || []
    
    return expiringCustomers
  }
}