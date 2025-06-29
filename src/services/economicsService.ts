// 📁 src/services/economicsService.ts
import { supabase } from '../lib/supabase'

// Types för ekonomisk data
export interface MonthlyRevenue {
  month: string
  contract_revenue: number
  case_revenue: number
  total_revenue: number
}

export interface ExpiringContract {
  customer_id: number
  company_name: string
  contract_end_date: string
  annual_premium: number
  assigned_account_manager: string
  months_remaining: number
  risk_level: 'high' | 'medium' | 'low'
}

export interface TechnicianRevenue {
  technician_name: string
  technician_email: string
  cases_completed: number
  total_revenue: number
  avg_case_value: number
  completion_rate: number
}

export interface AccountManagerRevenue {
  account_manager: string
  customers_count: number
  total_contract_value: number
  annual_revenue: number
  avg_contract_value: number
}

export interface MarketingSpend {
  month: string
  spend: number
  new_customers: number
  cac: number // Customer Acquisition Cost
}

export interface CaseEconomy {
  avg_case_price: number
  avg_completion_days: number
  total_cases_this_month: number
  total_revenue_this_month: number
  ongoing_cases_count: number
  ongoing_potential_revenue: number
  case_types: Array<{
    case_type: string
    count: number
    avg_price: number
    total_revenue: number
  }>
}

export interface CustomerContract {
  id: number
  company_name: string
  business_type: string
  contract_type_name: string
  annual_premium: number
  total_contract_value: number
  contract_start_date: string
  contract_end_date: string
  contract_length_months: number
  assigned_account_manager: string
  contract_status: string
  days_remaining: number
}

export interface KpiData {
  total_arr: number
  monthly_recurring_revenue: number
  active_customers: number
  total_case_revenue_ytd: number
  avg_customer_value: number
  churn_risk_customers: number
}

// 1. KPI Data - Huvudstatistik
export const getKpiData = async (): Promise<KpiData> => {
  try {
    // ARR från aktiva kunder
    const { data: arrData } = await supabase
      .from('customers')
      .select('annual_premium')
      .eq('is_active', true)
      .eq('contract_status', 'active')

    const total_arr = arrData?.reduce((sum, c) => sum + (c.annual_premium || 0), 0) || 0
    const monthly_recurring_revenue = total_arr / 12
    const active_customers = arrData?.length || 0
    const avg_customer_value = active_customers > 0 ? total_arr / active_customers : 0

    // Ärendeintäkter i år
    const currentYear = new Date().getFullYear()
    const { data: caseData } = await supabase
      .from('cases')
      .select('price')
      .gte('completed_date', `${currentYear}-01-01`)
      .lte('completed_date', `${currentYear}-12-31`)
      .not('completed_date', 'is', null)

    const total_case_revenue_ytd = caseData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0

    // Churn risk (avtal som löper ut inom 90 dagar)
    const { data: churnData } = await supabase
      .from('customers')
      .select('id')
      .eq('is_active', true)
      .gte('contract_end_date', new Date().toISOString())
      .lte('contract_end_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())

    const churn_risk_customers = churnData?.length || 0

    return {
      total_arr,
      monthly_recurring_revenue,
      active_customers,
      total_case_revenue_ytd,
      avg_customer_value,
      churn_risk_customers
    }
  } catch (error) {
    console.error('Error fetching KPI data:', error)
    throw error
  }
}

// 2. Månadsvis intäktsflöde
export const getMonthlyRevenue = async (): Promise<MonthlyRevenue[]> => {
  try {
    // Hämta alla kunder för kontraktsintäkter
    const { data: customers } = await supabase
      .from('customers')
      .select('annual_premium, contract_start_date, contract_end_date, is_active')
      .eq('is_active', true)

    // Hämta ärendeintäkter per månad (senaste 12 månaderna)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data: cases } = await supabase
      .from('cases')
      .select('price, completed_date')
      .gte('completed_date', twelveMonthsAgo.toISOString())
      .not('completed_date', 'is', null)

    // Beräkna intäkter per månad
    const monthlyData: { [key: string]: MonthlyRevenue } = {}
    
    // Senaste 12 månader
    for (let i = 11; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().slice(0, 7) // YYYY-MM
      
      monthlyData[monthKey] = {
        month: monthKey,
        contract_revenue: 0,
        case_revenue: 0,
        total_revenue: 0
      }
    }

    // Lägg till kontraktsintäkter (fördelat per månad)
    customers?.forEach(customer => {
      const monthlyContractRevenue = (customer.annual_premium || 0) / 12
      Object.keys(monthlyData).forEach(month => {
        monthlyData[month].contract_revenue += monthlyContractRevenue
      })
    })

    // Lägg till ärendeintäkter
    cases?.forEach(case_ => {
      if (case_.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].case_revenue += case_.price || 0
        }
      }
    })

    // Beräkna totaler
    Object.values(monthlyData).forEach(month => {
      month.total_revenue = month.contract_revenue + month.case_revenue
    })

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month))
  } catch (error) {
    console.error('Error fetching monthly revenue:', error)
    throw error
  }
}

// 3. Utgående avtal
export const getExpiringContracts = async (): Promise<ExpiringContract[]> => {
  try {
    const { data } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        contract_end_date,
        annual_premium,
        assigned_account_manager
      `)
      .eq('is_active', true)
      .gte('contract_end_date', new Date().toISOString())
      .order('contract_end_date')

    return data?.map(customer => {
      const endDate = new Date(customer.contract_end_date)
      const now = new Date()
      const diffTime = endDate.getTime() - now.getTime()
      const months_remaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))
      
      let risk_level: 'high' | 'medium' | 'low' = 'low'
      if (months_remaining <= 3) risk_level = 'high'
      else if (months_remaining <= 6) risk_level = 'medium'

      return {
        customer_id: customer.id,
        company_name: customer.company_name,
        contract_end_date: customer.contract_end_date,
        annual_premium: customer.annual_premium || 0,
        assigned_account_manager: customer.assigned_account_manager || 'Ej tilldelad',
        months_remaining,
        risk_level
      }
    }) || []
  } catch (error) {
    console.error('Error fetching expiring contracts:', error)
    throw error
  }
}

// 4. Tekniker-intäkter
export const getTechnicianRevenue = async (): Promise<TechnicianRevenue[]> => {
  try {
    const { data } = await supabase
      .from('cases')
      .select('assigned_technician_name, assigned_technician_email, price, status, completed_date')
      .not('assigned_technician_name', 'is', null)

    const technicianStats: { [key: string]: any } = {}

    data?.forEach(case_ => {
      const name = case_.assigned_technician_name
      if (!name) return

      if (!technicianStats[name]) {
        technicianStats[name] = {
          technician_name: name,
          technician_email: case_.assigned_technician_email || '',
          cases_total: 0,
          cases_completed: 0,
          total_revenue: 0,
          avg_case_value: 0,
          completion_rate: 0
        }
      }

      technicianStats[name].cases_total++
      
      if (case_.completed_date) {
        technicianStats[name].cases_completed++
        technicianStats[name].total_revenue += case_.price || 0
      }
    })

    return Object.values(technicianStats).map((tech: any) => ({
      ...tech,
      avg_case_value: tech.cases_completed > 0 ? tech.total_revenue / tech.cases_completed : 0,
      completion_rate: tech.cases_total > 0 ? (tech.cases_completed / tech.cases_total) * 100 : 0
    })).sort((a, b) => b.total_revenue - a.total_revenue)
  } catch (error) {
    console.error('Error fetching technician revenue:', error)
    throw error
  }
}

// 5. Account Manager-intäkter
export const getAccountManagerRevenue = async (): Promise<AccountManagerRevenue[]> => {
  try {
    const { data } = await supabase
      .from('customers')
      .select('assigned_account_manager, annual_premium, total_contract_value')
      .eq('is_active', true)
      .not('assigned_account_manager', 'is', null)

    const managerStats: { [key: string]: any } = {}

    data?.forEach(customer => {
      const manager = customer.assigned_account_manager
      if (!manager) return

      if (!managerStats[manager]) {
        managerStats[manager] = {
          account_manager: manager,
          customers_count: 0,
          total_contract_value: 0,
          annual_revenue: 0,
          avg_contract_value: 0
        }
      }

      managerStats[manager].customers_count++
      managerStats[manager].total_contract_value += customer.total_contract_value || 0
      managerStats[manager].annual_revenue += customer.annual_premium || 0
    })

    return Object.values(managerStats).map((manager: any) => ({
      ...manager,
      avg_contract_value: manager.customers_count > 0 ? manager.total_contract_value / manager.customers_count : 0
    })).sort((a, b) => b.annual_revenue - a.annual_revenue)
  } catch (error) {
    console.error('Error fetching account manager revenue:', error)
    throw error
  }
}

// 6. Marknadsföringskostnader och CAC
export const getMonthlyMarketingSpend = async (): Promise<MarketingSpend[]> => {
  try {
    // Hämta marknadsföringskostnader
    const { data: spendData } = await supabase
      .from('monthly_marketing_spend')
      .select('month, spend')
      .order('month')

    // Hämta nya kunder per månad
    const { data: customerData } = await supabase
      .from('customers')
      .select('created_at')
      .order('created_at')

    const monthlyStats: { [key: string]: MarketingSpend } = {}

    // Initiera med marknadsföringskostnader
    spendData?.forEach(item => {
      const month = item.month.slice(0, 7) // YYYY-MM
      monthlyStats[month] = {
        month,
        spend: item.spend || 0,
        new_customers: 0,
        cac: 0
      }
    })

    // Lägg till nya kunder
    customerData?.forEach(customer => {
      const month = customer.created_at.slice(0, 7)
      if (monthlyStats[month]) {
        monthlyStats[month].new_customers++
      }
    })

    // Beräkna CAC
    Object.values(monthlyStats).forEach(month => {
      month.cac = month.new_customers > 0 ? month.spend / month.new_customers : 0
    })

    return Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month))
  } catch (error) {
    console.error('Error fetching marketing spend:', error)
    throw error
  }
}

// 7. Ärendeekonomi
export const getCaseEconomy = async (): Promise<CaseEconomy> => {
  try {
    console.log('🔍 getCaseEconomy: Starting query...')
    const currentMonth = new Date().toISOString().slice(0, 7)
    console.log('📅 Current month:', currentMonth)
    
    // Hämta alla ärenden för denna månad
    const { data: allCases, error } = await supabase
      .from('cases')
      .select('price, case_type, created_at, completed_date')
      .or(`and(created_at.gte.${currentMonth}-01,created_at.lt.${currentMonth}-32),and(completed_date.gte.${currentMonth}-01,completed_date.lt.${currentMonth}-32)`)

    if (error) {
      console.error('❌ Supabase error in getCaseEconomy:', error)
      throw error
    }

    console.log('📊 Raw cases data:', { 
      total_cases: allCases?.length || 0,
      sample: allCases?.slice(0, 3) 
    })

    // Separera avslutade och pågående ärenden
    const completedCases = allCases?.filter(c => c.completed_date && c.price && c.price > 0) || []
    const ongoingCases = allCases?.filter(c => !c.completed_date && c.price && c.price > 0) || []
    
    console.log('🔢 Processed cases:', {
      completed: completedCases.length,
      ongoing: ongoingCases.length,
      completed_sample: completedCases.slice(0, 2),
      ongoing_sample: ongoingCases.slice(0, 2)
    })
    
    // Beräkningar baserat på ENDAST avslutade ärenden för säkra intäkter
    const avg_case_price = completedCases.length > 0 
      ? completedCases.reduce((sum, c) => sum + (c.price || 0), 0) / completedCases.length 
      : 0

    const avg_completion_days = completedCases.length > 0
      ? completedCases.reduce((sum, c) => {
          const created = new Date(c.created_at)
          const completed = new Date(c.completed_date!)
          const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / completedCases.length
      : 0

    const total_cases_this_month = completedCases.length
    const total_revenue_this_month = completedCases.reduce((sum, c) => sum + (c.price || 0), 0)

    // Gruppera per ärendetype (ENDAST avslutade)
    const caseTypeStats: { [key: string]: any } = {}
    completedCases.forEach(case_ => {
      const type = case_.case_type || 'Okänt'
      if (!caseTypeStats[type]) {
        caseTypeStats[type] = {
          case_type: type,
          count: 0,
          total_revenue: 0,
          avg_price: 0
        }
      }
      caseTypeStats[type].count++
      caseTypeStats[type].total_revenue += case_.price || 0
    })

    // Lägg till pågående ärenden data för "Mest lönsam" kortets alternativa visning
    const ongoingRevenue = ongoingCases.reduce((sum, c) => sum + (c.price || 0), 0)
    const ongoingCount = ongoingCases.length

    const case_types = Object.values(caseTypeStats).map((type: any) => ({
      ...type,
      avg_price: type.count > 0 ? type.total_revenue / type.count : 0
    }))

    const result = {
      avg_case_price,
      avg_completion_days,
      total_cases_this_month,
      total_revenue_this_month,
      case_types,
      // Lägg till pågående ärenden data
      ongoing_cases_count: ongoingCount,
      ongoing_potential_revenue: ongoingRevenue
    }

    console.log('✅ getCaseEconomy result:', result)
    return result
  } catch (error) {
    console.error('💥 Error in getCaseEconomy:', error)
    throw error
  }
}

// 8. Detaljerad avtalslista
export const getCustomerContracts = async (): Promise<CustomerContract[]> => {
  try {
    const { data } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        business_type,
        annual_premium,
        total_contract_value,
        contract_start_date,
        contract_end_date,
        contract_length_months,
        assigned_account_manager,
        contract_status,
        contract_types(name)
      `)
      .eq('is_active', true)
      .order('contract_end_date')

    return data?.map(customer => {
      const endDate = new Date(customer.contract_end_date)
      const now = new Date()
      const days_remaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: customer.id,
        company_name: customer.company_name,
        business_type: customer.business_type || '',
        contract_type_name: (customer.contract_types as any)?.name || 'Okänt',
        annual_premium: customer.annual_premium || 0,
        total_contract_value: customer.total_contract_value || 0,
        contract_start_date: customer.contract_start_date,
        contract_end_date: customer.contract_end_date,
        contract_length_months: customer.contract_length_months || 12,
        assigned_account_manager: customer.assigned_account_manager || 'Ej tilldelad',
        contract_status: customer.contract_status || 'active',
        days_remaining
      }
    }) || []
  } catch (error) {
    console.error('Error fetching customer contracts:', error)
    throw error
  }
}