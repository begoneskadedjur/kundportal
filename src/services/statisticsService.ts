// src/services/statisticsService.ts - KOMBINERAD OCH FIXAD VERSION

import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

// Typer från BÅDA service-filerna samlade här
type CustomerData = Database['public']['Tables']['customers']['Row'] & { contract_length_months?: number | null }
type CaseData = Database['public']['Tables']['cases']['Row']
export type MonthlySpend = Database['public']['Tables']['monthly_marketing_spend']['Row']

// Interfaces från BÅDA service-filerna
export interface TechnicianWorkload { technician_id: string; technician_name: string; active_cases: number; completed_this_month: number; utilization_percentage: number; }
export interface TechnicianStats { activeTechnicians: number; activeCases: number; capacityUtilization: number; averageResolutionTime: number; overdueCases: number; technicianWorkload: TechnicianWorkload[]; }
export interface TechnicianPerformance { name: string; contractRevenue: number; caseRevenue: number; totalRevenue: number; contractCount: number; caseCount: number; }
export interface PestTypePerformance { pestType: string; revenue: number; caseCount: number; }
export interface PerformanceStats { byTechnician: TechnicianPerformance[]; byPestType: PestTypePerformance[]; }
export interface MonthlyGrowthAnalysis { startMRR: number; newMRR: number; churnedMRR: number; netChangeMRR: number; endMRR: number; }
export interface UpsellOpportunity { customerId: string; companyName: string; annualPremium: number; caseRevenueLast6Months: number; caseToArrRatio: number; }
export interface ARRStats { currentARR: number; monthlyGrowth: number; monthlyRecurringRevenue: number; averageARRPerCustomer: number; churnRate: number; retentionRate: number; netRevenueRetention: number; contractsExpiring3Months: number; contractsExpiring6Months: number; contractsExpiring12Months: number; additionalCaseRevenue: number; totalRevenue: number; averageCasePrice: number; paidCasesThisMonth: number; }
export interface ARRByBusinessType { business_type: string; arr: number; customer_count: number; average_arr_per_customer: number; additional_case_revenue: number; }
export interface ARRProjection { year: number; projectedARR: number; activeContracts: number; }
export interface UnitEconomics { cac: number; ltv: number; ltvToCacRatio: number; paybackPeriodMonths: number; roi: number; }

class StatisticsService {

    // =================================================================
    // METODER FRÅN technicianStatisticsService NU INNE I DENNA KLASS
    // =================================================================
    
    async getTechnicianStats(periodInDays: number = 30): Promise<TechnicianStats> {
        try {
            const { data: technicians, error: techErr } = await supabase.from('technicians').select('id, name, is_active').eq('is_active', true)
            if (techErr) throw techErr

            const { data: cases, error: caseErr } = await supabase.from('cases').select('id, status, created_at, completed_date, scheduled_date, assigned_technician_id, assigned_technician_name')
            if (caseErr) throw caseErr

            const allTechnicians = technicians || []
            const allCases = cases || []

            const activeCasesList = allCases.filter(c => c.status === 'in_progress' || c.status === 'pending' || c.status === 'open')
            const optimalCasesPerTechnician = 8
            const totalOptimalCapacity = allTechnicians.length * optimalCasesPerTechnician
            const capacityUtilization = totalOptimalCapacity > 0 ? Math.min(100, (activeCasesList.length / totalOptimalCapacity) * 100) : 0

            return {
                activeTechnicians: allTechnicians.length,
                activeCases: activeCasesList.length,
                capacityUtilization,
                averageResolutionTime: this.calculateAverageResolutionTime(allCases),
                overdueCases: this.calculateOverdueCases(allCases),
                technicianWorkload: this.calculateTechnicianWorkloadImproved(allTechnicians, allCases)
            }
        } catch (error) {
            console.error('💥 Error in getTechnicianStats:', error)
            return { activeTechnicians: 0, activeCases: 0, capacityUtilization: 0, averageResolutionTime: 0, overdueCases: 0, technicianWorkload: [] }
        }
    }

    private calculateTechnicianWorkloadImproved(technicians: any[], cases: any[]): TechnicianWorkload[] {
        const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0)
        return technicians.map(technician => {
            const technicianCases = cases.filter(c => c.assigned_technician_id === technician.id || c.assigned_technician_name === technician.name)
            const activeCases = technicianCases.filter(c => c.status === 'in_progress' || c.status === 'pending' || c.status === 'open').length
            const completedThisMonth = technicianCases.filter(c => (c.status === 'completed' || c.status === 'closed') && c.completed_date && new Date(c.completed_date) >= thisMonthStart).length
            const optimalCasesPerTechnician = 8
            const utilizationPercentage = Math.min(100, (activeCases / optimalCasesPerTechnician) * 100)
            return { technician_id: technician.id, technician_name: technician.name, active_cases: activeCases, completed_this_month: completedThisMonth, utilization_percentage: Math.round(utilizationPercentage) }
        }).sort((a, b) => b.active_cases - a.active_cases)
    }

    private calculateAverageResolutionTime(cases: any[]): number {
        const completedCases = cases.filter(c => (c.status === 'completed' || c.status === 'closed') && c.created_at && c.completed_date)
        if (completedCases.length === 0) return 0
        const totalTime = completedCases.reduce((sum, c) => {
            const createdDate = new Date(c.created_at); const completedDate = new Date(c.completed_date)
            return sum + Math.max(0, (completedDate.getTime() - createdDate.getTime()) / 86400000)
        }, 0)
        return totalTime / completedCases.length
    }

    private calculateOverdueCases(cases: any[]): number {
        const now = new Date()
        return cases.filter(c => c.scheduled_date && new Date(c.scheduled_date) < now && (c.status === 'pending' || c.status === 'in_progress' || c.status === 'open')).length
    }

    // =================================================================
    // METODER FRÅN economicStatisticsService
    // =================================================================

    async getDashboardStats() {
        try {
            const [customersRes, casesRes] = await Promise.all([ supabase.from('customers').select('*'), supabase.from('cases').select('*') ])
            if (customersRes.error) throw customersRes.error
            if (casesRes.error) throw casesRes.error

            const allCustomers: CustomerData[] = customersRes.data || []
            const allCases: CaseData[] = casesRes.data || []
            
            const arr = await this.getARRStats(allCustomers, allCases, 30)
            const technicians = await this.getTechnicianStats(30); // ANROPAR INTERNT!

            const [arrByBusinessType, growthAnalysis, upsellOpportunities, arrProjections] = await Promise.all([
                this.getARRByBusinessType(allCustomers, allCases),
                this.getMonthlyGrowthAnalysis(allCustomers),
                this.getUpsellOpportunities(allCustomers, allCases, 5),
                this.getARRProjections(allCustomers),
            ])
            return { arr, arrByBusinessType, technicians, growthAnalysis, upsellOpportunities, arrProjections }
        } catch (error) { console.error('Error fetching dashboard stats:', error); throw error }
    }
    
    async getPerformanceStatsForMonth(selectedDate: Date): Promise<PerformanceStats> {
      const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

      const [customersRes, casesRes] = await Promise.all([
        supabase.from('customers').select('id, annual_premium, assigned_account_manager').eq('is_active', true),
        supabase.from('cases').select('price, assigned_technician_id, assigned_technician_name, pest_type, completed_date, customer_id').not('price', 'is', null).gt('price', 0).gte('completed_date', firstDayOfMonth.toISOString()).lte('completed_date', lastDayOfMonth.toISOString())
      ]);

      if (customersRes.error) throw customersRes.error;
      if (casesRes.error) throw casesRes.error;

      const activeCustomers = (customersRes.data || []) as CustomerData[];
      const monthCases = (casesRes.data || []) as CaseData[];

      const techMap = new Map<string, { displayName: string; contractRevenue: number; caseRevenue: number; contractCount: number; caseCount: number; }>();
      const getTechnicianInfo = (c: CaseData): { key: string; name: string } | null => {
        if (c.assigned_technician_id) return { key: c.assigned_technician_id, name: c.assigned_technician_name || 'Okänt Namn' };
        if (c.assigned_technician_name) return { key: c.assigned_technician_name, name: c.assigned_technician_name };
        return null;
      }

      monthCases.forEach(c => {
        const techInfo = getTechnicianInfo(c);
        if (!techInfo) return;
        let current = techMap.get(techInfo.key);
        if (!current) { current = { displayName: techInfo.name, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 }; }
        current.caseRevenue += c.price || 0;
        current.caseCount++;
        current.displayName = techInfo.name;
        techMap.set(techInfo.key, current);
      });

      activeCustomers.forEach(customer => {
        const key = customer.assigned_account_manager?.toLowerCase().trim();
        if (!key) return;
        const matchingTechKey = Array.from(techMap.keys()).find(k => techMap.get(k)?.displayName.toLowerCase().trim() === key);
        if (!matchingTechKey) return;
        const current = techMap.get(matchingTechKey)!;
        current.contractRevenue += (customer.annual_premium || 0) / 12;
        current.contractCount++;
        techMap.set(matchingTechKey, current);
      });

      const byTechnician: TechnicianPerformance[] = Array.from(techMap.values()).map(d => ({ 
          name: d.displayName, contractRevenue: d.contractRevenue, caseRevenue: d.caseRevenue, 
          totalRevenue: d.contractRevenue + d.caseRevenue, contractCount: d.contractCount, caseCount: d.caseCount
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      const pestMap = new Map<string, { revenue: number, caseCount: number }>();
      monthCases.forEach(c => {
        const pestType = c.pest_type || 'Okänt';
        const current = pestMap.get(pestType) || { revenue: 0, caseCount: 0 };
        current.revenue += c.price || 0;
        current.caseCount++;
        pestMap.set(pestType, current);
      });
      
      const byPestType = Array.from(pestMap.entries()).map(([pestType, data]) => ({ pestType, ...data })).sort((a, b) => b.revenue - a.revenue);
      
      return { byTechnician, byPestType };
    }
    
    async getYearlySpend(year: number): Promise<MonthlySpend[]> {
        try {
          const { data, error } = await supabase.from('monthly_marketing_spend').select('*').gte('month', `${year}-01-01`).lte('month', `${year}-12-31`).order('month', { ascending: true });
          if (error) throw error;
          return data || [];
        } catch (error) { console.error('Error fetching yearly spend:', error); return []; }
    }
    async getUpsellOpportunities(allCustomers: CustomerData[], allCases: CaseData[], limit: number = 5): Promise<UpsellOpportunity[]> {
        const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        const activeCustomers = allCustomers.filter(c => c.is_active)
        const recentCases = allCases.filter(c => c.price && c.price > 0 && c.completed_date && new Date(c.completed_date) >= sixMonthsAgo)
        const caseRevenueMap = new Map<string, number>()
        for (const c of recentCases) { if (c.customer_id) { caseRevenueMap.set(c.customer_id, (caseRevenueMap.get(c.customer_id) || 0) + c.price!) } }
        const opportunities = activeCustomers.map(customer => {
            const caseRevenue = caseRevenueMap.get(customer.id) || 0
            if (caseRevenue === 0 || !customer.annual_premium || !customer.company_name) return null
            return { customerId: customer.id, companyName: customer.company_name, annualPremium: customer.annual_premium, caseRevenueLast6Months: caseRevenue, caseToArrRatio: caseRevenue / customer.annual_premium }
        }).filter((opp): opp is UpsellOpportunity => opp !== null)
        return opportunities.sort((a, b) => b.caseToArrRatio - a.caseToArrRatio).slice(0, limit)
    }
    async getMonthlyGrowthAnalysis(allCustomers: CustomerData[]): Promise<MonthlyGrowthAnalysis> {
        const today = new Date(); const oneMonthAgo = new Date(); oneMonthAgo.setMonth(today.getMonth() - 1)
        const customersAtStart = allCustomers.filter(c => new Date(c.created_at) < oneMonthAgo)
        const activeAtStart = customersAtStart.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > oneMonthAgo))
        const startARR = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
        const newCustomers = allCustomers.filter(c => new Date(c.created_at) >= oneMonthAgo && c.is_active)
        const newARR = newCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
        const churnedCustomers = activeAtStart.filter(startCustomer => { const currentStatus = allCustomers.find(c => c.id === startCustomer.id); return !currentStatus || !currentStatus.is_active })
        const churnedARR = churnedCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
        const activeNow = allCustomers.filter(c => c.is_active)
        const endARR = activeNow.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
        return { startMRR: startARR / 12, newMRR: newARR / 12, churnedMRR: churnedARR / 12, netChangeMRR: (endARR - startARR) / 12, endMRR: endARR / 12 }
    }
    async getARRProjections(allCustomers: CustomerData[]): Promise<ARRProjection[]> {
        const activeCustomers = allCustomers.filter(c => c.is_active && c.annual_premium && c.contract_start_date && c.contract_end_date)
        if (activeCustomers.length === 0) return []
        const projections: ARRProjection[] = []
        const currentYear = new Date().getFullYear()
        const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
        for (let i = 0; i < 6; i++) {
            const targetYear = currentYear + i
            if (targetYear === currentYear) { projections.push({ year: targetYear, projectedARR: currentARR, activeContracts: activeCustomers.length }); continue }
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
                const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / 86400000 + 1
                totalProjectedRevenueForYear += overlapDays * dailyRate
                activeContractsInYear++
            }
            projections.push({ year: targetYear, projectedARR: totalProjectedRevenueForYear, activeContracts: activeContractsInYear })
        }
        return projections
    }
    async getARRByBusinessType(allCustomers: CustomerData[], allCases: CaseData[]): Promise<ARRByBusinessType[]> {
        const activeCustomers = allCustomers.filter(c => c.is_active)
        const businessTypeMap = new Map<string, { arr: number; count: number; caseRevenue: number }>()
        const customerCaseRevenue = new Map<string, number>()
        allCases.forEach(c => { if(c.customer_id && c.price && c.price > 0 && c.completed_date) { customerCaseRevenue.set(c.customer_id, (customerCaseRevenue.get(c.customer_id) || 0) + c.price) }})
        activeCustomers.forEach(customer => {
          const type = customer.business_type || 'Annat'
          const current = businessTypeMap.get(type) || { arr: 0, count: 0, caseRevenue: 0 }
          current.arr += customer.annual_premium || 0
          current.count++
          current.caseRevenue += customerCaseRevenue.get(customer.id) || 0
          businessTypeMap.set(type, current)
        })
        return Array.from(businessTypeMap.entries()).map(([bt, d]) => ({ business_type: bt, arr: d.arr, customer_count: d.count, average_arr_per_customer: d.count > 0 ? d.arr / d.count : 0, additional_case_revenue: d.caseRevenue })).sort((a, b) => b.arr - a.arr)
    }
    async getARRStats(allCustomers: CustomerData[], allCases: CaseData[], periodInDays: number): Promise<ARRStats> {
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
        return { currentARR, monthlyGrowth: growthMetrics.monthlyGrowth, monthlyRecurringRevenue, averageARRPerCustomer: activeCustomers.length > 0 ? currentARR / activeCustomers.length : 0, churnRate: churnMetrics.churnRate, retentionRate: 100 - churnMetrics.churnRate, netRevenueRetention: churnMetrics.netRevenueRetention, contractsExpiring3Months: renewalMetrics.expiring3Months, contractsExpiring6Months: renewalMetrics.expiring6Months, contractsExpiring12Months: renewalMetrics.expiring12Months, additionalCaseRevenue, totalRevenue: currentARR + additionalCaseRevenue, averageCasePrice: paidCases.length > 0 ? additionalCaseRevenue / paidCases.length : 0, paidCasesThisMonth }
    }
    async calculateGrowthMetrics(allCustomers: CustomerData[], currentARR: number): Promise<{ monthlyGrowth: number }> {
        const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1)
        const customersActiveLastMonth = allCustomers.filter(c => c.is_active && new Date(c.created_at) <= lastMonth)
        const lastMonthARR = customersActiveLastMonth.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
        const growth = lastMonthARR > 0 ? ((currentARR - lastMonthARR) / lastMonthARR) * 100 : (currentARR > 0 ? 100 : 0)
        return { monthlyGrowth: growth }
    }
    calculateChurnMetrics(allCustomers: CustomerData[], periodInDays: number): { churnRate: number; netRevenueRetention: number } {
        const periodStart = new Date(); periodStart.setDate(periodStart.getDate() - periodInDays)
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
    calculateRenewalMetrics(activeCustomers: CustomerData[]): { expiring3Months: number; expiring6Months: number; expiring12Months: number } {
        const now = new Date(); const in3Months = new Date(); in3Months.setMonth(now.getMonth() + 3); const in6Months = new Date(); in6Months.setMonth(now.getMonth() + 6); const in12Months = new Date(); in12Months.setMonth(now.getMonth() + 12)
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
}

// Exportera en enda instans av den nya, kombinerade servicen
export const statisticsService = new StatisticsService();