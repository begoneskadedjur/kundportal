// src/services/economicStatisticsService.ts - FINAL FIX: Corrects date formatting and 'this' context
import { supabase } from '../lib/supabase';
import { technicianStatisticsService } from './technicianStatisticsService';
import type { TechnicianStats } from './technicianStatisticsService';

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

export interface DashboardStats {
  arr: ARRStats;
  arrByBusinessType: ARRByBusinessType[];
  technicians: TechnicianStats;
  growthAnalysis: MonthlyGrowthAnalysis;
  upsellOpportunities: UpsellOpportunity[];
  performanceStats: PerformanceStats;
  arrProjections: ARRProjection[];
  unitEconomics: UnitEconomics;
}

class EconomicStatisticsService {

  getDashboardStats = async (periodInDays: number = 30): Promise<DashboardStats> => {
    try {
      const arr = await this.getARRStats(periodInDays);
      
      const [
        arrByBusinessType,
        technicians,
        growthAnalysis,
        upsellOpportunities,
        performanceStats,
        arrProjections,
        unitEconomics
      ] = await Promise.all([
        this.getARRByBusinessType(),
        technicianStatisticsService.getTechnicianStats(periodInDays),
        this.getMonthlyGrowthAnalysis(),
        this.getUpsellOpportunities(5),
        this.getPerformanceStats(),
        this.getARRProjections(),
        this.getUnitEconomics(arr)
      ]);

      return {
        arr,
        arrByBusinessType,
        technicians,
        growthAnalysis,
        upsellOpportunities,
        performanceStats,
        arrProjections,
        unitEconomics,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  getUnitEconomics = async (arrStats: ARRStats): Promise<UnitEconomics> => {
    const today = new Date();
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const { data: spendData, error: spendError } = await supabase
      .from('monthly_marketing_spend')
      .select('spend')
      .eq('month', firstDayOfLastMonth.toISOString().split('T')[0]) // FIX: Use YYYY-MM-DD format
      .single();
    
    if (spendError && spendError.code !== 'PGRST116') { // Ignore "no rows found" error
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
    const ltv = arrStats.averageARRPerCustomer / churnRateForLTV;
    const ltvToCacRatio = cac > 0 ? ltv / cac : 0;
    const avgMrrPerCustomer = arrStats.averageARRPerCustomer / 12;
    const paybackPeriodMonths = avgMrrPerCustomer > 0 ? cac / avgMrrPerCustomer : 0;

    return { cac, ltv, ltvToCacRatio, paybackPeriodMonths };
  }

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

    const customerIdToTypeMap = new Map(allCustomers.map(c => [c.id, c.business_type || 'Annat']));
    (allCases || []).forEach(c => {
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

  getPerformanceStats = async (): Promise<PerformanceStats> => {
    const normalizeName = (name: string): string => {
      if (!name) return 'okänd';
      if (name.includes('@')) {
        return name.split('@')[0].replace(/[._]/g, ' ').toLowerCase();
      }
      return name.toLowerCase();
    };

    const getDisplayName = (currentName: string, newName: string): string => {
      if (!newName) return currentName;
      if (!currentName) return newName;
      return !newName.includes('@') ? newName : currentName;
    };

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [customersRes, casesRes] = await Promise.all([
      supabase.from('customers').select('annual_premium, assigned_account_manager').eq('is_active', true),
      supabase.from('cases')
        .select('price, assigned_technician_name, pest_type, completed_date')
        .not('price', 'is', null)
        .gt('price', 0)
        .not('completed_date', 'is', null)
        .gte('completed_date', oneYearAgo.toISOString())
    ]);

    if (customersRes.error) throw customersRes.error;
    if (casesRes.error) throw casesRes.error;

    const techMap = new Map<string, { displayName: string, contractRevenue: number; caseRevenue: number; contractCount: number; caseCount: number }>();

    (customersRes.data || []).forEach(customer => {
      const name = customer.assigned_account_manager;
      if (!name) return;
      const key = normalizeName(name);
      const current = techMap.get(key) || { displayName: name, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 };
      current.contractRevenue += customer.annual_premium || 0;
      current.contractCount++;
      current.displayName = getDisplayName(current.displayName, name);
      techMap.set(key, current);
    });

    (casesRes.data || []).forEach(c => {
      const name = c.assigned_technician_name;
      if (!name) return;
      const key = normalizeName(name);
      const current = techMap.get(key) || { displayName: name, contractRevenue: 0, caseRevenue: 0, contractCount: 0, caseCount: 0 };
      current.caseRevenue += c.price || 0;
      current.caseCount++;
      current.displayName = getDisplayName(current.displayName, name);
      techMap.set(key, current);
    });
    
    const byTechnician = Array.from(techMap.values()).map(data => ({
      name: data.displayName,
      contractRevenue: data.contractRevenue,
      caseRevenue: data.caseRevenue,
      contractCount: data.contractCount,
      caseCount: data.caseCount,
      totalRevenue: data.contractRevenue + data.caseRevenue
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const pestMap = new Map<string, { revenue: number, caseCount: number }>();
    (casesRes.data || []).forEach(c => {
      const pestType = c.pest_type || 'Okänt';
      const current = pestMap.get(pestType) || { revenue: 0, caseCount: 0 };
      current.revenue += c.price || 0;
      current.caseCount++;
      pestMap.set(pestType, current);
    });
    
    const byPestType = Array.from(pestMap.entries()).map(([pestType, data]) => ({ pestType, ...data })).sort((a, b) => b.revenue - a.revenue);
    
    return { byTechnician, byPestType };
  }

  getARRProjections = async (): Promise<ARRProjection[]> => {
    const { data: customers, error } = await supabase
        .from('customers')
        .select('annual_premium, contract_start_date, contract_end_date')
        .eq('is_active', true)
        .not('annual_premium', 'is', null)
        .not('contract_start_date', 'is', null)
        .not('contract_end_date', 'is', null);

    if (error) throw error;
    if (!customers) return [];

    const projections: ARRProjection[] = [];
    const currentYear = new Date().getFullYear();
    const currentARR = customers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);

    for (let i = 0; i < 6; i++) {
        const targetYear = currentYear + i;
        let totalProjectedRevenueForYear = 0;
        let activeContractsInYear = 0;

        if (targetYear === currentYear) {
            totalProjectedRevenueForYear = currentARR;
            activeContractsInYear = customers.length;
        } else {
            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);
            for (const customer of customers) {
                const contractStart = new Date(customer.contract_start_date);
                const contractEnd = new Date(customer.contract_end_date);
                const dailyRate = (customer.annual_premium || 0) / 365.25;
                const overlapStart = new Date(Math.max(contractStart.getTime(), yearStart.getTime()));
                const overlapEnd = new Date(Math.min(contractEnd.getTime(), yearEnd.getTime()));

                if (overlapStart < overlapEnd) {
                    const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
                    totalProjectedRevenueForYear += overlapDays * dailyRate;
                    activeContractsInYear++;
                }
            }
        }
        projections.push({ year: targetYear, projectedARR: totalProjectedRevenueForYear, activeContracts: activeContractsInYear });
    }
    return projections;
  }

  getMonthlyGrowthAnalysis = async (): Promise<MonthlyGrowthAnalysis> => {
    const today = new Date();
    const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, annual_premium, created_at, is_active, contract_end_date');
    if (error) throw error;
    const allCustomers = customers || [];
    const customersAtStart = allCustomers.filter(c => new Date(c.created_at) < oneMonthAgo);
    const activeAtStart = customersAtStart.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > oneMonthAgo));
    const startARR = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const newCustomers = allCustomers.filter(c => new Date(c.created_at) >= oneMonthAgo && c.is_active);
    const newARR = newCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const churnedCustomers = activeAtStart.filter(c => !c.is_active || (c.contract_end_date && new Date(c.contract_end_date) <= today));
    const churnedARR = churnedCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const activeNow = allCustomers.filter(c => c.is_active && (!c.contract_end_date || new Date(c.contract_end_date) > today));
    const endARR = activeNow.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    return {
      startMRR: startARR / 12,
      newMRR: newARR / 12,
      churnedMRR: churnedARR / 12,
      netChangeMRR: (endARR - startARR) / 12,
      endMRR: endARR / 12,
    };
  }

  getUpsellOpportunities = async (limit: number = 5): Promise<UpsellOpportunity[]> => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const [customerRes, caseRes] = await Promise.all([
        supabase.from('customers').select('id, company_name, annual_premium').eq('is_active', true),
        supabase.from('cases').select('customer_id, price, completed_date').gt('price', 0).not('completed_date', 'is', null).gte('completed_date', sixMonthsAgo.toISOString())
    ]);
    if (customerRes.error) throw customerRes.error;
    if (caseRes.error) throw caseRes.error;
    const customers = customerRes.data || [];
    const cases = caseRes.data || [];
    const caseRevenueMap = new Map<string, number>();
    for (const c of cases) {
      if (c.customer_id) caseRevenueMap.set(c.customer_id, (caseRevenueMap.get(c.customer_id) || 0) + (c.price || 0));
    }
    const opportunities = customers
      .map(customer => {
        const caseRevenue = caseRevenueMap.get(customer.id) || 0;
        if (caseRevenue === 0 || !customer.annual_premium) return null;
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

  getARRStats = async (periodInDays: number): Promise<ARRStats> => {
    const [customersRes, casesRes] = await Promise.all([
        supabase.from('customers').select('id, is_active, annual_premium, created_at, contract_end_date'),
        supabase.from('cases').select('id, price, completed_date').not('price', 'is', null).gt('price', 0)
    ]);
    if (customersRes.error) throw customersRes.error;
    if (casesRes.error) throw casesRes.error;
    const allCustomers = customersRes.data || [];
    const paidCases = (casesRes.data || []).filter(c => c.completed_date);
    const activeCustomers = allCustomers.filter(c => c.is_active);
    const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const monthlyRecurringRevenue = currentARR / 12;
    const additionalCaseRevenue = paidCases.reduce((sum, c) => sum + (c.price || 0), 0);
    const growthMetrics = await this.calculateGrowthMetrics(currentARR);
    const churnMetrics = await this.calculateChurnMetrics(allCustomers, periodInDays);
    const renewalMetrics = this.calculateRenewalMetrics(activeCustomers);
    const thisMonthStart = new Date(); thisMonthStart.setDate(1);
    const paidCasesThisMonth = paidCases.filter(c => new Date(c.completed_date!) >= thisMonthStart).length;
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

  getARRByBusinessType = async (): Promise<ARRByBusinessType[]> => {
    const [customersRes, casesRes] = await Promise.all([
      supabase.from('customers').select('id, business_type, annual_premium').eq('is_active', true),
      supabase.from('cases').select('customer_id, price, completed_date').not('price', 'is', null).gt('price', 0).not('completed_date', 'is', null)
    ]);
    if (customersRes.error) throw customersRes.error;
    if (casesRes.error) throw casesRes.error;
    const businessTypeMap = new Map<string, { arr: number; count: number; caseRevenue: number }>();
    const customerCaseRevenue = new Map<string, number>();
    (casesRes.data || []).forEach(c => {
        if(c.customer_id) customerCaseRevenue.set(c.customer_id, (customerCaseRevenue.get(c.customer_id) || 0) + (c.price || 0));
    });
    (customersRes.data || []).forEach(customer => {
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

  calculateGrowthMetrics = async (currentARR: number): Promise<{ monthlyGrowth: number }> => {
    const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const { data, error } = await supabase.from('customers').select('annual_premium').eq('is_active', true).lte('created_at', lastMonth.toISOString());
    if (error) throw error;
    const lastMonthARR = (data || []).reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    return { monthlyGrowth: lastMonthARR > 0 ? ((currentARR - lastMonthARR) / lastMonthARR) * 100 : (currentARR > 0 ? 100 : 0) };
  }

  calculateChurnMetrics = async (allCustomers: any[], periodInDays: number): Promise<{ churnRate: number; netRevenueRetention: number }> => {
    const periodStart = new Date(); periodStart.setDate(periodStart.getDate() - periodInDays);
    const activeAtStart = allCustomers.filter(c => new Date(c.created_at) < periodStart && c.is_active);
    const churnedInPeriod = activeAtStart.filter(c => !c.is_active);
    const churnRate = activeAtStart.length > 0 ? (churnedInPeriod.length / activeAtStart.length) * 100 : 0;
    const startRevenue = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const churnedRevenue = churnedInPeriod.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const endRevenueFromSameCohort = startRevenue - churnedRevenue;
    const netRevenueRetention = startRevenue > 0 ? (endRevenueFromSameCohort / startRevenue) * 100 : 100;
    return { churnRate, netRevenueRetention };
  }
  
  calculateRenewalMetrics = (activeCustomers: any[]): { expiring3Months: number; expiring6Months: number; expiring12Months: number; } => {
    const now = new Date();
    const in3Months = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const in6Months = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const in12Months = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    let expiring3Months = 0, expiring6Months = 0, expiring12Months = 0;
    activeCustomers.forEach(customer => {
        if (!customer.contract_end_date) return;
        const endDate = new Date(customer.contract_end_date);
        if (endDate > now) {
            if (endDate <= in3Months) expiring3Months++;
            if (endDate > in3Months && endDate <= in6Months) expiring6Months++;
            if (endDate > in6Months && endDate <= in12Months) expiring12Months++;
        }
    });
    return { expiring3Months, expiring6Months, expiring12Months };
  }
}

export const economicStatisticsService = new EconomicStatisticsService();