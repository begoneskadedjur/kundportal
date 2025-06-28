// src/services/statisticsService.ts - UPPDATERAD med contract_end_date + verklig intäktsberäkning
import { supabase } from '../lib/supabase'

export interface DashboardStats {
  basic: BasicStats
  arr: ARRStats
  technicians: TechnicianStats
  arrByBusinessType: ARRByBusinessType[]
  trends: TrendData
}

export interface BasicStats {
  totalCustomers: number
  activeCustomers: number
  totalCases: number
  upcomingVisits: number
  newCustomersThisMonth: number
  newCasesThisMonth: number
}

// UPPDATERAD med nya intäktsfält
export interface ARRStats {
  currentARR: number
  monthlyGrowth: number
  yearOverYearGrowth: number
  upcomingRenewals: number
  pipelineARR: number
  averageARRPerCustomer: number
  contractsExpiring3Months: number
  contractsExpiring6Months: number
  contractsExpiring12Months: number
  totalContractValue: number
  monthlyRecurringRevenue: number
  churnRate: number
  retentionRate: number
  averageContractLength: number
  netRevenueRetention: number
  // 🆕 NYA INTÄKTSFÄLT
  additionalCaseRevenue: number        // Extra intäkter från cases med price
  totalRevenue: number                 // ARR + case revenue
  averageCasePrice: number             // Genomsnittligt case-pris
  paidCasesThisMonth: number          // Antal betalda cases denna månad
  projectedRevenueThisYear: number    // Projicerad intäkt baserat på avtal
  projectedRevenueNextYear: number    // Projicerad intäkt nästa år
}

export interface TechnicianStats {
  activeTechnicians: number
  totalTechnicians: number
  activeCases: number
  averageCasesPerTechnician: number
  capacityUtilization: number
  urgentCases: number
  completedCasesThisMonth: number
  completedCasesLastMonth: number
  averageResolutionTime: number
  firstVisitSuccessRate: number
  overdueCases: number
  technicianWorkload: TechnicianWorkload[]
  casesByPriority: CasesByPriority
  monthlyTrend: number
}

export interface ARRByBusinessType {
  business_type: string
  arr: number
  customer_count: number
  average_arr_per_customer: number
  growth_rate: number
  additional_case_revenue: number  // 🆕 Extra intäkter från cases
}

export interface TechnicianWorkload {
  technician_id: string
  technician_name: string
  active_cases: number
  completed_this_month: number
  utilization_rate: number
  average_resolution_time: number
}

export interface CasesByPriority {
  urgent: number
  high: number
  normal: number
  low: number
}

export interface TrendData {
  arrTrend: MonthlyData[]
  customerTrend: MonthlyData[]
  caseTrend: MonthlyData[]
  technicianProductivity: MonthlyData[]
}

export interface MonthlyData {
  month: string
  value: number
  change: number
}

class StatisticsService {
  
  /**
   * Hämta komplett dashboard-statistik
   */
  async getDashboardStats(period: number = 30): Promise<DashboardStats> {
    try {
      const [basic, arr, technicians, arrByBusinessType] = await Promise.all([
        this.getBasicStats(period),
        this.getARRStats(period),
        this.getTechnicianStats(period),
        this.getARRByBusinessType()
      ])

      const trends = await this.getTrendData(period)

      return {
        basic,
        arr,
        technicians,
        arrByBusinessType,
        trends
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      throw error
    }
  }

  /**
   * Grundläggande statistik (BEHÅLLS OFÖRÄNDRAD)
   */
  async getBasicStats(period: number): Promise<BasicStats> {
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - period)

    const [customersResult, casesResult, visitsResult] = await Promise.all([
      supabase.from('customers').select('id, is_active, created_at'),
      supabase.from('cases').select('id, scheduled_date, created_at'),
      supabase.from('visits').select('id, visit_date').gte('visit_date', new Date().toISOString())
    ])

    if (customersResult.error) throw customersResult.error
    if (casesResult.error) throw casesResult.error

    const customers = customersResult.data || []
    const cases = casesResult.data || []
    const visits = visitsResult.data || []

    const activeCustomers = customers.filter(c => c.is_active).length
    const upcomingVisits = cases.filter(c => 
      c.scheduled_date && new Date(c.scheduled_date) > new Date()
    ).length

    const newCustomersThisMonth = customers.filter(c => 
      c.created_at && new Date(c.created_at) >= periodStart
    ).length

    const newCasesThisMonth = cases.filter(c => 
      c.created_at && new Date(c.created_at) >= periodStart
    ).length

    return {
      totalCustomers: customers.length,
      activeCustomers,
      totalCases: cases.length,
      upcomingVisits,
      newCustomersThisMonth,
      newCasesThisMonth
    }
  }

  /**
   * ARR och ekonomisk statistik - KRAFTIGT UPPDATERAD med verklig data
   */
  async getARRStats(period: number): Promise<ARRStats> {
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select(`
        id, is_active, annual_premium, total_contract_value,
        contract_start_date, contract_length_months, contract_end_date,
        business_type, created_at
      `)
    
    if (customersError) throw customersError

    // 🆕 Hämta cases med priser för extra intäkter
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('id, price, created_at, completed_date, customer_id')
      .not('price', 'is', null)
      .gt('price', 0)
    
    if (casesError) throw casesError
    
    const activeCustomers = (customers || []).filter(c => c.is_active)
    const allCustomers = customers || []
    const paidCases = cases || []
    
    // Grundläggande ARR-beräkningar med verklig data
    const currentARR = this.calculateCurrentARR(activeCustomers)
    const monthlyRecurringRevenue = currentARR / 12
    const totalContractValue = this.calculateTotalContractValue(activeCustomers)
    const averageARRPerCustomer = activeCustomers.length > 0 ? currentARR / activeCustomers.length : 0
    
    // 🆕 Beräkna extra intäkter från cases
    const additionalCaseRevenue = this.calculateAdditionalCaseRevenue(paidCases)
    const totalRevenue = currentARR + additionalCaseRevenue
    
    // 🆕 Case-statistik
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    
    const paidCasesThisMonth = paidCases.filter(c => 
      c.completed_date && new Date(c.completed_date) >= thisMonthStart
    ).length
    
    const averageCasePrice = paidCases.length > 0 
      ? paidCases.reduce((sum, c) => sum + (c.price || 0), 0) / paidCases.length 
      : 0
    
    // Avtalslängd
    const averageContractLength = this.calculateAverageContractLength(activeCustomers)
    
    // 🆕 FÖRBÄTTRADE förnyelser som använder contract_end_date
    const renewalMetrics = this.calculateRenewalMetrics(activeCustomers)
    
    // 🆕 VERKLIG churn-beräkning
    const churnMetrics = await this.calculateChurnMetrics(allCustomers, period)
    
    // 🆕 VERKLIG tillväxt
    const growthMetrics = await this.calculateGrowthMetrics(period)
    
    // 🆕 VERKLIGA intäktsprognoser baserat på avtal
    const revenueProjections = this.calculateRevenueProjections(activeCustomers)
    
    // Pipeline (dummy för nu)
    const pipelineARR = "DUMMY" // Du kan lägga till detta från CRM senare
    
    return {
      currentARR,
      monthlyGrowth: growthMetrics.monthlyGrowth,
      yearOverYearGrowth: growthMetrics.yearOverYearGrowth,
      upcomingRenewals: renewalMetrics.upcomingRenewalsValue,
      pipelineARR: typeof pipelineARR === 'string' ? 0 : pipelineARR,
      averageARRPerCustomer,
      contractsExpiring3Months: renewalMetrics.expiring3Months,
      contractsExpiring6Months: renewalMetrics.expiring6Months,
      contractsExpiring12Months: renewalMetrics.expiring12Months,
      totalContractValue,
      monthlyRecurringRevenue,
      churnRate: churnMetrics.churnRate,
      retentionRate: churnMetrics.retentionRate,
      averageContractLength,
      netRevenueRetention: churnMetrics.netRevenueRetention,
      // 🆕 NYA FÄLT
      additionalCaseRevenue,
      totalRevenue,
      averageCasePrice,
      paidCasesThisMonth,
      projectedRevenueThisYear: revenueProjections.thisYear,
      projectedRevenueNextYear: revenueProjections.nextYear
    }
  }

  /**
   * Tekniker-statistik (BEHÅLLS SAMMA MEN med verklig data)
   */
  async getTechnicianStats(period: number): Promise<TechnicianStats> {
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - period)
    
    const lastMonthStart = new Date()
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
    lastMonthStart.setDate(1)
    
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)

    const [techniciansResult, casesResult] = await Promise.all([
      supabase.from('technicians').select('*'),
      supabase.from('cases').select(`
        id, status, priority, created_at, completed_date, 
        scheduled_date, assigned_technician_id
      `)
    ])

    if (techniciansResult.error) throw techniciansResult.error
    if (casesResult.error) throw casesResult.error

    const technicians = techniciansResult.data || []
    const cases = casesResult.data || []

    const activeTechnicians = technicians.filter(t => t.is_active).length
    const totalTechnicians = technicians.length

    // Ärendestatistik
    const activeCases = cases.filter(c => 
      c.status === 'in_progress' || c.status === 'pending'
    ).length

    const urgentCases = cases.filter(c => 
      c.priority === 'urgent' && (c.status === 'in_progress' || c.status === 'pending')
    ).length

    const overdueCases = this.calculateOverdueCases(cases)
    
    // Månadsstatistik
    const completedCasesThisMonth = cases.filter(c => 
      c.status === 'completed' && 
      c.completed_date && 
      new Date(c.completed_date) >= thisMonthStart
    ).length

    const completedCasesLastMonth = cases.filter(c => 
      c.status === 'completed' && 
      c.completed_date && 
      new Date(c.completed_date) >= lastMonthStart &&
      new Date(c.completed_date) < thisMonthStart
    ).length

    // Prestanda-mätvärden
    const averageResolutionTime = this.calculateAverageResolutionTime(cases)
    const firstVisitSuccessRate = this.calculateFirstVisitSuccessRate(cases)
    const averageCasesPerTechnician = activeTechnicians > 0 ? activeCases / activeTechnicians : 0
    
    // 🆕 VERKLIG kapacitetsutnyttjande baserad på antal ärenden
    const capacityUtilization = this.calculateRealCapacityUtilization(technicians, cases)
    
    // Arbetsbelastning per tekniker
    const technicianWorkload = this.calculateTechnicianWorkload(technicians, cases)
    
    // Ärenden per prioritet
    const casesByPriority = this.calculateCasesByPriority(cases)
    
    // Månadsvis trend
    const monthlyTrend = completedCasesLastMonth > 0 
      ? ((completedCasesThisMonth - completedCasesLastMonth) / completedCasesLastMonth) * 100 
      : 0

    return {
      activeTechnicians,
      totalTechnicians,
      activeCases,
      averageCasesPerTechnician,
      capacityUtilization,
      urgentCases,
      completedCasesThisMonth,
      completedCasesLastMonth,
      averageResolutionTime,
      firstVisitSuccessRate,
      overdueCases,
      technicianWorkload,
      casesByPriority,
      monthlyTrend
    }
  }

  /**
   * ARR per verksamhetstyp - UPPDATERAD med case-intäkter
   */
  async getARRByBusinessType(): Promise<ARRByBusinessType[]> {
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, business_type, annual_premium, created_at')
      .eq('is_active', true)
    
    if (customersError) throw customersError

    // 🆕 Hämta case-intäkter per kund
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('customer_id, price')
      .not('price', 'is', null)
      .gt('price', 0)
    
    if (casesError) throw casesError
    
    const businessTypeMap = new Map<string, {
      arr: number
      count: number
      premiums: number[]
      createdDates: string[]
      caseRevenue: number
    }>()
    
    customers?.forEach(customer => {
      const type = customer.business_type || 'Annat'
      const current = businessTypeMap.get(type) || { 
        arr: 0, 
        count: 0, 
        premiums: [], 
        createdDates: [],
        caseRevenue: 0
      }
      
      // 🆕 Beräkna case-intäkter för denna kund
      const customerCaseRevenue = (cases || [])
        .filter(c => c.customer_id === customer.id)
        .reduce((sum, c) => sum + (c.price || 0), 0)
      
      businessTypeMap.set(type, {
        arr: current.arr + (customer.annual_premium || 0),
        count: current.count + 1,
        premiums: [...current.premiums, customer.annual_premium || 0],
        createdDates: [...current.createdDates, customer.created_at],
        caseRevenue: current.caseRevenue + customerCaseRevenue
      })
    })
    
    return Array.from(businessTypeMap.entries()).map(([business_type, data]) => {
      const average_arr_per_customer = data.count > 0 ? data.arr / data.count : 0
      
      // 🆕 VERKLIG tillväxttakt - ska beräknas senare med historisk data
      const growth_rate = "DUMMY" // Implementera med verklig historik
      
      return {
        business_type,
        arr: data.arr,
        customer_count: data.count,
        average_arr_per_customer,
        growth_rate: typeof growth_rate === 'string' ? 0 : growth_rate,
        additional_case_revenue: data.caseRevenue
      }
    }).sort((a, b) => b.arr - a.arr)
  }

  /**
   * Trend-data - DUMMY för nu, ska implementeras med verklig historik
   */
  async getTrendData(period: number): Promise<TrendData> {
    // TODO: Implementera med verklig historisk data från databas
    const months = this.getLastNMonths(12)
    
    const arrTrend = months.map((month, index) => ({
      month,
      value: "DUMMY", // Hämta verklig ARR för varje månad
      change: "DUMMY"  // Beräkna verklig förändring
    }))

    const customerTrend = months.map((month, index) => ({
      month,
      value: "DUMMY", // Antal kunder per månad
      change: "DUMMY"  // Förändring i antal kunder
    }))

    const caseTrend = months.map((month, index) => ({
      month,
      value: "DUMMY", // Antal cases per månad
      change: "DUMMY"  // Förändring i cases
    }))

    const technicianProductivity = months.map((month, index) => ({
      month,
      value: "DUMMY", // Verklig produktivitet per månad
      change: "DUMMY"  // Förändring i produktivitet
    }))

    return {
      arrTrend: arrTrend.map(t => ({ ...t, value: 0, change: 0 })),
      customerTrend: customerTrend.map(t => ({ ...t, value: 0, change: 0 })),
      caseTrend: caseTrend.map(t => ({ ...t, value: 0, change: 0 })),
      technicianProductivity: technicianProductivity.map(t => ({ ...t, value: 0, change: 0 }))
    }
  }

  // 🆕 VERKLIGA beräkningsmetoder baserat på contract_end_date

  private calculateCurrentARR(customers: any[]): number {
    const now = new Date()
    return customers.reduce((sum, customer) => {
      // Kontrollera att avtalet fortfarande är aktivt
      if (customer.contract_end_date) {
        const endDate = new Date(customer.contract_end_date)
        if (endDate <= now) {
          return sum // Avtalet har gått ut
        }
      }
      return sum + (customer.annual_premium || 0)
    }, 0)
  }

  private calculateTotalContractValue(customers: any[]): number {
    return customers.reduce((sum, customer) => 
      sum + (customer.total_contract_value || 0), 0
    )
  }

  private calculateAverageContractLength(customers: any[]): number {
    const contractsWithLength = customers.filter(c => c.contract_length_months)
    if (contractsWithLength.length === 0) return 0
    
    const totalMonths = contractsWithLength.reduce((sum, c) => 
      sum + c.contract_length_months, 0
    )
    
    return totalMonths / contractsWithLength.length
  }

  // 🆕 FÖRBÄTTRAD renewal-beräkning med contract_end_date
  private calculateRenewalMetrics(customers: any[]) {
    const now = new Date()
    const in3Months = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    const in6Months = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
    const in12Months = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    
    let expiring3Months = 0
    let expiring6Months = 0
    let expiring12Months = 0
    let upcomingRenewalsValue = 0
    
    customers.forEach(customer => {
      let endDate: Date | null = null
      
      // 🆕 Använd contract_end_date om tillgängligt
      if (customer.contract_end_date) {
        endDate = new Date(customer.contract_end_date)
      } else if (customer.contract_start_date && customer.contract_length_months) {
        // Fallback: beräkna från start + längd
        const startDate = new Date(customer.contract_start_date)
        endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + customer.contract_length_months)
      }
      
      if (endDate && endDate > now) {
        if (endDate <= in3Months) {
          expiring3Months++
          upcomingRenewalsValue += customer.annual_premium || 0
        } else if (endDate <= in6Months) {
          expiring6Months++
        } else if (endDate <= in12Months) {
          expiring12Months++
        }
      }
    })
    
    return {
      expiring3Months,
      expiring6Months,
      expiring12Months,
      upcomingRenewalsValue
    }
  }

  // 🆕 VERKLIG churn-beräkning
  private async calculateChurnMetrics(customers: any[], period: number) {
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - period)
    
    // Kunder som var aktiva vid period start
    const activeAtPeriodStart = customers.filter(c => {
      const createdDate = new Date(c.created_at)
      return createdDate < periodStart && c.is_active
    })
    
    // Kunder som blivit inaktiva under perioden (eller avtal som gått ut)
    const churned = customers.filter(c => {
      if (!c.is_active) return true
      
      // Kontrollera om avtalet gått ut
      if (c.contract_end_date) {
        const endDate = new Date(c.contract_end_date)
        const now = new Date()
        return endDate <= now
      }
      
      return false
    })
    
    const churnRate = activeAtPeriodStart.length > 0 
      ? (churned.length / activeAtPeriodStart.length) * 100 
      : 0
      
    const retentionRate = 100 - churnRate
    
    // Beräkna Net Revenue Retention
    const churnedRevenue = churned.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    const totalRevenueAtStart = activeAtPeriodStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
    
    const netRevenueRetention = totalRevenueAtStart > 0 
      ? ((totalRevenueAtStart - churnedRevenue) / totalRevenueAtStart) * 100
      : 100
    
    return {
      churnRate,
      retentionRate,
      netRevenueRetention
    }
  }

  // 🆕 VERKLIG tillväxtberäkning
  private async calculateGrowthMetrics(period: number) {
    const now = new Date()
    const lastMonth = new Date(now)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    
    const lastYear = new Date(now)
    lastYear.setFullYear(lastYear.getFullYear() - 1)
    
    // Hämta kunder för olika tidsperioder
    const [currentCustomers, lastMonthCustomers, lastYearCustomers] = await Promise.all([
      supabase.from('customers').select('annual_premium').eq('is_active', true),
      supabase.from('customers').select('annual_premium').eq('is_active', true).lte('created_at', lastMonth.toISOString()),
      supabase.from('customers').select('annual_premium').eq('is_active', true).lte('created_at', lastYear.toISOString())
    ])
    
    const currentARR = this.calculateCurrentARR(currentCustomers.data || [])
    const lastMonthARR = this.calculateCurrentARR(lastMonthCustomers.data || [])
    const lastYearARR = this.calculateCurrentARR(lastYearCustomers.data || [])
    
    const monthlyGrowth = lastMonthARR > 0 
      ? ((currentARR - lastMonthARR) / lastMonthARR) * 100 
      : 0
    
    const yearOverYearGrowth = lastYearARR > 0 
      ? ((currentARR - lastYearARR) / lastYearARR) * 100 
      : 0
    
    return {
      monthlyGrowth,
      yearOverYearGrowth
    }
  }

  // 🆕 NYA METODER för case-intäkter och prognoser

  private calculateAdditionalCaseRevenue(paidCases: any[]): number {
    return paidCases.reduce((sum, case_) => sum + (case_.price || 0), 0)
  }

  private calculateRevenueProjections(customers: any[]): { thisYear: number, nextYear: number } {
    const now = new Date()
    const thisYearEnd = new Date(now.getFullYear(), 11, 31)
    const nextYearEnd = new Date(now.getFullYear() + 1, 11, 31)
    
    let thisYearRevenue = 0
    let nextYearRevenue = 0
    
    customers.forEach(customer => {
      if (!customer.contract_start_date || !customer.contract_end_date || !customer.annual_premium) {
        return
      }
      
      const startDate = new Date(customer.contract_start_date)
      const endDate = new Date(customer.contract_end_date)
      const annualPremium = customer.annual_premium
      
      // Beräkna intäkt för detta år
      if (endDate > now) {
        const overlapThisYear = this.calculateYearOverlap(startDate, endDate, now, thisYearEnd)
        thisYearRevenue += (overlapThisYear / 365) * annualPremium
      }
      
      // Beräkna intäkt för nästa år
      const nextYearStart = new Date(now.getFullYear() + 1, 0, 1)
      if (endDate > nextYearStart) {
        const overlapNextYear = this.calculateYearOverlap(startDate, endDate, nextYearStart, nextYearEnd)
        nextYearRevenue += (overlapNextYear / 365) * annualPremium
      }
    })
    
    return {
      thisYear: thisYearRevenue,
      nextYear: nextYearRevenue
    }
  }

  private calculateYearOverlap(contractStart: Date, contractEnd: Date, yearStart: Date, yearEnd: Date): number {
    const overlapStart = new Date(Math.max(contractStart.getTime(), yearStart.getTime()))
    const overlapEnd = new Date(Math.min(contractEnd.getTime(), yearEnd.getTime()))
    
    if (overlapStart >= overlapEnd) return 0
    
    return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24))
  }

  private calculateRealCapacityUtilization(technicians: any[], cases: any[]): number {
    const activeTechnicians = technicians.filter(t => t.is_active)
    if (activeTechnicians.length === 0) return 0
    
    const activeCases = cases.filter(c => c.status === 'in_progress' || c.status === 'pending')
    const optimalCasesPerTechnician = 8 // Antag 8 cases per tekniker som optimal
    
    const totalOptimalCases = activeTechnicians.length * optimalCasesPerTechnician
    return Math.min(100, (activeCases.length / totalOptimalCases) * 100)
  }

  // BEHÅLLS OFÖRÄNDRADE METODER (övriga helper methods)
  private calculateOverdueCases(cases: any[]): number {
    const now = new Date()
    return cases.filter(c => 
      c.scheduled_date && 
      new Date(c.scheduled_date) < now && 
      (c.status === 'pending' || c.status === 'in_progress')
    ).length
  }

  private calculateAverageResolutionTime(cases: any[]): number {
    const completedCases = cases.filter(c => 
      c.status === 'completed' && c.created_at && c.completed_date
    )
    
    if (completedCases.length === 0) return 0
    
    const totalTime = completedCases.reduce((sum, c) => {
      const created = new Date(c.created_at)
      const completed = new Date(c.completed_date)
      const daysDiff = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      return sum + daysDiff
    }, 0)
    
    return totalTime / completedCases.length
  }

  private calculateFirstVisitSuccessRate(cases: any[]): number {
    // TODO: Implementera med verklig visits-data
    return "DUMMY" // Behöver visits-tabell koppling
  }

  private calculateTechnicianWorkload(technicians: any[], cases: any[]): TechnicianWorkload[] {
    return technicians
      .filter(t => t.is_active)
      .map(technician => {
        const technicianCases = cases.filter(c => 
          c.assigned_technician_id === technician.id
        )
        
        const activeCases = technicianCases.filter(c => 
          c.status === 'in_progress' || c.status === 'pending'
        ).length
        
        const completedThisMonth = technicianCases.filter(c => {
          if (!c.completed_date) return false
          const completedDate = new Date(c.completed_date)
          const thisMonth = new Date()
          thisMonth.setDate(1)
          return completedDate >= thisMonth
        }).length
        
        // 🆕 VERKLIG utilization rate baserad på optimal belastning
        const optimalCases = 8 // 8 cases per tekniker som optimal
        const utilizationRate = Math.min(100, (activeCases / optimalCases) * 100)
        
        // Genomsnittlig lösningstid för denna tekniker
        const technicianCompletedCases = technicianCases.filter(c => 
          c.status === 'completed' && c.created_at && c.completed_date
        )
        
        let averageResolutionTime = 0
        if (technicianCompletedCases.length > 0) {
          const totalTime = technicianCompletedCases.reduce((sum, c) => {
            const created = new Date(c.created_at)
            const completed = new Date(c.completed_date)
            return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          }, 0)
          averageResolutionTime = totalTime / technicianCompletedCases.length
        }
        
        return {
          technician_id: technician.id,
          technician_name: technician.name,
          active_cases: activeCases,
          completed_this_month: completedThisMonth,
          utilization_rate: utilizationRate,
          average_resolution_time: averageResolutionTime
        }
      })
      .sort((a, b) => b.utilization_rate - a.utilization_rate)
  }

  private calculateCasesByPriority(cases: any[]): CasesByPriority {
    const activeCases = cases.filter(c => 
      c.status === 'in_progress' || c.status === 'pending'
    )
    
    return {
      urgent: activeCases.filter(c => c.priority === 'urgent').length,
      high: activeCases.filter(c => c.priority === 'high').length,
      normal: activeCases.filter(c => c.priority === 'normal').length,
      low: activeCases.filter(c => c.priority === 'low').length
    }
  }

  private getLastNMonths(n: number): string[] {
    const months = []
    const now = new Date()
    
    for (let i = n - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setMonth(date.getMonth() - i)
      months.push(date.toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'short' 
      }))
    }
    
    return months
  }

  /**
   * 🆕 NYA METODER för utökad avtalsfunktionalitet
   */

  // Hämta avtal som löper ut inom X månader
  async getExpiringContracts(months: number = 3): Promise<Array<{
    customer_id: string
    company_name: string
    contract_end_date: string
    annual_premium: number
    days_until_expiry: number
    assigned_account_manager: string
  }>> {
    const futureDate = new Date()
    futureDate.setMonth(futureDate.getMonth() + months)
    
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        contract_end_date,
        annual_premium,
        assigned_account_manager
      `)
      .eq('is_active', true)
      .not('contract_end_date', 'is', null)
      .lte('contract_end_date', futureDate.toISOString().split('T')[0])
      .gte('contract_end_date', new Date().toISOString().split('T')[0])
      .order('contract_end_date', { ascending: true })
    
    if (error) throw error
    
    return (customers || []).map(customer => {
      const endDate = new Date(customer.contract_end_date)
      const now = new Date()
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      return {
        customer_id: customer.id,
        company_name: customer.company_name,
        contract_end_date: customer.contract_end_date,
        annual_premium: customer.annual_premium || 0,
        days_until_expiry: daysUntilExpiry,
        assigned_account_manager: customer.assigned_account_manager || 'Ej tilldelad'
      }
    })
  }

  // Avtalsstatus-statistik
  async getContractStatusStats(): Promise<{
    active: number
    expiring_30_days: number
    expiring_90_days: number
    expired: number
    total_value_at_risk: number
  }> {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    
    const { data: customers, error } = await supabase
      .from('customers')
      .select('contract_end_date, annual_premium, is_active')
      .eq('is_active', true)
    
    if (error) throw error
    
    let active = 0
    let expiring30 = 0
    let expiring90 = 0
    let expired = 0
    let totalValueAtRisk = 0
    
    customers?.forEach(customer => {
      if (!customer.contract_end_date) {
        active++
        return
      }
      
      const endDate = new Date(customer.contract_end_date)
      
      if (endDate < now) {
        expired++
      } else if (endDate <= in30Days) {
        expiring30++
        totalValueAtRisk += customer.annual_premium || 0
      } else if (endDate <= in90Days) {
        expiring90++
        totalValueAtRisk += customer.annual_premium || 0
      } else {
        active++
      }
    })
    
    return {
      active,
      expiring_30_days: expiring30,
      expiring_90_days: expiring90,
      expired,
      total_value_at_risk: totalValueAtRisk
    }
  }

  // 🆕 Månadsvis intäktsanalys
  async getMonthlyRevenueBreakdown(year: number = new Date().getFullYear()): Promise<Array<{
    month: string
    arr_revenue: number
    case_revenue: number
    total_revenue: number
    new_contracts: number
    expired_contracts: number
  }>> {
    const months = []
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      
      // Hämta ARR för månaden (avtal som är aktiva under månaden)
      const { data: customers } = await supabase
        .from('customers')
        .select('annual_premium, contract_start_date, contract_end_date')
        .eq('is_active', true)
        .or(`contract_end_date.is.null,contract_end_date.gte.${monthStart.toISOString().split('T')[0]}`)
        .lte('contract_start_date', monthEnd.toISOString().split('T')[0])
      
      // Hämta case-intäkter för månaden
      const { data: cases } = await supabase
        .from('cases')
        .select('price')
        .not('price', 'is', null)
        .gt('price', 0)
        .gte('completed_date', monthStart.toISOString())
        .lt('completed_date', monthEnd.toISOString())
      
      const arrRevenue = (customers || []).reduce((sum, c) => sum + (c.annual_premium || 0), 0) / 12
      const caseRevenue = (cases || []).reduce((sum, c) => sum + (c.price || 0), 0)
      
      months.push({
        month: monthStart.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
        arr_revenue: arrRevenue,
        case_revenue: caseRevenue,
        total_revenue: arrRevenue + caseRevenue,
        new_contracts: "DUMMY", // Implementera med created_at datum
        expired_contracts: "DUMMY" // Implementera med contract_end_date
      })
    }
    
    return months.map(m => ({
      ...m,
      new_contracts: typeof m.new_contracts === 'string' ? 0 : m.new_contracts,
      expired_contracts: typeof m.expired_contracts === 'string' ? 0 : m.expired_contracts
    }))
  }

  /**
   * Exportera rapport som CSV (BEHÅLLS SAMMA)
   */
  async exportReport(type: 'arr' | 'technicians' | 'full', period: number = 30): Promise<string> {
    const stats = await this.getDashboardStats(period)
    
    switch (type) {
      case 'arr':
        return this.generateARRReport(stats.arr, stats.arrByBusinessType)
      case 'technicians':
        return this.generateTechnicianReport(stats.technicians)
      case 'full':
        return this.generateFullReport(stats)
      default:
        throw new Error('Invalid report type')
    }
  }

  // 🆕 Lägg till exportCSV metod som saknas
  async exportCSV(): Promise<string> {
    return this.exportReport('full', 365)
  }

  private generateARRReport(arrStats: ARRStats, businessTypeData: ARRByBusinessType[]): string {
    const header = 'Metric,Value,Unit\n'
    const data = [
      `Current ARR,${arrStats.currentARR},SEK`,
      `Monthly Growth,${arrStats.monthlyGrowth.toFixed(2)},%`,
      `MRR,${arrStats.monthlyRecurringRevenue},SEK`,
      `Average ARR per Customer,${arrStats.averageARRPerCustomer},SEK`,
      `Additional Case Revenue,${arrStats.additionalCaseRevenue},SEK`,
      `Total Revenue,${arrStats.totalRevenue},SEK`,
      `Projected Revenue This Year,${arrStats.projectedRevenueThisYear},SEK`,
      `Projected Revenue Next Year,${arrStats.projectedRevenueNextYear},SEK`,
      `Contracts Expiring 3 Months,${arrStats.contractsExpiring3Months},Count`,
      `Contracts Expiring 6 Months,${arrStats.contractsExpiring6Months},Count`,
      `Churn Rate,${arrStats.churnRate.toFixed(2)},%`,
      `Retention Rate,${arrStats.retentionRate.toFixed(2)},%`,
      '',
      'Business Type,ARR,Customer Count,Avg ARR per Customer,Case Revenue',
      ...businessTypeData.map(bt => 
        `${bt.business_type},${bt.arr},${bt.customer_count},${bt.average_arr_per_customer.toFixed(0)},${bt.additional_case_revenue}`
      )
    ].join('\n')
    
    return header + data
  }

  private generateTechnicianReport(techStats: TechnicianStats): string {
    const header = 'Metric,Value,Unit\n'
    const data = [
      `Active Technicians,${techStats.activeTechnicians},Count`,
      `Capacity Utilization,${techStats.capacityUtilization.toFixed(1)},%`,
      `Active Cases,${techStats.activeCases},Count`,
      `Urgent Cases,${techStats.urgentCases},Count`,
      `Completed This Month,${techStats.completedCasesThisMonth},Count`,
      `Average Resolution Time,${techStats.averageResolutionTime.toFixed(1)},Days`,
      `First Visit Success Rate,${typeof techStats.firstVisitSuccessRate === 'string' ? 'DUMMY' : techStats.firstVisitSuccessRate.toFixed(1)},%`,
      `Overdue Cases,${techStats.overdueCases},Count`,
      '',
      'Technician,Active Cases,Completed This Month,Utilization Rate,Avg Resolution Time',
      ...techStats.technicianWorkload.map(tw => 
        `${tw.technician_name},${tw.active_cases},${tw.completed_this_month},${tw.utilization_rate.toFixed(1)}%,${tw.average_resolution_time.toFixed(1)}`
      )
    ].join('\n')
    
    return header + data
  }

  private generateFullReport(stats: DashboardStats): string {
    const timestamp = new Date().toISOString()
    const header = `BeGone Kundportal - Komplett Rapport\nGenererad: ${timestamp}\n\n`
    
    const basicSection = 'GRUNDSTATISTIK\n' + [
      `Total Customers,${stats.basic.totalCustomers}`,
      `Active Customers,${stats.basic.activeCustomers}`,
      `Total Cases,${stats.basic.totalCases}`,
      `New Customers This Month,${stats.basic.newCustomersThisMonth}`,
      `New Cases This Month,${stats.basic.newCasesThisMonth}`
    ].join('\n') + '\n\n'
    
    const arrSection = 'ARR STATISTIK\n' + [
      `Current ARR,${stats.arr.currentARR} SEK`,
      `Monthly Growth,${stats.arr.monthlyGrowth.toFixed(2)}%`,
      `MRR,${stats.arr.monthlyRecurringRevenue} SEK`,
      `Additional Case Revenue,${stats.arr.additionalCaseRevenue} SEK`,
      `Total Revenue,${stats.arr.totalRevenue} SEK`,
      `Churn Rate,${stats.arr.churnRate.toFixed(2)}%`,
      `Retention Rate,${stats.arr.retentionRate.toFixed(2)}%`
    ].join('\n') + '\n\n'
    
    const techSection = 'TEKNIKER STATISTIK\n' + [
      `Active Technicians,${stats.technicians.activeTechnicians}`,
      `Capacity Utilization,${stats.technicians.capacityUtilization.toFixed(1)}%`,
      `Active Cases,${stats.technicians.activeCases}`,
      `Urgent Cases,${stats.technicians.urgentCases}`,
      `Completed This Month,${stats.technicians.completedCasesThisMonth}`
    ].join('\n') + '\n\n'
    
    return header + basicSection + arrSection + techSection
  }

  /**
   * Beräkna hälsoscore för verksamheten (BEHÅLLS SAMMA)
   */
  calculateHealthScore(stats: DashboardStats): {
    overall: number
    financial: number
    operational: number
    growth: number
    details: string[]
  } {
    const financial = this.calculateFinancialHealth(stats.arr)
    const operational = this.calculateOperationalHealth(stats.technicians)
    const growth = this.calculateGrowthHealth(stats.arr, stats.basic)
    
    const overall = (financial + operational + growth) / 3
    
    const details = []
    
    if (financial >= 80) details.push('✅ Stark finansiell hälsa')
    else if (financial >= 60) details.push('⚠️ Acceptabel finansiell hälsa')
    else details.push('🚨 Svag finansiell hälsa')
    
    if (operational >= 80) details.push('✅ Effektiv drift')
    else if (operational >= 60) details.push('⚠️ Drift kan förbättras')
    else details.push('🚨 Driftproblem kräver åtgärd')
    
    if (growth >= 80) details.push('✅ Stark tillväxt')
    else if (growth >= 60) details.push('⚠️ Moderat tillväxt')
    else details.push('🚨 Svag tillväxt')
    
    return {
      overall,
      financial,
      operational,
      growth,
      details
    }
  }

  private calculateFinancialHealth(arr: ARRStats): number {
    let score = 0
    
    // ARR tillväxt (30 points)
    if (arr.monthlyGrowth > 5) score += 30
    else if (arr.monthlyGrowth > 0) score += 20
    else if (arr.monthlyGrowth > -2) score += 10
    
    // Churn rate (25 points)
    if (arr.churnRate < 3) score += 25
    else if (arr.churnRate < 5) score += 20
    else if (arr.churnRate < 8) score += 10
    
    // Retention rate (25 points)
    if (arr.retentionRate > 95) score += 25
    else if (arr.retentionRate > 90) score += 20
    else if (arr.retentionRate > 85) score += 15
    
    // Net Revenue Retention (20 points)
    if (arr.netRevenueRetention > 110) score += 20
    else if (arr.netRevenueRetention > 100) score += 15
    else if (arr.netRevenueRetention > 95) score += 10
    
    return Math.min(100, score)
  }

  private calculateOperationalHealth(tech: TechnicianStats): number {
    let score = 0
    
    // Capacity utilization (30 points)
    if (tech.capacityUtilization >= 85 && tech.capacityUtilization <= 95) score += 30
    else if (tech.capacityUtilization >= 75) score += 25
    else if (tech.capacityUtilization >= 65) score += 15
    
    // First visit success rate (25 points)
    const successRate = typeof tech.firstVisitSuccessRate === 'string' ? 0 : tech.firstVisitSuccessRate
    if (successRate > 90) score += 25
    else if (successRate > 80) score += 20
    else if (successRate > 70) score += 15
    
    // Resolution time (20 points)
    if (tech.averageResolutionTime < 2) score += 20
    else if (tech.averageResolutionTime < 3) score += 15
    else if (tech.averageResolutionTime < 5) score += 10
    
    // Overdue cases (15 points)
    const overduePercentage = tech.activeCases > 0 ? (tech.overdueCases / tech.activeCases) * 100 : 0
    if (overduePercentage < 5) score += 15
    else if (overduePercentage < 10) score += 10
    else if (overduePercentage < 20) score += 5
    
    // Urgent cases (10 points)
    const urgentPercentage = tech.activeCases > 0 ? (tech.urgentCases / tech.activeCases) * 100 : 0
    if (urgentPercentage < 10) score += 10
    else if (urgentPercentage < 20) score += 7
    else if (urgentPercentage < 30) score += 3
    
    return Math.min(100, score)
  }

  private calculateGrowthHealth(arr: ARRStats, basic: BasicStats): number {
    let score = 0
    
    // Monthly ARR growth (40 points)
    if (arr.monthlyGrowth > 8) score += 40
    else if (arr.monthlyGrowth > 5) score += 35
    else if (arr.monthlyGrowth > 2) score += 25
    else if (arr.monthlyGrowth > 0) score += 15
    
    // Customer growth (30 points)
    const customerGrowthRate = basic.totalCustomers > 0 ? (basic.newCustomersThisMonth / basic.totalCustomers) * 100 : 0
    if (customerGrowthRate > 10) score += 30
    else if (customerGrowthRate > 5) score += 25
    else if (customerGrowthRate > 2) score += 15
    else if (customerGrowthRate > 0) score += 10
    
    // Pipeline health (30 points)
    const pipelineRatio = arr.currentARR > 0 ? (arr.pipelineARR / arr.currentARR) * 100 : 0
    if (pipelineRatio > 20) score += 30
    else if (pipelineRatio > 15) score += 25
    else if (pipelineRatio > 10) score += 20
    else if (pipelineRatio > 5) score += 10
    
    return Math.min(100, score)
  }
}

export const statisticsService = new StatisticsService()