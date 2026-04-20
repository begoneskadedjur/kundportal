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
    contact_email?: string
    price_list_id?: string | null
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
  declined_contracts: number
  
  // Financial metrics
  total_value: number
  signed_value: number
  pending_value: number
  declined_value: number
  average_contract_value: number
  average_offer_value: number
  
  // Performance metrics
  contract_signing_rate: number // Procent av kontrakt som signerats
  offer_conversion_rate: number  // Procent av offerter som blivit kontrakt
  overall_conversion_rate: number // Total konverteringsgrad (signed / (total - declined))
  
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

  // Article insights (from price lists)
  popular_articles?: Array<{
    name: string
    code: string
    unit: string
    count: number
    avg_price: number
  }>

  // Pipeline health
  avg_signing_time_days: number
  overdue_count: number
  contracts_expiring_soon: number // Inom 30 dagar

  // Ekonomisk/strategisk analys (driven av case_billing_items)
  arr_total: number
  mrr_total: number
  arr_delta_30d: number // Absolut skillnad vs för 30 dagar sen
  forecast_30d: number
  forecast_60d: number
  forecast_90d: number
  avg_margin_pct: number | null
  margin_distribution: {
    high: { count: number; value: number }
    mid: { count: number; value: number }
    low: { count: number; value: number }
    unknown: { count: number }
  }
  top_services_actual: Array<{
    name: string
    count: number
    total_arr: number
  }>
  top_internal_articles: Array<{
    name: string
    total_quantity: number
    total_cost: number
  }>
  seller_performance: Array<{
    email: string
    name: string
    contract_count: number
    arr_contribution: number
    avg_deal_value: number
    conversion_rate: number
    avg_margin_pct: number | null
  }>
  top_profitable_deals: Array<{
    contract_id: string
    company_name: string
    margin_pct: number
    margin_value: number
    external_total: number
  }>
}

// Aggregat per kontrakt från case_billing_items (tjänster + interna artiklar)
export interface ContractBillingAggregate {
  contractId: string
  services: Array<{
    id: string
    name: string
    quantity: number
    total_price: number
  }>
  articles: Array<{
    name: string
    quantity: number
    total_price: number
    mapped_service_id: string | null
  }>
  external_total: number
  internal_cost: number
  margin_pct: number | null
}

// Service-klass för contract-hantering
export class ContractService {

  // Hämta aggregerade billing-items per kontrakt (tjänster + artiklar från wizarden)
  static async getContractBillingAggregate(
    contractIds: string[]
  ): Promise<Map<string, ContractBillingAggregate>> {
    const result = new Map<string, ContractBillingAggregate>()
    if (!contractIds.length) return result

    const { data, error } = await supabase
      .from('case_billing_items')
      .select(
        'id, case_id, item_type, service_name, article_name, quantity, unit_price, total_price, mapped_service_id'
      )
      .in('case_id', contractIds)
      .eq('case_type', 'contract')

    if (error) {
      console.warn('getContractBillingAggregate fel:', error)
      return result
    }

    const rowsByContract = new Map<string, typeof data>()
    ;(data || []).forEach(row => {
      if (!rowsByContract.has(row.case_id)) rowsByContract.set(row.case_id, [])
      rowsByContract.get(row.case_id)!.push(row)
    })

    rowsByContract.forEach((rows, contractId) => {
      const services = rows
        .filter(r => r.item_type === 'service')
        .map(r => ({
          id: r.id,
          name: r.service_name || 'Okänd tjänst',
          quantity: Number(r.quantity) || 0,
          total_price: Number(r.total_price) || 0,
        }))
      const articles = rows
        .filter(r => r.item_type === 'article')
        .map(r => ({
          name: r.article_name || 'Okänd artikel',
          quantity: Number(r.quantity) || 0,
          total_price: Number(r.total_price) || 0,
          mapped_service_id: r.mapped_service_id || null,
        }))
      const external_total = services.reduce((s, x) => s + x.total_price, 0)
      const internal_cost = articles.reduce((s, x) => s + x.total_price, 0)
      const margin_pct =
        articles.length > 0 && external_total > 0
          ? Math.round(((external_total - internal_cost) / external_total) * 100)
          : null

      result.set(contractId, {
        contractId,
        services,
        articles,
        external_total,
        internal_cost,
        margin_pct,
      })
    })

    return result
  }

  
  // Hämta alla kontrakt med filter och sökning
  static async getContracts(filters: ContractFilters = {}): Promise<ContractWithSourceData[]> {
    try {
      console.log('🔍 Hämtar kontrakt med filter:', filters)
      
      let query = supabase
        .from('contracts')
        .select(`
          *,
          customers!contracts_customer_id_fkey (
            id, company_name, contact_person, contact_email, products, price_list_id
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



      // Mappa kontrakt till ContractWithSourceData (source_case_data ej använd i UI)
      const contractsWithSourceData = (data || []).map(contract => ({
        ...contract,
        source_case_data: undefined,
        customer_data: contract.customers || undefined,
      } as ContractWithSourceData))

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
          customers!contracts_customer_id_fkey (
            id, company_name, contact_person, contact_email, contact_phone, contact_address, organization_number
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
          id, type, status, total_value, created_at, start_date, contract_length,
          begone_employee_name, begone_employee_email, selected_products,
          company_name, contact_person
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
      const declinedContracts = contracts.filter(c => c.status === 'declined')
      
      const total_contracts = contractsOnly.length
      const total_offers = offersOnly.length
      const signed_contracts = signedContracts.length
      const pending_contracts = pendingContracts.length
      const active_contracts = activeContracts.length
      const declined_contracts = declinedContracts.length
      
      // Finansiella metriker - korrekt beräkning av totala kontraktsvärden
      const total_value = contracts
        .filter(c => c.total_value)
        .reduce((sum, c) => {
          // För avtal: multiplicera årsvärdet med antal år
          if (c.type === 'contract' && c.contract_length) {
            const years = parseInt(c.contract_length)
            return sum + ((c.total_value || 0) * years)
          }
          // För offerter: använd värdet direkt
          return sum + (c.total_value || 0)
        }, 0)
        
      const signed_value = signedContracts
        .filter(c => c.total_value)
        .reduce((sum, c) => {
          if (c.type === 'contract' && c.contract_length) {
            const years = parseInt(c.contract_length)
            return sum + ((c.total_value || 0) * years)
          }
          return sum + (c.total_value || 0)
        }, 0)
        
      const pending_value = pendingContracts
        .filter(c => c.total_value)
        .reduce((sum, c) => {
          if (c.type === 'contract' && c.contract_length) {
            const years = parseInt(c.contract_length)
            return sum + ((c.total_value || 0) * years)
          }
          return sum + (c.total_value || 0)
        }, 0)
        
      const declined_value = declinedContracts
        .filter(c => c.total_value)
        .reduce((sum, c) => {
          if (c.type === 'contract' && c.contract_length) {
            const years = parseInt(c.contract_length)
            return sum + ((c.total_value || 0) * years)
          }
          return sum + (c.total_value || 0)
        }, 0)
        
      const average_contract_value = contractsOnly.length > 0 
        ? contractsOnly.filter(c => c.total_value).reduce((sum, c) => sum + (c.total_value || 0), 0) / contractsOnly.filter(c => c.total_value).length
        : 0
        
      const average_offer_value = offersOnly.length > 0
        ? offersOnly.filter(c => c.total_value).reduce((sum, c) => sum + (c.total_value || 0), 0) / offersOnly.filter(c => c.total_value).length
        : 0

      // Performance metriker - korrigerade beräkningar
      const contract_signing_rate = total_contracts > 0 
        ? Math.round((signed_contracts / total_contracts) * 100) 
        : 0

      const offer_conversion_rate = total_offers > 0
        ? Math.round((contracts.filter(c => c.type === 'offer' && c.status === 'signed').length / total_offers) * 100)
        : 0
        
      // Ny overall conversion rate: signerade kontrakt och offerter / (totalt - avvisade)
      const total_deals = total_contracts + total_offers
      const total_signed = signedContracts.length
      const eligible_deals = total_deals - declined_contracts // Uteslut avvisade från nämnaren
      const overall_conversion_rate = eligible_deals > 0 
        ? Math.round((total_signed / eligible_deals) * 100)
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
      }).reduce((sum, c) => {
        if (c.type === 'contract' && c.contract_length) {
          const years = parseInt(c.contract_length) / 12
          return sum + ((c.total_value || 0) * years)
        }
        return sum + (c.total_value || 0)
      }, 0)
      
      const value_last_month = contracts.filter(c => {
        const createdDate = new Date(c.created_at)
        return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear && c.total_value
      }).reduce((sum, c) => {
        if (c.type === 'contract' && c.contract_length) {
          const years = parseInt(c.contract_length) / 12
          return sum + ((c.total_value || 0) * years)
        }
        return sum + (c.total_value || 0)
      }, 0)
      
      const growth_rate = value_last_month > 0 
        ? Math.round(((value_this_month - value_last_month) / value_last_month) * 100)
        : 0
      
      // Medarbetarprestanda (top 5)
      const employeeStats = new Map<string, { name: string, email: string, contract_count: number, total_value: number }>()
      
      contracts.forEach(contract => {
        if (contract.begone_employee_name && contract.begone_employee_email) {
          const key = contract.begone_employee_email
          const existing = employeeStats.get(key)
          
          // Beräkna korrekt totalvärde baserat på typ
          let contractValue = contract.total_value || 0
          if (contract.type === 'contract' && contract.contract_length) {
            const years = parseInt(contract.contract_length)
            contractValue = contractValue * years
          }
          
          if (existing) {
            existing.contract_count++
            existing.total_value += contractValue
          } else {
            employeeStats.set(key, {
              name: contract.begone_employee_name,
              email: contract.begone_employee_email,
              contract_count: 1,
              total_value: contractValue
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
        
      // Produktinsikter (från selected_products JSONB med korrekt parsing)
      const productStats = new Map<string, { name: string, count: number, total_value: number }>()
      
      contracts.forEach(contract => {
        try {
          let parsedProducts: any[] = []
          
          // Parse selected_products med samma logik som parseContractProducts i frontend
          if (contract.selected_products) {
            const data = typeof contract.selected_products === 'string' 
              ? JSON.parse(contract.selected_products) 
              : contract.selected_products
            
            // OneFlow struktur: array av produktgrupper
            if (Array.isArray(data)) {
              data.forEach((group: any) => {
                // Varje grupp har en products array
                if (group.products && Array.isArray(group.products)) {
                  group.products.forEach((product: any) => {
                    parsedProducts.push({
                      name: product.name || 'Okänd produkt',
                      quantity: product.quantity?.amount || product.quantity || 1,
                      price: product.total_price || product.price || 0
                    })
                  })
                }
                // Fallback om produkter ligger direkt i arrayen (gammal struktur)
                else if (group.name) {
                  parsedProducts.push({
                    name: group.name || group.product_name || 'Okänd produkt',
                    quantity: group.quantity?.amount || group.quantity || 1,
                    price: group.total_price || group.price || 0
                  })
                }
              })
            }
          }
          
          // Aggregera produkter
          parsedProducts.forEach((product: any) => {
            if (product.name) {
              const existing = productStats.get(product.name)
              
              if (existing) {
                existing.count += product.quantity || 1
                existing.total_value += product.price || 0
              } else {
                productStats.set(product.name, {
                  name: product.name,
                  count: product.quantity || 1,
                  total_value: product.price || 0
                })
              }
            }
          })
          
        } catch (error) {
          console.warn('Fel vid parsing av produkter för kontrakt:', contract.id, error)
        }
      })
      
      const popular_products = Array.from(productStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Artikelinsikter (från prislistor via kunder)
      let popular_articles: Array<{ name: string, code: string, unit: string, count: number, avg_price: number }> = []
      try {
        // Hämta alla kunder med price_list_id
        const { data: customersWithPriceLists } = await supabase
          .from('customers')
          .select('id, price_list_id')
          .not('price_list_id', 'is', null)

        if (customersWithPriceLists && customersWithPriceLists.length > 0) {
          const uniquePriceListIds = [...new Set(customersWithPriceLists.map(c => c.price_list_id).filter(Boolean))]

          // Hämta alla prislisteposter med artikeldata
          const { data: allItems } = await supabase
            .from('price_list_items')
            .select('price_list_id, custom_price, article:articles(name, code, unit)')
            .in('price_list_id', uniquePriceListIds)

          if (allItems && allItems.length > 0) {
            // Räkna hur många prislistor varje artikel förekommer i
            const articleStats = new Map<string, { name: string, code: string, unit: string, count: number, totalPrice: number }>()

            allItems.forEach((item: any) => {
              if (item.article) {
                const key = item.article.code || item.article.name
                const existing = articleStats.get(key)
                if (existing) {
                  existing.count++
                  existing.totalPrice += item.custom_price || 0
                } else {
                  articleStats.set(key, {
                    name: item.article.name,
                    code: item.article.code || '',
                    unit: item.article.unit || 'st',
                    count: 1,
                    totalPrice: item.custom_price || 0
                  })
                }
              }
            })

            popular_articles = Array.from(articleStats.values())
              .map(a => ({
                name: a.name,
                code: a.code,
                unit: a.unit,
                count: a.count,
                avg_price: a.count > 0 ? Math.round(a.totalPrice / a.count) : 0
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
          }
        }
      } catch (articleError) {
        console.warn('Kunde inte hämta artikelstatistik:', articleError)
      }

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

      // ========== Ekonomisk/strategisk analys (case_billing_items) ==========
      const contractIds = contracts
        .filter((c: any) => c.id && (c.status === 'signed' || c.status === 'active'))
        .map((c: any) => c.id as string)

      let billingAgg = new Map<string, ContractBillingAggregate>()
      try {
        billingAgg = await ContractService.getContractBillingAggregate(contractIds)
      } catch (e) {
        console.warn('getContractBillingAggregate misslyckades:', e)
      }

      // ARR: årligt återkommande intäkter från aktiva/signerade avtal (type='contract')
      const activeContractRows = contracts.filter(
        (c: any) => c.type === 'contract' && (c.status === 'signed' || c.status === 'active')
      )
      const arr_total = activeContractRows.reduce((sum: number, c: any) => {
        return sum + (Number(c.total_value) || 0)
      }, 0)
      const mrr_total = arr_total / 12

      // ARR-delta (diff vs 30 dagar sen): approximation = ARR för kontrakt skapade <30d sen
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const arr_delta_30d = activeContractRows
        .filter((c: any) => new Date(c.created_at) >= thirtyDaysAgo)
        .reduce((sum: number, c: any) => sum + (Number(c.total_value) || 0), 0)

      // Forecast: förväntat värde från pending deals viktat med global konverteringsgrad
      const conversionWeight = (overall_conversion_rate || 0) / 100
      const pendingForForecast = contracts.filter((c: any) => c.status === 'pending')
      const forecastForWindow = (days: number) => {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        return pendingForForecast
          .filter((c: any) => new Date(c.created_at) >= cutoff)
          .reduce((sum: number, c: any) => {
            let val = Number(c.total_value) || 0
            if (c.type === 'contract' && c.contract_length) {
              val = val * parseInt(c.contract_length)
            }
            return sum + val * conversionWeight
          }, 0)
      }
      const forecast_30d = forecastForWindow(30)
      const forecast_60d = forecastForWindow(60)
      const forecast_90d = forecastForWindow(90)

      // Marginalfördelning (över signerade/aktiva kontrakt med aggregerad data)
      let high = { count: 0, value: 0 }
      let mid = { count: 0, value: 0 }
      let low = { count: 0, value: 0 }
      let unknown = { count: 0 }
      const marginList: number[] = []
      const topDealsCandidates: Array<{
        contract_id: string
        company_name: string
        margin_pct: number
        margin_value: number
        external_total: number
      }> = []

      activeContractRows.forEach((c: any) => {
        const agg = billingAgg.get(c.id)
        if (!agg || agg.margin_pct === null) {
          unknown.count++
          return
        }
        const marginVal = agg.external_total - agg.internal_cost
        marginList.push(agg.margin_pct)
        if (agg.margin_pct >= 30) {
          high.count++
          high.value += agg.external_total
        } else if (agg.margin_pct >= 15) {
          mid.count++
          mid.value += agg.external_total
        } else {
          low.count++
          low.value += agg.external_total
        }
        topDealsCandidates.push({
          contract_id: c.id,
          company_name: c.company_name || c.contact_person || 'Okänd',
          margin_pct: agg.margin_pct,
          margin_value: marginVal,
          external_total: agg.external_total,
        })
      })

      const avg_margin_pct =
        marginList.length > 0
          ? Math.round(marginList.reduce((s, v) => s + v, 0) / marginList.length)
          : null

      const margin_distribution = { high, mid, low, unknown }

      const top_profitable_deals = topDealsCandidates
        .sort((a, b) => b.margin_value - a.margin_value)
        .slice(0, 3)

      // Topp 5 tjänster från faktisk data (signerade/aktiva kontrakt)
      const serviceAgg = new Map<string, { name: string; count: number; total_arr: number }>()
      billingAgg.forEach(agg => {
        agg.services.forEach(s => {
          const key = s.name
          const existing = serviceAgg.get(key)
          if (existing) {
            existing.count += s.quantity
            existing.total_arr += s.total_price
          } else {
            serviceAgg.set(key, { name: s.name, count: s.quantity, total_arr: s.total_price })
          }
        })
      })
      const top_services_actual = Array.from(serviceAgg.values())
        .sort((a, b) => b.total_arr - a.total_arr)
        .slice(0, 5)

      // Topp 10 interna artiklar (inköpsanalys)
      const articleAgg = new Map<
        string,
        { name: string; total_quantity: number; total_cost: number }
      >()
      billingAgg.forEach(agg => {
        agg.articles.forEach(a => {
          const key = a.name
          const existing = articleAgg.get(key)
          if (existing) {
            existing.total_quantity += a.quantity
            existing.total_cost += a.total_price
          } else {
            articleAgg.set(key, {
              name: a.name,
              total_quantity: a.quantity,
              total_cost: a.total_price,
            })
          }
        })
      })
      const top_internal_articles = Array.from(articleAgg.values())
        .sort((a, b) => b.total_cost - a.total_cost)
        .slice(0, 10)

      // Säljar-performance (utökad med ARR, konv.-grad, snitt-marginal)
      type SellerRow = {
        email: string
        name: string
        contract_count: number
        arr_contribution: number
        deal_values: number[]
        signed_count: number
        declined_count: number
        margin_values: number[]
      }
      const sellerMap = new Map<string, SellerRow>()
      contracts.forEach((c: any) => {
        if (!c.begone_employee_email || !c.begone_employee_name) return
        const key = c.begone_employee_email
        let row = sellerMap.get(key)
        if (!row) {
          row = {
            email: key,
            name: c.begone_employee_name,
            contract_count: 0,
            arr_contribution: 0,
            deal_values: [],
            signed_count: 0,
            declined_count: 0,
            margin_values: [],
          }
          sellerMap.set(key, row)
        }
        const val = Number(c.total_value) || 0
        row.deal_values.push(val)
        if (c.status === 'signed' || c.status === 'active') {
          row.contract_count++
          row.signed_count++
          if (c.type === 'contract') {
            row.arr_contribution += val
          } else {
            row.arr_contribution += val // offers kan bidra engångsmässigt
          }
          const agg = billingAgg.get(c.id)
          if (agg && agg.margin_pct !== null) row.margin_values.push(agg.margin_pct)
        } else if (c.status === 'declined') {
          row.declined_count++
        }
      })

      const seller_performance = Array.from(sellerMap.values())
        .map(r => ({
          email: r.email,
          name: r.name,
          contract_count: r.contract_count,
          arr_contribution: r.arr_contribution,
          avg_deal_value:
            r.deal_values.length > 0
              ? r.deal_values.reduce((s, v) => s + v, 0) / r.deal_values.length
              : 0,
          conversion_rate:
            r.signed_count + r.declined_count > 0
              ? Math.round((r.signed_count / (r.signed_count + r.declined_count)) * 100)
              : 0,
          avg_margin_pct:
            r.margin_values.length > 0
              ? Math.round(r.margin_values.reduce((s, v) => s + v, 0) / r.margin_values.length)
              : null,
        }))
        .sort((a, b) => b.arr_contribution - a.arr_contribution)
        .slice(0, 5)

      const stats: ContractStats = {
        // Basic counts
        total_contracts,
        total_offers,
        signed_contracts,
        pending_contracts,
        active_contracts,
        declined_contracts,
        
        // Financial metrics
        total_value,
        signed_value,
        pending_value,
        declined_value,
        average_contract_value,
        average_offer_value,
        
        // Performance metrics
        contract_signing_rate,
        offer_conversion_rate,
        overall_conversion_rate,
        
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

        // Article insights
        popular_articles,

        // Pipeline health
        avg_signing_time_days,
        overdue_count,
        contracts_expiring_soon,

        // Ekonomisk/strategisk analys
        arr_total,
        mrr_total,
        arr_delta_30d,
        forecast_30d,
        forecast_60d,
        forecast_90d,
        avg_margin_pct,
        margin_distribution,
        top_services_actual,
        top_internal_articles,
        seller_performance,
        top_profitable_deals,
      }

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

  // Hämta väntande offerter för en kund (från den nya vyn)
  static async getCustomerPendingQuotes(customerId?: string) {
    try {
      console.log('📋 Hämtar kundens väntande offerter...')
      
      let query = supabase
        .from('customer_pending_quotes')
        .select('*')
        
      if (customerId) {
        query = query.eq('customer_id', customerId)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ Fel vid hämtning av väntande offerter:', error)
        throw new Error(`Kunde inte hämta offerter: ${error.message}`)
      }
      
      console.log(`✅ Hämtade ${data?.length || 0} väntande offerter`)
      return data || []
      
    } catch (error) {
      console.error('💥 ContractService.getCustomerPendingQuotes fel:', error)
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