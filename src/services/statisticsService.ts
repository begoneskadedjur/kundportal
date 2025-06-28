// src/services/statisticsService.ts - Service för avancerad dashboard-statistik
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
   * Grundläggande statistik
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
   * ARR och ekonomisk statistik
   */
  async getARRStats(period: number): Promise<ARRStats> {
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id, is_active, annual_premium, total_contract_value,
        contract_start_date, contract_length_months, business_type,
        created_at
      `)
    
    if (error) throw error
    
    const activeCustomers = (customers || []).filter(c => c.is_active)
    const allCustomers = customers || []
    
    // Grundläggande ARR-beräkningar
    const currentARR = this.calculateCurrentARR(activeCustomers)
    const monthlyRecurringRevenue = currentARR / 12
    const totalContractValue = this.calculateTotalContractValue(activeCustomers)
    const averageARRPerCustomer = activeCustomers.length > 0 ? currentARR / activeCustomers.length : 0
    
    // Avtalslängd
    const averageContractLength = this.calculateAverageContractLength(activeCustomers)
    
    // Förnyelser och uppsägningar
    const renewalMetrics = this.calculateRenewalMetrics(activeCustomers)
    const churnMetrics = this.calculateChurnMetrics(allCustomers, period)
    
    // Tillväxt
    const growthMetrics = await this.calculateGrowthMetrics(period)
    
    // Pipeline (simulerad - skulle behöva CRM-integration)
    const pipelineARR = currentARR * 0.15 // 15% av nuvarande ARR
    
    return {
      currentARR,
      monthlyGrowth: growthMetrics.monthlyGrowth,
      yearOverYearGrowth: growthMetrics.yearOverYearGrowth,
      upcomingRenewals: renewalMetrics.upcomingRenewalsValue,
      pipelineARR,
      averageARRPerCustomer,
      contractsExpiring3Months: renewalMetrics.expiring3Months,
      contractsExpiring6Months: renewalMetrics.expiring6Months,
      contractsExpiring12Months: renewalMetrics.expiring12Months,
      totalContractValue,
      monthlyRecurringRevenue,
      churnRate: churnMetrics.churnRate,
      retentionRate: churnMetrics.retentionRate,
      averageContractLength,
      netRevenueRetention: churnMetrics.netRevenueRetention
    }
  }

  /**
   * Tekniker-statistik
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
        scheduled_date, assigned_technician_id,
        technicians(id, name)
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
    
    // Kapacitetsutnyttjande (simulerad)
    const capacityUtilization = Math.min(95, 60 + Math.random() * 30)
    
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
   * ARR per verksamhetstyp
   */
  async getARRByBusinessType(): Promise<ARRByBusinessType[]> {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('business_type, annual_premium, created_at')
      .eq('is_active', true)
    
    if (error) throw error
    
    const businessTypeMap = new Map<string, {
      arr: number
      count: number
      premiums: number[]
      createdDates: string[]
    }>()
    
    customers?.forEach(customer => {
      const type = customer.business_type || 'Annat'
      const current = businessTypeMap.get(type) || { 
        arr: 0, 
        count: 0, 
        premiums: [], 
        createdDates: [] 
      }
      
      businessTypeMap.set(type, {
        arr: current.arr + (customer.annual_premium || 0),
        count: current.count + 1,
        premiums: [...current.premiums, customer.annual_premium || 0],
        createdDates: [...current.createdDates, customer.created_at]
      })
    })
    
    return Array.from(businessTypeMap.entries()).map(([business_type, data]) => {
      const average_arr_per_customer = data.count > 0 ? data.arr / data.count : 0
      
      // Beräkna tillväxttakt (simulerad)
      const growth_rate = (Math.random() - 0.3) * 20 // -6% till +14%
      
      return {
        business_type,
        arr: data.arr,
        customer_count: data.count,
        average_arr_per_customer,
        growth_rate
      }
    }).sort((a, b) => b.arr - a.arr)
  }

  /**
   * Trend-data för grafer
   */
  async getTrendData(period: number): Promise<TrendData> {
    // Detta skulle behöva historisk data som vi inte har än
    // Returnerar simulerad data för demonstration
    
    const months = this.getLastNMonths(12)
    
    const arrTrend = months.map((month, index) => ({
      month,
      value: 1000000 + (index * 50000) + (Math.random() * 100000),
      change: (Math.random() - 0.3) * 20
    }))

    const customerTrend = months.map((month, index) => ({
      month,
      value: 50 + (index * 3) + Math.floor(Math.random() * 10),
      change: (Math.random() - 0.2) * 15
    }))

    const caseTrend = months.map((month, index) => ({
      month,
      value: 100 + (index * 5) + Math.floor(Math.random() * 20),
      change: (Math.random() - 0.1) * 25
    }))

    const technicianProductivity = months.map((month, index) => ({
      month,
      value: 75 + Math.floor(Math.random() * 20),
      change: (Math.random() - 0.5) * 10
    }))

    return {
      arrTrend,
      customerTrend,
      caseTrend,
      technicianProductivity
    }
  }

  // Private helper methods
  private calculateCurrentARR(customers: any[]): number {
    return customers.reduce((sum, customer) => 
      sum + (customer.annual_premium || 0), 0
    )
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
      if (customer.contract_start_date && customer.contract_length_months) {
        const startDate = new Date(customer.contract_start_date)
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + customer.contract_length_months)
        
        if (endDate <= in3Months && endDate > now) {
          expiring3Months++
          upcomingRenewalsValue += customer.annual_premium || 0
        } else if (endDate <= in6Months && endDate > now) {
          expiring6Months++
        } else if (endDate <= in12Months && endDate > now) {
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

  private calculateChurnMetrics(customers: any[], period: number) {
    // Simulerad churn-beräkning (skulle behöva historisk data)
    const churnRate = Math.random() * 5 // 0-5%
    const retentionRate = 100 - churnRate
    const netRevenueRetention = 95 + Math.random() * 20 // 95-115%
    
    return {
      churnRate,
      retentionRate,
      netRevenueRetention
    }
  }

  private async calculateGrowthMetrics(period: number) {
    // Simulerad tillväxt (skulle behöva historisk data)
    const monthlyGrowth = (Math.random() - 0.2) * 15 // -3% till +12%
    const yearOverYearGrowth = (Math.random() + 0.1) * 30 // 3% till +33%
    
    return {
      monthlyGrowth,
      yearOverYearGrowth
    }
  }

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
    // Simulerad success rate (skulle behöva visits-data)
    return 75 + Math.random() * 20 // 75-95%
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
        
        // Simulerad utilization rate
        const utilizationRate = Math.min(100, 60 + Math.random() * 35)
        
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
   * Exportera rapport som CSV
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

  private generateARRReport(arrStats: ARRStats, businessTypeData: ARRByBusinessType[]): string {
    const header = 'Metric,Value,Unit\n'
    const data = [
      `Current ARR,${arrStats.currentARR},SEK`,
      `Monthly Growth,${arrStats.monthlyGrowth.toFixed(2)},%`,
      `MRR,${arrStats.monthlyRecurringRevenue},SEK`,
      `Average ARR per Customer,${arrStats.averageARRPerCustomer},SEK`,
      `Contracts Expiring 3 Months,${arrStats.contractsExpiring3Months},Count`,
      `Contracts Expiring 6 Months,${arrStats.contractsExpiring6Months},Count`,
      `Churn Rate,${arrStats.churnRate.toFixed(2)},%`,
      `Retention Rate,${arrStats.retentionRate.toFixed(2)},%`,
      '',
      'Business Type,ARR,Customer Count,Avg ARR per Customer',
      ...businessTypeData.map(bt => 
        `${bt.business_type},${bt.arr},${bt.customer_count},${bt.average_arr_per_customer.toFixed(0)}`
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
      `First Visit Success Rate,${techStats.firstVisitSuccessRate.toFixed(1)},%`,
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
   * Beräkna hälsoscore för verksamheten
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
    if (tech.firstVisitSuccessRate > 90) score += 25
    else if (tech.firstVisitSuccessRate > 80) score += 20
    else if (tech.firstVisitSuccessRate > 70) score += 15
    
    // Resolution time (20 points)
    if (tech.averageResolutionTime < 2) score += 20
    else if (tech.averageResolutionTime < 3) score += 15
    else if (tech.averageResolutionTime < 5) score += 10
    
    // Overdue cases (15 points)
    const overduePercentage = (tech.overdueCases / tech.activeCases) * 100
    if (overduePercentage < 5) score += 15
    else if (overduePercentage < 10) score += 10
    else if (overduePercentage < 20) score += 5
    
    // Urgent cases (10 points)
    const urgentPercentage = (tech.urgentCases / tech.activeCases) * 100
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
    const customerGrowthRate = (basic.newCustomersThisMonth / basic.totalCustomers) * 100
    if (customerGrowthRate > 10) score += 30
    else if (customerGrowthRate > 5) score += 25
    else if (customerGrowthRate > 2) score += 15
    else if (customerGrowthRate > 0) score += 10
    
    // Pipeline health (30 points)
    const pipelineRatio = (arr.pipelineARR / arr.currentARR) * 100
    if (pipelineRatio > 20) score += 30
    else if (pipelineRatio > 15) score += 25
    else if (pipelineRatio > 10) score += 20
    else if (pipelineRatio > 5) score += 10
    
    return Math.min(100, score)
  }
}

export const statisticsService = new StatisticsService()