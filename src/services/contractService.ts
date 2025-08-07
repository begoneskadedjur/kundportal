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
  // Creator tracking (från nya databas-kolumner)
  created_by_email?: string | null
  created_by_name?: string | null
  created_by_role?: string | null
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
  // Basic counts
  total_contracts: number
  total_offers: number
  signed_contracts: number
  pending_contracts: number
  active_contracts: number
  
  // Financial metrics
  total_value: number
  signed_value: number
  pending_value: number
  average_contract_value: number
  average_offer_value: number
  
  // Performance metrics
  contract_signing_rate: number // Procent av kontrakt som signerats
  offer_conversion_rate: number  // Procent av offerter som blivit kontrakt
  
  // Time-based analytics
  contracts_this_month: number
  contracts_last_month: number
  value_this_month: number
  value_last_month: number
  growth_rate: number // Månadsvis tillväxt i procent
  
  // Employee performance
  top_employees: Array<{
    name: string
    email: string
    contract_count: number
    total_value: number
    avg_value: number
  }>
  
  // Product insights
  popular_products: Array<{
    name: string
    count: number
    total_value: number
  }>
  
  // Pipeline health
  avg_signing_time_days: number
  overdue_count: number
  contracts_expiring_soon: number // Inom 30 dagar
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
      const allowedTemplates = Array.from(ALLOWED_TEMPLATE_IDS).concat(['no_template'])
      query = query.in('template_id', allowedTemplates)

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

      // Deduplicate contracts baserat på oneflow_contract_id
      const uniqueContracts = contractsWithSourceData.reduce((acc: ContractWithSourceData[], current) => {
        const existingIndex = acc.findIndex(contract => 
          contract.oneflow_contract_id === current.oneflow_contract_id
        )
        
        if (existingIndex === -1) {
          // Nytt kontrakt, lägg till
          acc.push(current)
        } else {
          // Duplikat hittat, behåll det senast uppdaterade
          const existing = acc[existingIndex]
          if (new Date(current.updated_at) > new Date(existing.updated_at)) {
            console.warn(`🔄 Ersätter duplikat kontrakt ${current.oneflow_contract_id} med senare version`)
            acc[existingIndex] = current
          } else {
            console.warn(`🚫 Hoppar över äldre duplikat av kontrakt ${current.oneflow_contract_id}`)
          }
        }
        
        return acc
      }, [])

      if (uniqueContracts.length !== contractsWithSourceData.length) {
        console.warn(`⚠️ Duplikatkontroll: Reducerade ${contractsWithSourceData.length} till ${uniqueContracts.length} unika kontrakt`)
        
        // Skicka en custom event för att indikera att cache bör rensas
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('contracts-deduplicated', {
            detail: {
              originalCount: contractsWithSourceData.length,
              uniqueCount: uniqueContracts.length,
              removedDuplicates: contractsWithSourceData.length - uniqueContracts.length
            }
          }))
        }
      }

      console.log('✅ Kontrakt hämtade:', uniqueContracts.length)
      return uniqueContracts

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
      console.log('📊 Hämtar utökad kontraktstatistik...')

      // Hämta full kontraktdata med mer detaljer
      let query = supabase
        .from('contracts')
        .select(`
          type, status, total_value, created_at, start_date, contract_length,
          begone_employee_name, begone_employee_email, selected_products
        `)

      // Filtrera bort draft-kontrakt och kontrakt med oanvända mallar
      query = query.neq('status', 'draft')
      const allowedTemplates = Array.from(ALLOWED_TEMPLATE_IDS).concat(['no_template'])
      query = query.in('template_id', allowedTemplates)

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
      
      // Beräkna grundläggande statistik
      const contractsOnly = contracts.filter(c => c.type === 'contract')
      const offersOnly = contracts.filter(c => c.type === 'offer')
      const signedContracts = contracts.filter(c => c.status === 'signed')
      const pendingContracts = contracts.filter(c => c.status === 'pending')
      const activeContracts = contracts.filter(c => c.status === 'active')
      
      const total_contracts = contractsOnly.length
      const total_offers = offersOnly.length
      const signed_contracts = signedContracts.length
      const pending_contracts = pendingContracts.length
      const active_contracts = activeContracts.length
      
      // Finansiella metriker
      const total_value = contracts
        .filter(c => c.total_value)
        .reduce((sum, c) => sum + (c.total_value || 0), 0)
        
      const signed_value = signedContracts
        .filter(c => c.total_value)
        .reduce((sum, c) => sum + (c.total_value || 0), 0)
        
      const pending_value = pendingContracts
        .filter(c => c.total_value)
        .reduce((sum, c) => sum + (c.total_value || 0), 0)
        
      const average_contract_value = contractsOnly.length > 0 
        ? contractsOnly.filter(c => c.total_value).reduce((sum, c) => sum + (c.total_value || 0), 0) / contractsOnly.filter(c => c.total_value).length
        : 0
        
      const average_offer_value = offersOnly.length > 0
        ? offersOnly.filter(c => c.total_value).reduce((sum, c) => sum + (c.total_value || 0), 0) / offersOnly.filter(c => c.total_value).length
        : 0

      // Performance metriker
      const contract_signing_rate = total_contracts > 0 
        ? Math.round((signed_contracts / total_contracts) * 100) 
        : 0

      const offer_conversion_rate = total_offers > 0
        ? Math.round((contracts.filter(c => c.type === 'offer' && c.status === 'signed').length / total_offers) * 100)
        : 0
        
      // Tidsbaserad analys
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
      
      const contracts_this_month = contracts.filter(c => {
        const createdDate = new Date(c.created_at)
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
      }).length
      
      const contracts_last_month = contracts.filter(c => {
        const createdDate = new Date(c.created_at)
        return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear
      }).length
      
      const value_this_month = contracts.filter(c => {
        const createdDate = new Date(c.created_at)
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear && c.total_value
      }).reduce((sum, c) => sum + (c.total_value || 0), 0)
      
      const value_last_month = contracts.filter(c => {
        const createdDate = new Date(c.created_at)
        return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear && c.total_value
      }).reduce((sum, c) => sum + (c.total_value || 0), 0)
      
      const growth_rate = value_last_month > 0 
        ? Math.round(((value_this_month - value_last_month) / value_last_month) * 100)
        : 0
      
      // Medarbetarprestanda (top 5)
      const employeeStats = new Map<string, { name: string, email: string, contract_count: number, total_value: number }>()
      
      contracts.forEach(contract => {
        if (contract.begone_employee_name && contract.begone_employee_email) {
          const key = contract.begone_employee_email
          const existing = employeeStats.get(key)
          
          if (existing) {
            existing.contract_count++
            existing.total_value += contract.total_value || 0
          } else {
            employeeStats.set(key, {
              name: contract.begone_employee_name,
              email: contract.begone_employee_email,
              contract_count: 1,
              total_value: contract.total_value || 0
            })
          }
        }
      })
      
      const top_employees = Array.from(employeeStats.values())
        .map(emp => ({
          ...emp,
          avg_value: emp.contract_count > 0 ? emp.total_value / emp.contract_count : 0
        }))
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 5)
        
      // Produktinsikter (från selected_products JSONB)
      const productStats = new Map<string, { name: string, count: number, total_value: number }>()
      
      contracts.forEach(contract => {
        if (contract.selected_products && Array.isArray(contract.selected_products)) {
          contract.selected_products.forEach((product: any) => {
            if (product.name) {
              const existing = productStats.get(product.name)
              
              if (existing) {
                existing.count++
                existing.total_value += product.total_price || product.price || 0
              } else {
                productStats.set(product.name, {
                  name: product.name,
                  count: 1,
                  total_value: product.total_price || product.price || 0
                })
              }
            }
          })
        }
      })
      
      const popular_products = Array.from(productStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        
      // Pipeline hälsa
      const overdue_count = contracts.filter(c => c.status === 'overdue').length
      
      const contracts_expiring_soon = contracts.filter(c => {
        if (!c.start_date || !c.contract_length) return false
        
        const startDate = new Date(c.start_date)
        const contractLengthMonths = parseInt(c.contract_length) || 12
        const expiryDate = new Date(startDate)
        expiryDate.setMonth(expiryDate.getMonth() + contractLengthMonths)
        
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        
        return expiryDate <= thirtyDaysFromNow && expiryDate > new Date()
      }).length
      
      // Genomsnittlig signeringstid (förenklad beräkning)
      const avg_signing_time_days = 7 // Placeholder - kräver mer data för exakt beräkning

      const stats: ContractStats = {
        // Basic counts
        total_contracts,
        total_offers,
        signed_contracts,
        pending_contracts,
        active_contracts,
        
        // Financial metrics
        total_value,
        signed_value,
        pending_value,
        average_contract_value,
        average_offer_value,
        
        // Performance metrics
        contract_signing_rate,
        offer_conversion_rate,
        
        // Time-based analytics
        contracts_this_month,
        contracts_last_month,
        value_this_month,
        value_last_month,
        growth_rate,
        
        // Employee performance
        top_employees,
        
        // Product insights
        popular_products,
        
        // Pipeline health
        avg_signing_time_days,
        overdue_count,
        contracts_expiring_soon
      }

      console.log('✅ Utökad statistik hämtad:', stats)
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
  // Använd mellanslag som tusental-separator och lägg till "kr" manuellt
  return new Intl.NumberFormat('sv-SE', { 
    useGrouping: true,
    maximumFractionDigits: 0
  }).format(value).replace(/,/g, ' ') + ' kr'
}