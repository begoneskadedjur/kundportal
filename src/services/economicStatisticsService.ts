// src/services/economicStatisticsService.ts
import { supabase } from '../lib/supabase'
// Ändra denna import för att använda absolut sökväg istället
import { technicianStatisticsService } from './technicianStatisticsService'
import type { TechnicianStats } from './technicianStatisticsService'

// --- NYA INTERFACES FÖR TILLVÄXT ---
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

// --- BEFINTLIGA INTERFACES (MODIFIERADE) ---
export interface DashboardStats {
  arr: ARRStats
  arrByBusinessType: ARRByBusinessType[]
  yearlyRevenue: YearlyRevenueProjection[]
  technicians: TechnicianStats // Data från den andra servicen
  // Nya tillväxt-KPIer
  growthAnalysis: MonthlyGrowthAnalysis
  upsellOpportunities: UpsellOpportunity[]
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
  // Case-relaterat
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

export interface YearlyRevenueProjection {
  year: number
  yearLabel: string
  contractRevenue: number
  estimatedCaseRevenue: number
  totalRevenue: number
  confidence: 'high' | 'medium' | 'low'
}


class EconomicStatisticsService {

  /**
   * Huvudfunktion som aggregerar all statistik för dashboarden.
   */
  async getDashboardStats(periodInDays: number = 30): Promise<DashboardStats> {
    try {
      // Hämta all data parallellt för maximal prestanda
      const [
        arr, 
        arrByBusinessType, 
        yearlyRevenue, 
        technicians, 
        growthAnalysis, 
        upsellOpportunities
      ] = await Promise.all([
        this.getARRStats(periodInDays),
        this.getARRByBusinessType(),
        this.getYearlyRevenueProjections(),
        technicianStatisticsService.getTechnicianStats(periodInDays), // Anropar den andra servicen
        this.getMonthlyGrowthAnalysis(),
        this.getUpsellOpportunities(5)
      ])

      return {
        arr,
        arrByBusinessType,
        yearlyRevenue,
        technicians,
        growthAnalysis,
        upsellOpportunities
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      throw error
    }
  }

  /**
   * 🆕 Analyserar MRR-rörelsen för den senaste månaden.
   * Visar var tillväxten (och förlusten) kommer ifrån.
   */
  async getMonthlyGrowthAnalysis(): Promise<MonthlyGrowthAnalysis> {
    const today = new Date();
    const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, annual_premium, created_at, is_active, contract_end_date');

    if (error) throw error;

    const allCustomers = customers || [];

    // Kunder skapade FÖRE perioden startade
    const customersAtStart = allCustomers.filter(c => new Date(c.created_at) < oneMonthAgo);
    // Av dessa, vilka var aktiva då?
    const activeAtStart = customersAtStart.filter(c => c.is_active || (c.contract_end_date && new Date(c.contract_end_date) > oneMonthAgo));
    const startARR = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0);

    // Nya kunder som tillkommit under månaden
    const newCustomers = allCustomers.filter(c => new Date(c.created_at) >= oneMonthAgo && c.is_active);
    const newARR = newCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    
    // Kunder som var aktiva vid start men inte längre är det
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

  /**
   * 🆕 Identifierar de bästa möjligheterna för merförsäljning (upsell).
   * Letar efter kunder som betalar mycket för extra-ärenden.
   */
  async getUpsellOpportunities(limit: number = 5): Promise<UpsellOpportunity[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [customerRes, caseRes] = await Promise.all([
        supabase.from('customers').select('id, company_name, annual_premium').eq('is_active', true),
        supabase.from('cases').select('customer_id, price').gt('price', 0).gte('completed_date', sixMonthsAgo.toISOString())
    ]);

    if (customerRes.error) throw customerRes.error;
    if (caseRes.error) throw caseRes.error;

    const customers = customerRes.data || [];
    const cases = caseRes.data || [];

    const caseRevenueMap = new Map<string, number>();
    for (const c of cases) {
      if (c.customer_id) {
        caseRevenueMap.set(c.customer_id, (caseRevenueMap.get(c.customer_id) || 0) + (c.price || 0));
      }
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

  // --- OMARBETADE BEFINTLIGA FUNKTIONER ---

  async getARRStats(periodInDays: number): Promise<ARRStats> {
    const [customersRes, casesRes] = await Promise.all([
        supabase.from('customers').select('id, is_active, annual_premium, created_at, contract_end_date'),
        supabase.from('cases').select('id, price, completed_date').not('price', 'is', null).gt('price', 0)
    ]);
    if (customersRes.error) throw customersRes.error;
    if (casesRes.error) throw casesRes.error;

    const allCustomers = customersRes.data || [];
    const paidCases = casesRes.data || [];
    const activeCustomers = allCustomers.filter(c => c.is_active);

    const currentARR = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const monthlyRecurringRevenue = currentARR / 12;
    const additionalCaseRevenue = paidCases.reduce((sum, c) => sum + (c.price || 0), 0);

    const growthMetrics = await this.calculateGrowthMetrics(currentARR);
    const churnMetrics = await this.calculateChurnMetrics(allCustomers, periodInDays);
    const renewalMetrics = this.calculateRenewalMetrics(activeCustomers);

    const thisMonthStart = new Date(); thisMonthStart.setDate(1);
    const paidCasesThisMonth = paidCases.filter(c => c.completed_date && new Date(c.completed_date) >= thisMonthStart).length;

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

  async getARRByBusinessType(): Promise<ARRByBusinessType[]> {
    const [customersRes, casesRes] = await Promise.all([
      supabase.from('customers').select('id, business_type, annual_premium').eq('is_active', true),
      supabase.from('cases').select('customer_id, price').not('price', 'is', null).gt('price', 0)
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

  async getYearlyRevenueProjections(): Promise<YearlyRevenueProjection[]> {
    // Enkel implementering för att undvika komplex kod
    const currentYear = new Date().getFullYear();
    const { data: customers, error } = await supabase
      .from('customers')
      .select('annual_premium')
      .eq('is_active', true);

    if (error) throw error;

    const currentARR = (customers || []).reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    
    // Skapa enkla projektioner för de närmaste 3 åren
    return [
      {
        year: currentYear,
        yearLabel: `${currentYear}`,
        contractRevenue: currentARR,
        estimatedCaseRevenue: currentARR * 0.2, // Uppskatta att case-intäkter är 20% av ARR
        totalRevenue: currentARR * 1.2,
        confidence: 'high' as const
      },
      {
        year: currentYear + 1,
        yearLabel: `${currentYear + 1}`,
        contractRevenue: currentARR * 1.1, // 10% tillväxt
        estimatedCaseRevenue: currentARR * 0.22,
        totalRevenue: currentARR * 1.32,
        confidence: 'medium' as const
      },
      {
        year: currentYear + 2,
        yearLabel: `${currentYear + 2}`,
        contractRevenue: currentARR * 1.21, // 21% tillväxt över 2 år
        estimatedCaseRevenue: currentARR * 0.24,
        totalRevenue: currentARR * 1.45,
        confidence: 'low' as const
      }
    ];
  }

  // --- PRIVATA HJÄLPMETODER ---

  private async calculateGrowthMetrics(currentARR: number): Promise<{ monthlyGrowth: number }> {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const { data, error } = await supabase
      .from('customers')
      .select('annual_premium')
      .eq('is_active', true)
      .lte('created_at', lastMonth.toISOString());

    if (error) throw error;
    
    const lastMonthARR = (data || []).reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const monthlyGrowth = lastMonthARR > 0 ? ((currentARR - lastMonthARR) / lastMonthARR) * 100 : (currentARR > 0 ? 100 : 0);
    
    return { monthlyGrowth };
  }

  private async calculateChurnMetrics(allCustomers: any[], periodInDays: number): Promise<{ churnRate: number; netRevenueRetention: number }> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodInDays);

    const activeAtStart = allCustomers.filter(c => new Date(c.created_at) < periodStart && c.is_active);
    const churnedInPeriod = activeAtStart.filter(c => !c.is_active);

    const churnRate = activeAtStart.length > 0 ? (churnedInPeriod.length / activeAtStart.length) * 100 : 0;
    
    // Net Revenue Retention
    const startRevenue = activeAtStart.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const churnedRevenue = churnedInPeriod.reduce((sum, c) => sum + (c.annual_premium || 0), 0);
    const endRevenueFromSameCohort = startRevenue - churnedRevenue; // Förenklad version, ignorerar expansion.
    
    const netRevenueRetention = startRevenue > 0 ? (endRevenueFromSameCohort / startRevenue) * 100 : 100;

    return { churnRate, netRevenueRetention };
  }
  
  private calculateRenewalMetrics(activeCustomers: any[]): { expiring3Months: number; expiring6Months: number; expiring12Months: number; } {
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
            if (endDate <= in6Months) expiring6Months++; // Not else-if, a 3-month is also a 6-month
            if (endDate <= in12Months) expiring12Months++;
        }
    });

    return { expiring3Months, expiring6Months: expiring6Months-expiring3Months, expiring12Months: expiring12Months - expiring6Months };
  }
}

export const economicStatisticsService = new EconomicStatisticsService();