// src/services/economicStatisticsService.ts - FINAL FIX: Re-introduces the specific function needed by the SegmentPerformanceCard component.

import { supabase } from '../lib/supabase';
import { technicianStatisticsService } from './technicianStatisticsService';
import type { TechnicianStats } from './technicianStatisticsService';

// --- DATABASE TYPES ---
type CustomerData = {
  id: string;
  is_active: boolean;
  annual_premium: number | null;
  created_at: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  business_type: string | null;
  company_name: string | null;
  assigned_account_manager: string | null;
};

type CaseData = {
  id: string;
  customer_id: string | null;
  price: number | null;
  completed_date: string | null;
  assigned_technician_name: string | null;
  pest_type: string | null;
};

// --- INTERFACES ---
export interface TechnicianPerformance { name: string; contractRevenue: number; caseRevenue: number; totalRevenue: number; contractCount: number; caseCount: number; }
export interface PestTypePerformance { pestType: string; revenue: number; caseCount: number; }
export interface PerformanceStats { byTechnician: TechnicianPerformance[]; byPestType: PestTypePerformance[]; }
export interface MonthlyGrowthAnalysis { startMRR: number; newMRR: number; churnedMRR: number; netChangeMRR: number; endMRR: number; }
export interface UpsellOpportunity { customerId: string; companyName: string; annualPremium: number; caseRevenueLast6Months: number; caseToArrRatio: number; }
export interface ARRStats { currentARR: number; monthlyGrowth: number; monthlyRecurringRevenue: number; averageARRPerCustomer: number; churnRate: number; retentionRate: number; netRevenueRetention: number; contractsExpiring3Months: number; contractsExpiring6Months: number; contractsExpiring12Months: number; additionalCaseRevenue: number; totalRevenue: number; averageCasePrice: number; paidCasesThisMonth: number; }
export interface ARRByBusinessType { business_type: string; arr: number; customer_count: number; average_arr_per_customer: number; additional_case_revenue: number; }
export interface ARRProjection { year: number; projectedARR: number; activeContracts: number; }
export interface UnitEconomics { cac: number; ltv: number; ltvToCacRatio: number; paybackPeriodMonths: number; }
export interface DashboardStats { arr: ARRStats; arrByBusinessType: ARRByBusinessType[]; technicians: TechnicianStats; growthAnalysis: MonthlyGrowthAnalysis; upsellOpportunities: UpsellOpportunity[]; performanceStats: PerformanceStats; arrProjections: ARRProjection[]; unitEconomics: UnitEconomics; }

class EconomicStatisticsService {

  // Huvudmetod för dashboarden - optimeringarna är kvar
  getDashboardStats = async (periodInDays: number = 30): Promise<DashboardStats> => {
    try {
      const [customersRes, casesRes] = await Promise.all([
        supabase.from('customers').select<string, CustomerData>('id, is_active, annual_premium, created_at, contract_start_date, contract_end_date, business_type, company_name, assigned_account_manager'),
        supabase.from('cases').select<string, CaseData>('id, customer_id, price, completed_date, assigned_technician_name, pest_type')
      ]);

      if (customersRes.error) throw customersRes.error;
      if (casesRes.error) throw casesRes.error;

      const allCustomers: CustomerData[] = customersRes.data || [];
      const allCases: CaseData[] = casesRes.data || [];
      
      const arr = await this.getARRStats(allCustomers, allCases, periodInDays);
      
      const [
        arrByBusinessType,
        technicians,
        growthAnalysis,
        upsellOpportunities,
        performanceStats,
        arrProjections,
        unitEconomics
      ] = await Promise.all([
        this.getARRByBusinessType(allCustomers, allCases),
        technicianStatisticsService.getTechnicianStats(periodInDays),
        this.getMonthlyGrowthAnalysis(allCustomers),
        this.getUpsellOpportunities(allCustomers, allCases, 5),
        this.getPerformanceStats(allCustomers, allCases),
        this.getARRProjections(allCustomers),
        this.getUnitEconomics(arr)
      ]);

      return { arr, arrByBusinessType, technicians, growthAnalysis, upsellOpportunities, performanceStats, arrProjections, unitEconomics };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  // =================================================================================================
  // === FIX: ÅTERINFÖR DEN SPECIFIKA FUNKTIONEN SOM SegmentPerformanceCard BEHÖVER ===
  // Denna funktion anropas direkt av komponenten och är inte en del av den optimerade getDashboardStats-kedjan.
  // =================================================================================================
  getARRByBusinessTypeForYear = async (targetYear: number): Promise<ARRByBusinessType[]> => {
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, business_type, annual_premium, contract_start_date, contract_end_date')
      .eq('is_active', true);
    if (customersError) throw customersError;

    const { data: allCases, error: casesError } = await supabase
      .from('cases')
      .select('customer_id, price, completed_date')
      .not('price', 'is', null).gt('price', 0)
      .not('completed_date', 'is', null)
      .gte('completed_date', yearStart.toISOString())
      .lte('completed_date', yearEnd.toISOString());
    if (casesError) throw casesError;

    const businessTypeMap = new Map<string, { arr: number; caseRevenue: number; customerIds: Set<string> }>();

    (allCustomers || []).forEach(customer => {
        const type = customer.business_type || 'Annat';
        if (!businessTypeMap.has(type)) {
            businessTypeMap.set(type, { arr: 0, caseRevenue: 0, customerIds: new Set() });
        }
    });
    
    (allCustomers || []).forEach(customer => {
        if (!customer.contract_start_date || !customer.contract_end_date || !customer.annual_premium) return;
        const type = customer.business_type || 'Annat';
        const contractStart = new Date(customer.contract_start_date);
        const contractEnd = new Date(customer.contract_end_date);
        
        const overlapStart = new Date(Math.max(contractStart.getTime(), yearStart.getTime()));
        const overlapEnd = new Date(Math.min(contractEnd.getTime(), yearEnd.getTime()));

        if (overlapStart < overlapEnd) {
            const dailyRate = customer.annual_premium / 365.25;
            const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
            const revenueForYear = overlapDays * dailyRate;
            
            const current = businessTypeMap.get(type)!;
            current.arr += revenueForYear;
            current.customerIds.add(customer.id);
        }
    });

    const customerIdToTypeMap = new Map((allCustomers || []).map(c => [c.id, c.business_type || 'Annat']));
    (allCases || []).forEach(c => {
        if (!c.customer_id) return;
        const type = customerIdToTypeMap.get(c.customer_id);
        if (type && businessTypeMap.has(type)) {
            const current = businessTypeMap.get(type)!;
            current.caseRevenue += c.price || 0;
            current.customerIds.add(c.customer_id);
        }
    });

    return Array.from(businessTypeMap.entries()).map(([business_type, data]) => ({
      business_type,
      arr: data.arr,
      customer_count: data.customerIds.size,
      average_arr_per_customer: data.customerIds.size > 0 ? data.arr / data.customerIds.size : 0,
      additional_case_revenue: data.caseRevenue
    })).sort((a, b) => (b.arr + b.additional_case_revenue) - (a.arr + a.additional_case_revenue));
  }
  // === SLUT PÅ FIX ===


  // Alla andra metoder är oförändrade och använder de optimerade anropen
  getARRStats = async (allCustomers: CustomerData[], allCases: CaseData[], periodInDays: number): Promise<ARRStats> => {
    const paidCases = allCases.filter(c => c.completed_date && c.price && c.price > 0);
    const activeCustomers = allCustomers.filter(c => c.is_active);
    const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const monthlyRecurringRevenue = currentARR / 12;
    const additionalCaseRevenue = paidCases.reduce((sum, c) => sum + (c.price || 0), 0);
    
    const growthMetrics = await this.calculateGrowthMetrics(allCustomers, currentARR);
    const churnMetrics = this.calculateChurnMetrics(allCustomers, periodInDays);
    const renewalMetrics = this.calculateRenewalMetrics(activeCustomers);
    
    const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0,0,0,0);
    const paidCasesThisMonth = paidCases.filter(c => c.completed_date != null && new Date(c.completed_date) >= thisMonthStart).length;

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
      paidCasesThisMonth,
    };
  }

  getUnitEconomics = async (arrStats: ARRStats): Promise<UnitEconomics> => {
    const today = new Date();
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const { data: spendData, error: spendError } = await supabase
      .from('monthly_marketing_spend')
      .select('spend')
      .eq('month', firstDayOfLastMonth.toISOString().split('T')[0])
      .single();
    
    if (spendError && spendError.code !== 'PGRST116') { 
      console.error("Error fetching marketing spend:", spendError);
    }
    const marketingSpend = spendData?.spend || 0;

    const { count: newCustomersLastMonth, error: customersError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', firstDayOfLastMonth.toISOString())
      .lte('created_at', lastDayOfLastMonth.toISOString());

    if (customersError) throw customersError;

    const cac = newCustomersLastMonth && newCustomersLastMonth > 0 ? marketingSpend / newCustomersLastMonth : 0;
    const churnRateForLTV = arrStats.churnRate > 0 ? arrStats.churnRate / 100 : 0.01;
    const ltv = churnRateForLTV > 0 ? arrStats.averageARRPerCustomer / churnRateForLTV : 0;
    const ltvToCacRatio = cac > 0 ? ltv / cac : 0;
    const avgMrrPerCustomer = arrStats.averageARRPerCustomer / 12;
    const paybackPeriodMonths = avgMrrPerCustomer > 0 ? cac / avgMrrPerCustomer : 0;

    return { cac, ltv, ltvToCacRatio, paybackPeriodMonths };
  }
  
  getARRByBusinessType = async (allCustomers: CustomerData[], allCases: CaseData[]): Promise<ARRByBusinessType[]> => {
    const activeCustomers = allCustomers.filter(c => c.is_active);
    const businessTypeMap = new Map<string, { arr: number; count: number; caseRevenue: number }>();
    
    const customerCaseRevenue = new Map<string, number>();
    allCases.forEach(c => {
        if(c.customer_id && c.price && c.price > 0 && c.completed_date) {
            customerCaseRevenue.set(c.customer_id, (customerCaseRevenue.get(c.customer_id) || 0) + c.price);
        }
    });

    activeCustomers.forEach(customer => {
      const type = customer.business_type || 'Annat';
      const current = businessTypeMap.get(type) || { arr: 0, count: 0, caseRevenue: 0 };
      current.arr += customer.annual_premium || 0;
      current.count++;
      current.caseRevenue += customerCaseRevenue.get(customer.id) || 0;
      businessTypeMap.set(type, current);
    });

    return Array.from(businessTypeMap.entries()).map(([business_type, data]) => ({
      business_type,
      arr: data.arr,
      customer_count: data.count,
      average_arr_per_customer: data.count > 0 ? data.arr / data.count : 0,
      additional_case_revenue: data.caseRevenue
    })).sort((a, b) => b.arr - a.arr);
  }

  getPerformanceStats = async (allCustomers: CustomerData[], allCases: CaseData[]): Promise<PerformanceStats> => {
    const normalizeName = (name: string): string => {
        if (!name) return 'okänd';
        return name.includes('@') ? name.split('@')[0].replace(/[._]/g, ' ').toLowerCase() : name.toLowerCase();
    };

    const getDisplayName = (currentName: string, newName: string): string => {
        if (!newName) return currentName;
        if (!currentName || !newName.includes('@')) return newName;
        return currentName;
    };

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const activeCustomers = allCustomers.filter(c => c.is_active);
    const recentCases = allCases.filter(c => c.price && c.price > 0 && c.completed_date && new Date(c.completed_date) >= oneYearAgo);

    const techMap = new Map<string, { displayName: string, contractRevenue: number; caseRevenue: number; contractCount: number; caseCount: number }>();

    activeCustomers.forEach(customer => {
      if (!customer.assigned_account_manager) return;
      const key = normalizeName(customer.assigned_account_manager);
      const current = techMap.get(key) || { displayName: customer.assigned_account_manager, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 };
      current.contractRevenue += customer.annual_premium || 0;
      current.contractCount++;
      current.displayName = getDisplayName(current.displayName, customer.assigned_account_manager);
      techMap.set(key, current);
    });

    recentCases.forEach(c => {
      if (!c.assigned_technician_name) return;
      const key = normalizeName(c.assigned_technician_name);
      const current = techMap.get(key) || { displayName: c.assigned_technician_name, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 };
      current.caseRevenue += c.price || 0;
      current.caseCount++;
      current.displayName = getDisplayName(current.displayName, c.assigned_technician_name);
      techMap.set(key, current);
    });
    
    const byTechnician = Array.from(techMap.values()).map(data => ({
      name: data.displayName,
      contractRevenue: data.contractRevenue,
      caseRevenue: data.caseRevenue,
      totalRevenue: data.contractRevenue + data.caseRevenue,
      contractCount: data.contractCount,
      caseCount: data.caseCount,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const pestMap = new Map<string, { revenue: number, caseCount: number }>();
    recentCases.forEach(c => {
      const pestType = c.pest_type || 'Okänt';
      const current = pestMap.get(pestType) || { revenue: 0, caseCount: 0 };
      current.revenue += c.price || 0;
      current.caseCount++;
      pestMap.set(pestType, current);
    });
    
    const byPestType = Array.from(pestMap.entries()).map(([pestType, data]) => ({ pestType, ...data })).sort((a, b) => b.revenue - a.revenue);
    
    return { byTechnician, byPestType };
  }

  getARRProjections = async (allCustomers: CustomerData[]): Promise<ARRProjection[]> => {
    const activeCustomers = allCustomers.filter(c => c.is_active && c.annual_premium && c.contract_start_date && c.contract_end_date);
    if (activeCustomers.length === 0) return [];

    const projections: ARRProjection[] = [];
    const currentYear = new Date().getFullYear();
    const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);

    for (let i = 0; i < 6; i++) {
        const targetYear = currentYear + i;
        if (targetYear === currentYear) {
            projections.push({ year: targetYear, projectedARR: currentARR, activeContracts: activeCustomers.length });
            continue;
        }

        let totalProjectedRevenueForYear = 0;
        let activeContractsInYear = 0;
        const yearStart = new Date(targetYear, 0, 1);
        const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

        for (const customer of activeCustomers) {
            const contractStart = new Date(customer.contract_start_date!);
            const contractEnd = new Date(customer.contract_end_date!);
            
            if (contractEnd < yearStart || contractStart > yearEnd) continue;

            const dailyRate = (customer.annual_premium || 0) / 365.25;
            const overlapStart = new Date(Math.max(contractStart.getTime(), yearStart.getTime()));
            const overlapEnd = new Date(Math.min(contractEnd.getTime(), yearEnd.getTime()));
            const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

            totalProjectedRevenueForYear += overlapDays * dailyRate;
            activeContractsInYear++;
        }
        projections.push({ year: targetYear, projectedARR: totalProjectedRevenueForYear, activeContracts: activeContractsInYear });
    }
    return projections;
  }

  getMonthlyGrowthAnalysis = async (allCustomers: CustomerData[]): Promise<MonthlyGrowthAnalysis> => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const customersAtStart = allCustomers.filter(c => new Date(c.created_at) < oneMonthAgo);
    const activeAtStart = customersAtStart.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > oneMonthAgo));
    const startARR = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    
    const newCustomers = allCustomers.filter(c => new Date(c.created_at) >= oneMonthAgo && c.is_active);
    const newARR = newCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    
    const churnedCustomers = activeAtStart.filter(startCustomer => {
        const currentStatus = allCustomers.find(c => c.id === startCustomer.id);
        return !currentStatus || !currentStatus.is_active;
    });
    const churnedARR = churnedCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    
    const activeNow = allCustomers.filter(c => c.is_active);
    const endARR = activeNow.reduce((sum, c) => sum + (c.annual_premium || 0), 0);

    return {
      startMRR: startARR / 12,
      newMRR: newARR / 12,
      churnedMRR: churnedARR / 12,
      netChangeMRR: (endARR - startARR) / 12,
      endMRR: endARR / 12,
    };
  }
  
  getUpsellOpportunities = async (allCustomers: CustomerData[], allCases: CaseData[], limit: number = 5): Promise<UpsellOpportunity[]> => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const activeCustomers = allCustomers.filter(c => c.is_active);
    const recentCases = allCases.filter(c => c.price && c.price > 0 && c.completed_date && new Date(c.completed_date) >= sixMonthsAgo);

    const caseRevenueMap = new Map<string, number>();
    for (const c of recentCases) {
      if (c.customer_id) {
          caseRevenueMap.set(c.customer_id, (caseRevenueMap.get(c.customer_id) || 0) + (c.price || 0));
      }
    }

    const opportunities = activeCustomers
      .map(customer => {
        const caseRevenue = caseRevenueMap.get(customer.id) || 0;
        if (caseRevenue === 0 || !customer.annual_premium || !customer.company_name) return null;
        
        return {
          customerId: customer.id,
          companyName: customer.company_name,
          annualPremium: customer.annual_premium,
          caseRevenueLast6Months: caseRevenue,
          caseToArrRatio: caseRevenue / customer.annual_premium
        };
      })
      .filter((opp): opp is UpsellOpportunity => opp !== null);

    return opportunities.sort((a, b) => b.caseToArrRatio - a.caseToArrRatio).slice(0, limit);
  }

  calculateGrowthMetrics = async (allCustomers: CustomerData[], currentARR: number): Promise<{ monthlyGrowth: number }> => {
    const lastMonth = new Date(); 
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const customersActiveLastMonth = allCustomers.filter(c => c.is_active && new Date(c.created_at) <= lastMonth);
    const lastMonthARR = customersActiveLastMonth.reduce((sum, c) => sum + (c.annual_premium || 0), 0);

    const growth = lastMonthARR > 0 ? ((currentARR - lastMonthARR) / lastMonthARR) * 100 : (currentARR > 0 ? 100 : 0);
    return { monthlyGrowth: growth };
  }

  calculateChurnMetrics = (allCustomers: CustomerData[], periodInDays: number): { churnRate: number; netRevenueRetention: number } => {
    const periodStart = new Date(); 
    periodStart.setDate(periodStart.getDate() - periodInDays);

    const customersCreatedBeforePeriod = allCustomers.filter(c => new Date(c.created_at) < periodStart);
    const activeAtStart = customersCreatedBeforePeriod.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > periodStart));
    const activeAtStartIds = new Set(activeAtStart.map(c => c.id));
    
    const currentlyActiveCustomers = new Set(allCustomers.filter(c => c.is_active).map(c => c.id));
    
    const churnedCustomers = activeAtStart.filter(c => !currentlyActiveCustomers.has(c.id));
    
    const churnRate = activeAtStart.length > 0 ? (churnedCustomers.length / activeAtStart.length) * 100 : 0;
    
    const startRevenue = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const remainingCustomersFromCohort = allCustomers.filter(c => activeAtStartIds.has(c.id) && c.is_active);
    const endRevenueFromSameCohort = remainingCustomersFromCohort.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    
    const netRevenueRetention = startRevenue > 0 ? (endRevenueFromSameCohort / startRevenue) * 100 : 100;

    return { churnRate, netRevenueRetention };
  }
  
  calculateRenewalMetrics = (activeCustomers: CustomerData[]): { expiring3Months: number; expiring6Months: number; expiring12Months: number; } => {
    const now = new Date();
    const in3Months = new Date(); in3Months.setMonth(now.getMonth() + 3);
    const in6Months = new Date(); in6Months.setMonth(now.getMonth() + 6);
    const in12Months = new Date(); in12Months.setMonth(now.getMonth() + 12);

    let expiring3Months = 0, expiring6Months = 0, expiring12Months = 0;

    activeCustomers.forEach(customer => {
        if (!customer.contract_end_date) return;
        const endDate = new Date(customer.contract_end_date);
        if (endDate > now) {
            if (endDate <= in3Months) expiring3Months++;
            else if (endDate <= in6Months) expiring6Months++;
            else if (endDate <= in12Months) expiring12Months++;
        }
    });
    return { expiring3Months, expiring6Months, expiring12Months };
  }
}

export const economicStatisticsService = new EconomicStatisticsService();