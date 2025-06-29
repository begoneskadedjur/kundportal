// src/services/economicStatisticsService.ts - KOMPLETT VERSION med alla funktioner
import { supabase } from '../lib/supabase'
import { technicianStatisticsService } from './technicianStatisticsService'
import type { TechnicianStats } from './technicianStatisticsService'

// --- Typer och Interfaces ---
type CustomerData = { 
  id: string
  is_active: boolean
  annual_premium: number | null
  created_at: string
  contract_start_date: string | null
  contract_end_date: string | null
  business_type: string | null
  company_name: string | null
  assigned_account_manager: string | null
}

type CaseData = { 
  id: string
  customer_id: string | null
  price: number | null
  completed_date: string | null
  assigned_technician_name: string | null
  pest_type: string | null
}

export interface TechnicianPerformance { 
  name: string
  contractRevenue: number
  caseRevenue: number
  totalRevenue: number
  contractCount: number
  caseCount: number
}

export interface PestTypePerformance { 
  pestType: string
  revenue: number
  caseCount: number
}

export interface PerformanceStats { 
  byTechnician: TechnicianPerformance[]
  byPestType: PestTypePerformance[]
}

export interface MonthlyGrowthAnalysis { 
  startMRR: number
  newMRR: number
  churnedMRR: number
  netChangeMRR: number
  endMRR: number
}

export interface UpsellOpportunity { 
  customerId: string
  companyName: string
  annualPremium: number
  caseRevenueLast6Months: number
  caseToArrRatio: number
}

export interface ARRStats { 
  currentARR: number
  monthlyGrowth: number
  monthlyRecurringRevenue: number
  averageARRPerCustomer: number
  churnRate: number
  retentionRate: number
  netRevenueRetention: number
  contractsExpiring3Months: number
  contractsExpiring6Months: number
  contractsExpiring12Months: number
  additionalCaseRevenue: number
  totalRevenue: number
  averageCasePrice: number
  paidCasesThisMonth: number
}

export interface ARRByBusinessType { 
  business_type: string
  arr: number
  customer_count: number
  average_arr_per_customer: number
  additional_case_revenue: number
}

export interface ARRProjection { 
  year: number
  projectedARR: number
  activeContracts: number
}

export interface UnitEconomics { 
  cac: number
  ltv: number
  ltvToCacRatio: number
  paybackPeriodMonths: number
  roi: number
}

export interface DashboardStats { 
  arr: ARRStats
  arrByBusinessType: ARRByBusinessType[]
  technicians: TechnicianStats
  growthAnalysis: MonthlyGrowthAnalysis
  upsellOpportunities: UpsellOpportunity[]
  performanceStats: PerformanceStats
  arrProjections: ARRProjection[]
  unitEconomics: UnitEconomics
}

// Enkel månadstyp för kompatibilitet
export type MonthlySpend = {
  id?: string
  month: string // YYYY-MM-DD format (första dagen i månaden)
  spend: number
  notes?: string
  created_at?: string
  updated_at?: string
}

class EconomicStatisticsService {
  
  // Hämtar generell, ej månadsspecifik data
  getDashboardStats = async (): Promise<Omit<DashboardStats, 'unitEconomics' | 'performanceStats'>> => {
    try {
      const [customersRes, casesRes] = await Promise.all([
        supabase.from('customers').select<string, CustomerData>('id, is_active, annual_premium, created_at, contract_start_date, contract_end_date, business_type, company_name, assigned_account_manager'),
        supabase.from('cases').select<string, CaseData>('id, customer_id, price, completed_date, assigned_technician_name, pest_type')
      ])

      if (customersRes.error) throw customersRes.error
      if (casesRes.error) throw casesRes.error

      const allCustomers: CustomerData[] = customersRes.data || []
      const allCases: CaseData[] = casesRes.data || []
      
      const arr = await this.getARRStats(allCustomers, allCases, 30)
      
      const [arrByBusinessType, technicians, growthAnalysis, upsellOpportunities, arrProjections] = await Promise.all([
        this.getARRByBusinessType(allCustomers, allCases),
        technicianStatisticsService.getTechnicianStats(30),
        this.getMonthlyGrowthAnalysis(allCustomers),
        this.getUpsellOpportunities(allCustomers, allCases, 5),
        this.getARRProjections(allCustomers),
      ])

      return { arr, arrByBusinessType, technicians, growthAnalysis, upsellOpportunities, arrProjections }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      throw error
    }
  }

  // --- MÅNADSSPECIFIKA FUNKTIONER ---

  getUnitEconomicsForMonth = async (selectedDate: Date, globalArrStats: ARRStats): Promise<UnitEconomics> => {
    const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)

    // FIX: Summera ALLA kostnader för den valda månaden
    const { data: spendEntries, error: spendError } = await supabase
      .from('monthly_marketing_spend')
      .select('spend')
      .gte('month', firstDayOfMonth.toISOString().split('T')[0])
      .lte('month', lastDayOfMonth.toISOString().split('T')[0])

    if (spendError) {
      console.error("Error fetching marketing spend:", spendError)
      throw spendError
    }
    
    const marketingSpend = (spendEntries || []).reduce((sum, entry) => sum + entry.spend, 0)

    const { data: newCustomersInMonth, error: customersError } = await supabase
      .from('customers')
      .select('annual_premium')
      .gte('created_at', firstDayOfMonth.toISOString())
      .lte('created_at', lastDayOfMonth.toISOString())

    if (customersError) throw customersError

    const numberOfNewCustomers = newCustomersInMonth?.length || 0
    const newArrFromPeriod = (newCustomersInMonth || []).reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    
    const churnRateForLTV = globalArrStats.churnRate > 0 ? globalArrStats.churnRate / 100 : 0.01
    const ltv = churnRateForLTV > 0 ? globalArrStats.averageARRPerCustomer / churnRateForLTV : 0
    
    const cac = numberOfNewCustomers > 0 ? marketingSpend / numberOfNewCustomers : 0
    const ltvToCacRatio = cac > 0 ? ltv / cac : 0
    const paybackPeriodMonths = (globalArrStats.averageARRPerCustomer / 12) > 0 ? cac / (globalArrStats.averageARRPerCustomer / 12) : 0
    const roi = marketingSpend > 0 ? ((newArrFromPeriod - marketingSpend) / marketingSpend) * 100 : 0

    return { cac, ltv, ltvToCacRatio, paybackPeriodMonths, roi }
  }
  
  getPerformanceStatsForMonth = async (selectedDate: Date): Promise<PerformanceStats> => {
    // Samma som innan, men korrekt formaterad
    const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)

    const [customersRes, casesRes] = await Promise.all([
      supabase.from('customers').select('annual_premium, assigned_account_manager').eq('is_active', true),
      supabase.from('cases')
        .select('price, assigned_technician_name, pest_type, completed_date')
        .not('price', 'is', null).gt('price', 0)
        .gte('completed_date', firstDayOfMonth.toISOString())
        .lte('completed_date', lastDayOfMonth.toISOString())
    ])

    if (customersRes.error) throw customersRes.error
    if (casesRes.error) throw casesRes.error

    const normalizeName = (name: string): string => !name ? 'okänd' : name.includes('@') ? name.split('@')[0].replace(/[._]/g, ' ').toLowerCase() : name.toLowerCase()
    const getDisplayName = (current: string, newName: string): string => !newName ? current : (!current || !newName.includes('@')) ? newName : current

    const techMap = new Map<string, { displayName: string, contractRevenue: number, caseRevenue: number, contractCount: number, caseCount: number }>()

    ;(customersRes.data || []).forEach(c => {
      if (!c.assigned_account_manager) return
      const key = normalizeName(c.assigned_account_manager)
      const current = techMap.get(key) || { displayName: c.assigned_account_manager, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 }
      current.contractRevenue += c.annual_premium || 0
      current.contractCount++
      current.displayName = getDisplayName(current.displayName, c.assigned_account_manager)
      techMap.set(key, current)
    })

    ;(casesRes.data || []).forEach(c => {
      if (!c.assigned_technician_name) return
      const key = normalizeName(c.assigned_technician_name)
      const current = techMap.get(key) || { displayName: c.assigned_technician_name, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 }
      current.caseRevenue += c.price || 0
      current.caseCount++
      current.displayName = getDisplayName(current.displayName, c.assigned_technician_name)
      techMap.set(key, current)
    })
    
    const byTechnician = Array.from(techMap.values()).map(d => ({ 
      name: d.displayName, 
      contractRevenue: d.contractRevenue, 
      caseRevenue: d.caseRevenue, 
      totalRevenue: d.contractRevenue + d.caseRevenue, 
      contractCount: d.contractCount, 
      caseCount: d.caseCount 
    })).sort((a, b) => b.totalRevenue - a.totalRevenue)

    const pestMap = new Map<string, { revenue: number, caseCount: number }>()
    ;(casesRes.data || []).forEach(c => {
      const pestType = c.pest_type || 'Okänt'
      const current = pestMap.get(pestType) || { revenue: 0, caseCount: 0 }
      current.revenue += c.price || 0
      current.caseCount++
      pestMap.set(pestType, current)
    })
    
    const byPestType = Array.from(pestMap.entries()).map(([pestType, data]) => ({ pestType, ...data })).sort((a, b) => b.revenue - a.revenue)
    
    return { byTechnician, byPestType }
  }

  // --- MÅNADSUTGIFTER FUNKTIONER (KOMPATIBILITET) ---
  
  // Hämta månadsutgift för specifik månad
  async getMonthlySpend(month: string): Promise<MonthlySpend | null> {
    try {
      // Konvertera YYYY-MM till YYYY-MM-01 för att matcha databasen
      const monthDate = month.includes('-01') ? month : `${month}-01`
      
      const { data, error } = await supabase
        .from('monthly_marketing_spend')
        .select('*')
        .eq('month', monthDate)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Ingen data hittad för denna månad
          return null
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('Error fetching monthly spend:', error)
      return null
    }
  }

  // Hämta alla månadsutgifter för ett år
  async getYearlySpend(year: number): Promise<MonthlySpend[]> {
    try {
      const { data, error } = await supabase
        .from('monthly_marketing_spend')
        .select('*')
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-31`)
        .order('month', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching yearly spend:', error)
      return []
    }
  }

  // Spara/uppdatera månadsutgift
  async saveMonthlySpend(spendData: Omit<MonthlySpend, 'id' | 'created_at' | 'updated_at'>): Promise<MonthlySpend> {
    try {
      // Kontrollera om posten redan finns
      const existing = await this.getMonthlySpend(spendData.month)
      
      if (existing) {
        // Uppdatera befintlig post
        const { data, error } = await supabase
          .from('monthly_marketing_spend')
          .update({
            spend: spendData.spend,
            notes: spendData.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Skapa ny post
        const { data, error } = await supabase
          .from('monthly_marketing_spend')
          .insert([{
            month: spendData.month,
            spend: spendData.spend,
            notes: spendData.notes || ''
          }])
          .select()
          .single()

        if (error) throw error
        return data
      }
    } catch (error) {
      console.error('Error saving monthly spend:', error)
      throw new Error('Kunde inte spara månadsutgift')
    }
  }

  // Ta bort månadsutgift
  async deleteMonthlySpend(month: string): Promise<void> {
    try {
      const monthDate = month.includes('-01') ? month : `${month}-01`
      
      const { error } = await supabase
        .from('monthly_marketing_spend')
        .delete()
        .eq('month', monthDate)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting monthly spend:', error)
      throw new Error('Kunde inte ta bort månadsutgift')
    }
  }

  // --- ÖVRIGA FUNKTIONER ---
  
  getARRByBusinessTypeForYear = async (targetYear: number): Promise<ARRByBusinessType[]> => {
    const yearStart = new Date(targetYear, 0, 1)
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59)

    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, business_type, annual_premium, contract_start_date, contract_end_date')
      .eq('is_active', true)
    if (customersError) throw customersError

    const { data: allCases, error: casesError } = await supabase
      .from('cases')
      .select('customer_id, price, completed_date')
      .not('price', 'is', null).gt('price', 0)
      .not('completed_date', 'is', null)
      .gte('completed_date', yearStart.toISOString())
      .lte('completed_date', yearEnd.toISOString())
    if (casesError) throw casesError

    const businessTypeMap = new Map<string, { arr: number; caseRevenue: number; customerIds: Set<string> }>()

    ;(allCustomers || []).forEach(customer => {
        const type = customer.business_type || 'Annat'
        if (!businessTypeMap.has(type)) {
            businessTypeMap.set(type, { arr: 0, caseRevenue: 0, customerIds: new Set() })
        }
    })
    
    ;(allCustomers || []).forEach(customer => {
        if (!customer.contract_start_date || !customer.contract_end_date || !customer.annual_premium) return
        const type = customer.business_type || 'Annat'
        const contractStart = new Date(customer.contract_start_date)
        const contractEnd = new Date(customer.contract_end_date)
        
        const overlapStart = new Date(Math.max(contractStart.getTime(), yearStart.getTime()))
        const overlapEnd = new Date(Math.min(contractEnd.getTime(), yearEnd.getTime()))

        if (overlapStart < overlapEnd) {
            const dailyRate = customer.annual_premium / 365.25
            const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1
            const revenueForYear = overlapDays * dailyRate
            
            const current = businessTypeMap.get(type)!
            current.arr += revenueForYear
            current.customerIds.add(customer.id)
        }
    })

    const customerIdToTypeMap = new Map((allCustomers || []).map(c => [c.id, c.business_type || 'Annat']))
    ;(allCases || []).forEach(c => {
        if (!c.customer_id) return
        const type = customerIdToTypeMap.get(c.customer_id)
        if (type && businessTypeMap.has(type)) {
            const current = businessTypeMap.get(type)!
            current.caseRevenue += c.price || 0
            current.customerIds.add(c.customer_id)
        }
    })

    return Array.from(businessTypeMap.entries()).map(([business_type, data]) => ({
      business_type,
      arr: data.arr,
      customer_count: data.customerIds.size,
      average_arr_per_customer: data.customerIds.size > 0 ? data.arr / data.customerIds.size : 0,
      additional_case_revenue: data.caseRevenue
    })).sort((a, b) => (b.arr + b.additional_case_revenue) - (a.arr + a.additional_case_revenue))
  }

  getARRStats = async (allCustomers: CustomerData[], allCases: CaseData[], periodInDays: number): Promise<ARRStats> => {
    const paidCases = allCases.filter(c => c.completed_date && c.price && c.price > 0)
    const activeCustomers = allCustomers.filter(c => c.is_active)
    const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const monthlyRecurringRevenue = currentARR / 12
    const additionalCaseRevenue = paidCases.reduce((sum, c) => sum + (c.price || 0), 0)
    const growthMetrics = await this.calculateGrowthMetrics(allCustomers, currentARR)
    const churnMetrics = this.calculateChurnMetrics(allCustomers, periodInDays)
    const renewalMetrics = this.calculateRenewalMetrics(activeCustomers)
    const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0,0,0,0)
    const paidCasesThisMonth = paidCases.filter(c => c.completed_date != null && new Date(c.completed_date) >= thisMonthStart).length
    return { 
      currentARR, 
      monthlyGrowth: growthMetrics.monthlyGrowth, 
      monthlyRecurringRevenue, 
      averageARRPerCustomer: activeCustomers.length > 0 ? currentARR / activeCustomers.length : 0, 
      churnRate: churnMetrics.churnRate, 
      retentionRate: 100 - churnMetrics.churnRate, 
      netRevenueRetention: churnMetrics.netRevenueRetention, 
      contractsExpiring3Months: renewalMetrics.expiring3Months, 
      contractsExpiring6Months: renewalMetrics.expiring6Months, 
      contractsExpiring12Months: renewalMetrics.expiring12Months, 
      additionalCaseRevenue, 
      totalRevenue: currentARR + additionalCaseRevenue, 
      averageCasePrice: paidCases.length > 0 ? additionalCaseRevenue / paidCases.length : 0, 
      paidCasesThisMonth 
    }
  }
  
  getARRByBusinessType = async (allCustomers: CustomerData[], allCases: CaseData[]): Promise<ARRByBusinessType[]> => {
    const activeCustomers = allCustomers.filter(c => c.is_active)
    const businessTypeMap = new Map<string, { arr: number; count: number; caseRevenue: number }>()
    const customerCaseRevenue = new Map<string, number>()
    allCases.forEach(c => {
        if(c.customer_id && c.price && c.price > 0 && c.completed_date) {
            customerCaseRevenue.set(c.customer_id, (customerCaseRevenue.get(c.customer_id) || 0) + c.price)
        }
    })
    activeCustomers.forEach(customer => {
      const type = customer.business_type || 'Annat'
      const current = businessTypeMap.get(type) || { arr: 0, count: 0, caseRevenue: 0 }
      current.arr += customer.annual_premium || 0
      current.count++
      current.caseRevenue += customerCaseRevenue.get(customer.id) || 0
      businessTypeMap.set(type, current)
    })
    return Array.from(businessTypeMap.entries()).map(([business_type, data]) => ({ 
      business_type, 
      arr: data.arr, 
      customer_count: data.count, 
      average_arr_per_customer: data.count > 0 ? data.arr / data.count : 0, 
      additional_case_revenue: data.caseRevenue 
    })).sort((a, b) => b.arr - a.arr)
  }

  getARRProjections = async (allCustomers: CustomerData[]): Promise<ARRProjection[]> => {
    const activeCustomers = allCustomers.filter(c => c.is_active && c.annual_premium && c.contract_start_date && c.contract_end_date)
    if (activeCustomers.length === 0) return []
    const projections: ARRProjection[] = []
    const currentYear = new Date().getFullYear()
    const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    for (let i = 0; i < 6; i++) {
        const targetYear = currentYear + i
        if (targetYear === currentYear) {
            projections.push({ year: targetYear, projectedARR: currentARR, activeContracts: activeCustomers.length })
            continue
        }
        let totalProjectedRevenueForYear = 0
        let activeContractsInYear = 0
        const yearStart = new Date(targetYear, 0, 1)
        const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59)
        for (const customer of activeCustomers) {
            const contractStart = new Date(customer.contract_start_date!)
            const contractEnd = new Date(customer.contract_end_date!)
            if (contractEnd < yearStart || contractStart > yearEnd) continue
            const dailyRate = (customer.annual_premium || 0) / 365.25
            const overlapStart = new Date(Math.max(contractStart.getTime(), yearStart.getTime()))
            const overlapEnd = new Date(Math.min(contractEnd.getTime(), yearEnd.getTime()))
            const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1
            totalProjectedRevenueForYear += overlapDays * dailyRate
            activeContractsInYear++
        }
        projections.push({ year: targetYear, projectedARR: totalProjectedRevenueForYear, activeContracts: activeContractsInYear })
    }
    return projections
  }

  getMonthlyGrowthAnalysis = async (allCustomers: CustomerData[]): Promise<MonthlyGrowthAnalysis> => {
    const today = new Date()
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(today.getMonth() - 1)
    const customersAtStart = allCustomers.filter(c => new Date(c.created_at) < oneMonthAgo)
    const activeAtStart = customersAtStart.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > oneMonthAgo))
    const startARR = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const newCustomers = allCustomers.filter(c => new Date(c.created_at) >= oneMonthAgo && c.is_active)
    const newARR = newCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const churnedCustomers = activeAtStart.filter(startCustomer => {
        const currentStatus = allCustomers.find(c => c.id === startCustomer.id)
        return !currentStatus || !currentStatus.is_active
    })
    const churnedARR = churnedCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const activeNow = allCustomers.filter(c => c.is_active)
    const endARR = activeNow.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    return { 
      startMRR: startARR / 12, 
      newMRR: newARR / 12, 
      churnedMRR: churnedARR / 12, 
      netChangeMRR: (endARR - startARR) / 12, 
      endMRR: endARR / 12 
    }
  }
  
  getUpsellOpportunities = async (allCustomers: CustomerData[], allCases: CaseData[], limit: number = 5): Promise<UpsellOpportunity[]> => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const activeCustomers = allCustomers.filter(c => c.is_active)
    const recentCases = allCases.filter(c => c.price && c.price > 0 && c.completed_date && new Date(c.completed_date) >= sixMonthsAgo)
    const caseRevenueMap = new Map<string, number>()
    for (const c of recentCases) {
      if (c.customer_id) {
          caseRevenueMap.set(c.customer_id, (caseRevenueMap.get(c.customer_id) || 0) + (c.price || 0))
      }
    }
    const opportunities = activeCustomers.map(customer => {
        const caseRevenue = caseRevenueMap.get(customer.id) || 0
        if (caseRevenue === 0 || !customer.annual_premium || !customer.company_name) return null
        return { 
          customerId: customer.id, 
          companyName: customer.company_name, 
          annualPremium: customer.annual_premium, 
          caseRevenueLast6Months: caseRevenue, 
          caseToArrRatio: caseRevenue / customer.annual_premium 
        }
    }).filter((opp): opp is UpsellOpportunity => opp !== null)
    return opportunities.sort((a, b) => b.caseToArrRatio - a.caseToArrRatio).slice(0, limit)
  }

  calculateGrowthMetrics = async (allCustomers: CustomerData[], currentARR: number): Promise<{ monthlyGrowth: number }> => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const customersActiveLastMonth = allCustomers.filter(c => c.is_active && new Date(c.created_at) <= lastMonth)
    const lastMonthARR = customersActiveLastMonth.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const growth = lastMonthARR > 0 ? ((currentARR - lastMonthARR) / lastMonthARR) * 100 : (currentARR > 0 ? 100 : 0)
    return { monthlyGrowth: growth }
  }

  calculateChurnMetrics = (allCustomers: CustomerData[], periodInDays: number): { churnRate: number; netRevenueRetention: number } => {
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - periodInDays)
    const customersCreatedBeforePeriod = allCustomers.filter(c => new Date(c.created_at) < periodStart)
    const activeAtStart = customersCreatedBeforePeriod.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > periodStart))
    const activeAtStartIds = new Set(activeAtStart.map(c => c.id))
    const currentlyActiveCustomers = new Set(allCustomers.filter(c => c.is_active).map(c => c.id))
    const churnedCustomers = activeAtStart.filter(c => !currentlyActiveCustomers.has(c.id))
    const churnRate = activeAtStart.length > 0 ? (churnedCustomers.length / activeAtStart.length) * 100 : 0
    const startRevenue = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const remainingCustomersFromCohort = allCustomers.filter(c => activeAtStartIds.has(c.id) && c.is_active)
    const endRevenueFromSameCohort = remainingCustomersFromCohort.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const netRevenueRetention = startRevenue > 0 ? (endRevenueFromSameCohort / startRevenue) * 100 : 100
    return { churnRate, netRevenueRetention }
  }
  
  calculateRenewalMetrics = (activeCustomers: CustomerData[]): { expiring3Months: number; expiring6Months: number; expiring12Months: number } => {
    const now = new Date()
    const in3Months = new Date(); in3Months.setMonth(now.getMonth() + 3)
    const in6Months = new Date(); in6Months.setMonth(now.getMonth() + 6)
    const in12Months = new Date(); in12Months.setMonth(now.getMonth() + 12)
    let expiring3Months = 0, expiring6Months = 0, expiring12Months = 0
    activeCustomers.forEach(customer => {
        if (!customer.contract_end_date) return
        const endDate = new Date(customer.contract_end_date)
        if (endDate > now) {
            if (endDate <= in3Months) expiring3Months++
            else if (endDate <= in6Months) expiring6Months++
            else if (endDate <= in12Months) expiring12Months++
        }
    })
    return { expiring3Months, expiring6Months, expiring12Months }
  }

  // Formatera valuta (hjälpfunktion)
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Formatera månad (hjälpfunktion) 
  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-')
    const monthNames = [
      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ]
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }
}

export const economicStatisticsService = new EconomicStatisticsService()