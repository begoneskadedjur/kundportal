// src/services/contractService.ts - Service för contracts CRUD-operationer
import { supabase } from '../lib/supabase'
import { Contract, ContractInsert, ContractUpdate } from '../types/database'
import { ALLOWED_TEMPLATE_IDS } from '../constants/oneflowTemplates'
import toast from 'react-hot-toast'

export interface ContractWithSourceData extends Contract {
  // Utökad data från källärendet
  source_case_data?: {
    title?: string
    case_number?: string
    clickup_task_id?: string
  }
  // Utökad kunddata
  customer_data?: {
    company_name?: string
    contact_person?: string
    email?: string
  }
}

export interface ContractFilters {
  status?: Contract['status']
  type?: Contract['type']  
  source_type?: Contract['source_type']
  customer_id?: string
  date_from?: string
  date_to?: string
  search?: string // För att söka i namn, e-post, företag
}

export interface ContractStats {
  total_contracts: number
  total_offers: number
  total_value: number
  signed_contracts: number
  pending_contracts: number
  active_contracts: number
  contract_signing_rate: number // Procent av kontrakt som signerats
  offer_conversion_rate: number  // Procent av offerter som blivit kontrakt
}

// Service-klass för contract-hantering
export class ContractService {
  
  // Hämta alla kontrakt med filter och sökning
  static async getContracts(filters: ContractFilters = {}): Promise<ContractWithSourceData[]> {
    try {
      console.log('🔍 Hämtar kontrakt med filter:', filters)
      
      let query = supabase
        .from('contracts')
        .select(`
          *,
          customers (
            id, company_name, contact_person, email
          )
        `)
        .order('created_at', { ascending: false })

      // Filtrera bort draft-kontrakt och kontrakt med oanvända mallar
      query = query.neq('status', 'draft')
      query = query.in('template_id', Array.from(ALLOWED_TEMPLATE_IDS))

      // Tillämpa filter
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      
      if (filters.type) {
        query = query.eq('type', filters.type)
      }
      
      if (filters.source_type) {
        query = query.eq('source_type', filters.source_type)
      }
      
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id)
      }
      
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from)
      }
      
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      // Textsökning i flera fält
      if (filters.search) {
        const searchTerm = `%${filters.search}%`
        query = query.or(`
          contact_person.ilike.${searchTerm},
          contact_email.ilike.${searchTerm},
          company_name.ilike.${searchTerm},
          oneflow_contract_id.ilike.${searchTerm}
        `)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Fel vid hämtning av kontrakt:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Hämta källdata för kontrakt som har source_id
      const contractsWithSourceData = await Promise.all(
        (data || []).map(async (contract) => {
          let source_case_data = undefined
          
          if (contract.source_id && contract.source_type !== 'manual') {
            try {
              // Hämta källärendet baserat på source_type
              const tableName = contract.source_type === 'private_case' ? 'private_cases' : 'business_cases'
              const { data: sourceData } = await supabase
                .from(tableName)
                .select('title, case_number, clickup_task_id')
                .eq('id', contract.source_id)
                .single()
              
              if (sourceData) {
                source_case_data = sourceData
              }
            } catch (sourceError) {
              console.warn(`⚠️ Kunde inte hämta källdata för ${contract.id}:`, sourceError)
            }
          }

          return {
            ...contract,
            source_case_data,
            customer_data: contract.customers || undefined
          } as ContractWithSourceData
        })
      )

      console.log('✅ Kontrakt hämtade:', contractsWithSourceData.length)
      return contractsWithSourceData

    } catch (error) {
      console.error('💥 ContractService.getContracts fel:', error)
      throw error
    }
  }

  // Hämta enstaka kontrakt med alla relationer
  static async getContract(id: string): Promise<ContractWithSourceData | null> {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          customers (
            id, company_name, contact_person, email, phone, address, org_number
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null
        }
        console.error('❌ Fel vid hämtning av kontrakt:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Hämta källdata om det finns
      let source_case_data = undefined
      if (data.source_id && data.source_type !== 'manual') {
        const tableName = data.source_type === 'private_case' ? 'private_cases' : 'business_cases'
        const { data: sourceData } = await supabase
          .from(tableName)
          .select('title, case_number, clickup_task_id, contact_person, contact_email')
          .eq('id', data.source_id)
          .single()
        
        if (sourceData) {
          source_case_data = sourceData
        }
      }

      return {
        ...data,
        source_case_data,
        customer_data: data.customers || undefined
      } as ContractWithSourceData

    } catch (error) {
      console.error('💥 ContractService.getContract fel:', error)
      throw error
    }
  }

  // Skapa nytt kontrakt (används av webhook)
  static async createContract(contractData: ContractInsert): Promise<Contract> {
    try {
      console.log('🆕 Skapar nytt kontrakt:', contractData.oneflow_contract_id)

      const { data, error } = await supabase
        .from('contracts')
        .insert([contractData])
        .select()
        .single()

      if (error) {
        console.error('❌ Fel vid skapande av kontrakt:', error)
        throw new Error(`Kunde inte skapa kontraktet: ${error.message}`)
      }

      console.log('✅ Kontrakt skapat:', data.id)
      return data

    } catch (error) {
      console.error('💥 ContractService.createContract fel:', error)
      throw error
    }
  }

  // Uppdatera befintligt kontrakt 
  static async updateContract(id: string, updates: ContractUpdate): Promise<Contract> {
    try {
      console.log('🔄 Uppdaterar kontrakt:', id, updates)

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Fel vid uppdatering av kontrakt:', error)
        throw new Error(`Kunde inte uppdatera kontraktet: ${error.message}`)
      }

      console.log('✅ Kontrakt uppdaterat:', data.id)
      return data

    } catch (error) {
      console.error('💥 ContractService.updateContract fel:', error)
      throw error
    }
  }

  // Uppdatera kontrakt baserat på OneFlow ID (används av webhook)
  static async updateContractByOneflowId(oneflowId: string, updates: ContractUpdate): Promise<Contract | null> {
    try {
      console.log('🔄 Uppdaterar kontrakt via OneFlow ID:', oneflowId, updates)

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('oneflow_contract_id', oneflowId)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          console.warn(`⚠️ Inget kontrakt hittades med OneFlow ID: ${oneflowId}`)
          return null
        }
        console.error('❌ Fel vid uppdatering av kontrakt:', error)
        throw new Error(`Kunde inte uppdatera kontraktet: ${error.message}`)
      }

      console.log('✅ Kontrakt uppdaterat via OneFlow ID:', data.id)
      return data

    } catch (error) {
      console.error('💥 ContractService.updateContractByOneflowId fel:', error)
      throw error
    }
  }

  // Automatisk kundregistrering vid signerat avtal
  static async createCustomerFromContract(contract: Contract): Promise<string> {
    try {
      console.log('👤 Skapar kund från signerat avtal:', contract.id)

      if (!contract.contact_email || !contract.contact_person) {
        throw new Error('Otillräcklig kontaktinformation för att skapa kund')
      }

      // Kontrollera om kund redan finns
      let existingCustomer = null
      if (contract.organization_number) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .eq('org_number', contract.organization_number)
          .single()
        existingCustomer = data
      }

      if (!existingCustomer && contract.contact_email) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .eq('email', contract.contact_email)
          .single()
        existingCustomer = data
      }

      if (existingCustomer) {
        console.log('✅ Befintlig kund hittad:', existingCustomer.id)
        return existingCustomer.id
      }

      // Skapa ny kund
      const customerData = {
        company_name: contract.company_name || contract.contact_person,
        org_number: contract.organization_number || '',
        contact_person: contract.contact_person,
        email: contract.contact_email,
        phone: contract.contact_phone || '',
        address: contract.contact_address || '',
        contract_type_id: '', // Behöver sättas baserat på business logic
        clickup_list_id: '', // Behöver mappas
        clickup_list_name: 'Avtalskunder',
        is_active: true,
        contract_start_date: contract.start_date,
        contract_length_months: contract.contract_length ? parseInt(contract.contract_length) : null,
        total_contract_value: contract.total_value,
        contract_description: contract.agreement_text?.substring(0, 500),
        assigned_account_manager: contract.begone_employee_name,
        contract_status: 'active' as const,
        business_type: contract.type === 'contract' ? 'Avtalkund' : 'Offert'
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select('id')
        .single()

      if (error) {
        console.error('❌ Fel vid skapande av kund:', error)
        throw new Error(`Kunde inte skapa kund: ${error.message}`)
      }

      console.log('✅ Ny kund skapad:', newCustomer.id)
      return newCustomer.id

    } catch (error) {
      console.error('💥 ContractService.createCustomerFromContract fel:', error)
      throw error
    }
  }

  // Hämta kontraktstatistik för dashboard
  static async getContractStats(filters: Pick<ContractFilters, 'date_from' | 'date_to'> = {}): Promise<ContractStats> {
    try {
      console.log('📊 Hämtar kontraktstatistik...')

      let query = supabase
        .from('contracts')
        .select('type, status, total_value')

      // Filtrera bort draft-kontrakt och kontrakt med oanvända mallar
      query = query.neq('status', 'draft')
      query = query.in('template_id', Array.from(ALLOWED_TEMPLATE_IDS))

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from)
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Fel vid hämtning av statistik:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      const contracts = data || []
      
      // Beräkna statistik
      const total_contracts = contracts.filter(c => c.type === 'contract').length
      const total_offers = contracts.filter(c => c.type === 'offer').length
      const signed_contracts = contracts.filter(c => c.type === 'contract' && c.status === 'signed').length
      const pending_contracts = contracts.filter(c => c.status === 'pending').length
      const active_contracts = contracts.filter(c => c.status === 'active').length
      
      const total_value = contracts
        .filter(c => c.total_value)
        .reduce((sum, c) => sum + (c.total_value || 0), 0)

      const contract_signing_rate = total_contracts > 0 
        ? Math.round((signed_contracts / total_contracts) * 100) 
        : 0

      const offer_conversion_rate = total_offers > 0
        ? Math.round((contracts.filter(c => c.type === 'offer' && c.status === 'signed').length / total_offers) * 100)
        : 0

      const stats: ContractStats = {
        total_contracts,
        total_offers,
        total_value,
        signed_contracts,
        pending_contracts,
        active_contracts,
        contract_signing_rate,
        offer_conversion_rate
      }

      console.log('✅ Statistik hämtad:', stats)
      return stats

    } catch (error) {
      console.error('💥 ContractService.getContractStats fel:', error)
      throw error
    }
  }

  // Kontrollera om OneFlow kontrakt redan finns
  static async contractExists(oneflowContractId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('id')
        .eq('oneflow_contract_id', oneflowContractId)
        .single()

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        console.error('❌ Fel vid kontroll av kontrakt:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('💥 ContractService.contractExists fel:', error)
      return false
    }
  }

  // Ta bort kontrakt (soft delete genom att sätta status)
  static async deleteContract(id: string): Promise<void> {
    try {
      console.log('🗑️ Tar bort kontrakt:', id)

      const { error } = await supabase
        .from('contracts')
        .update({ 
          status: 'declined' as const,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('❌ Fel vid borttagning av kontrakt:', error)
        throw new Error(`Kunde inte ta bort kontraktet: ${error.message}`)
      }

      console.log('✅ Kontrakt borttaget (soft delete)')

    } catch (error) {
      console.error('💥 ContractService.deleteContract fel:', error)
      throw error
    }
  }
}

// Hjälpfunktioner för kontrakt
export const getContractStatusColor = (status: Contract['status']): string => {
  const colors = {
    'pending': '#f59e0b',    // amber-500
    'signed': '#10b981',     // emerald-500
    'declined': '#ef4444',   // red-500
    'active': '#059669',     // emerald-600  
    'ended': '#6b7280',      // gray-500
    'overdue': '#dc2626'     // red-600
  }
  return colors[status] || '#6b7280'
}

export const getContractStatusText = (status: Contract['status']): string => {
  const texts = {
    'pending': 'Väntar på signering',
    'signed': 'Signerat',
    'declined': 'Avvisat',
    'active': 'Aktivt',
    'ended': 'Avslutat', 
    'overdue': 'Försenat'
  }
  return texts[status] || status
}

export const getContractTypeText = (type: Contract['type']): string => {
  return type === 'contract' ? 'Avtal' : 'Offert'
}

export const formatContractValue = (value: number | null): string => {
  if (!value) return '-'
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    maximumFractionDigits: 0
  }).format(value)
}