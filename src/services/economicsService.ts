// 📁 src/services/economicsService.ts - UPPDATERAD med BeGone ärendeintäkter
import { supabase } from '../lib/supabase'

// Types för ekonomisk data
export interface MonthlyRevenue {
  month: string
  contract_revenue: number
  case_revenue: number
  begone_revenue: number  // 🆕 Ny: BeGone ärendeintäkter
  total_revenue: number
}

export interface ExpiringContract {
  customer_id: string
  company_name: string
  contract_end_date: string
  annual_value: number
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
  // 🆕 BeGone ärendestatistik
  begone_cases_this_month: number
  begone_revenue_this_month: number
  begone_avg_case_price: number
  case_types: Array<{
    case_type: string
    count: number
    avg_price: number
    total_revenue: number
  }>
}

// 🆕 Ny: BeGone ärendestatistik per månad
export interface BeGoneMonthlyStats {
  month: string
  private_cases_count: number
  business_cases_count: number
  private_revenue: number
  business_revenue: number
  total_begone_revenue: number
  total_begone_cases: number
  avg_case_value: number
}

export interface CustomerContract {
  id: string
  company_name: string
  business_type: string
  contract_type_name: string
  annual_value: number
  total_contract_value: number
  contract_start_date: string
  contract_end_date: string
  contract_length: string
  assigned_account_manager: string
  contract_status: string
  days_remaining: number
}

export interface KpiData {
  total_arr: number
  monthly_recurring_revenue: number
  active_customers: number
  total_case_revenue_ytd: number
  total_begone_revenue_ytd: number  // 🆕 Ny: BeGone intäkter året
  avg_customer_value: number
  churn_risk_customers: number
}

// 1. KPI Data - Huvudstatistik med BeGone ärendeintäkter
export const getKpiData = async (): Promise<KpiData> => {
  try {
    // ARR från aktiva kunder
    const { data: arrData } = await supabase
      .from('customers')
      .select('annual_value')
      .eq('is_active', true)
      .eq('contract_status', 'signed')

    const total_arr = arrData?.reduce((sum, c) => sum + (c.annual_value || 0), 0) || 0
    const monthly_recurring_revenue = total_arr / 12
    const active_customers = arrData?.length || 0
    const avg_customer_value = active_customers > 0 ? total_arr / active_customers : 0

    // Avtalskunder ärendeintäkter i år
    const currentYear = new Date().getFullYear()
    const { data: caseData } = await supabase
      .from('cases')
      .select('price')
      .gte('completed_date', `${currentYear}-01-01`)
      .lte('completed_date', `${currentYear}-12-31`)
      .not('completed_date', 'is', null)

    const total_case_revenue_ytd = caseData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0

    // 🆕 BeGone ärendeintäkter i år (både privat och företag)
    const { data: privateData } = await supabase
      .from('private_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', `${currentYear}-01-01`)
      .lte('completed_date', `${currentYear}-12-31`)
      .not('completed_date', 'is', null)

    const { data: businessData } = await supabase
      .from('business_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', `${currentYear}-01-01`)
      .lte('completed_date', `${currentYear}-12-31`)
      .not('completed_date', 'is', null)

    const private_revenue = privateData?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
    const business_revenue = businessData?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
    const total_begone_revenue_ytd = private_revenue + business_revenue

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
      total_begone_revenue_ytd,  // 🆕 Ny
      avg_customer_value,
      churn_risk_customers
    }
  } catch (error) {
    console.error('Error fetching KPI data:', error)
    throw error
  }
}

// 2. Månadsvis intäktsflöde med BeGone ärendeintäkter
export const getMonthlyRevenue = async (): Promise<MonthlyRevenue[]> => {
  try {
    // Hämta alla kunder för kontraktsintäkter
    const { data: customers } = await supabase
      .from('customers')
      .select('annual_value, contract_start_date, contract_end_date, is_active')
      .eq('is_active', true)

    // Senaste 12 månader
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    // Avtalskunder ärendeintäkter
    const { data: cases } = await supabase
      .from('cases')
      .select('price, completed_date')
      .gte('completed_date', twelveMonthsAgo.toISOString())
      .not('completed_date', 'is', null)

    // 🆕 BeGone privatpersoner ärendeintäkter
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('pris, completed_date')
      .eq('status', 'Avslutat')
      .gte('completed_date', twelveMonthsAgo.toISOString().split('T')[0])
      .not('completed_date', 'is', null)

    // 🆕 BeGone företag ärendeintäkter
    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('pris, completed_date')
      .eq('status', 'Avslutat')
      .gte('completed_date', twelveMonthsAgo.toISOString().split('T')[0])
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
        begone_revenue: 0,  // 🆕 Ny
        total_revenue: 0
      }
    }

    // Lägg till kontraktsintäkter (fördelat per månad)
    customers?.forEach(customer => {
      const monthlyContractRevenue = (customer.annual_value || 0) / 12
      Object.keys(monthlyData).forEach(month => {
        monthlyData[month].contract_revenue += monthlyContractRevenue
      })
    })

    // Lägg till avtalskunder ärendeintäkter
    cases?.forEach(case_ => {
      if (case_.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].case_revenue += case_.price || 0
        }
      }
    })

    // 🆕 Lägg till BeGone privatpersoner ärendeintäkter
    privateCases?.forEach(case_ => {
      if (case_.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].begone_revenue += case_.pris || 0
        }
      }
    })

    // 🆕 Lägg till BeGone företag ärendeintäkter
    businessCases?.forEach(case_ => {
      if (case_.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].begone_revenue += case_.pris || 0
        }
      }
    })

    // Beräkna totaler
    Object.values(monthlyData).forEach(month => {
      month.total_revenue = month.contract_revenue + month.case_revenue + month.begone_revenue
    })

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month))
  } catch (error) {
    console.error('Error fetching monthly revenue:', error)
    throw error
  }
}

// 🆕 3. BeGone ärendestatistik per månad
export const getBeGoneMonthlyStats = async (): Promise<BeGoneMonthlyStats[]> => {
  try {
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const dateString = twelveMonthsAgo.toISOString().split('T')[0]

    // Hämta avslutade privatpersonsärenden
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('pris, completed_date')
      .eq('status', 'Avslutat')
      .gte('completed_date', dateString)
      .not('completed_date', 'is', null)

    // Hämta avslutade företagsärenden
    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('pris, completed_date')
      .eq('status', 'Avslutat')
      .gte('completed_date', dateString)
      .not('completed_date', 'is', null)

    // Gruppera per månad
    const monthlyStats: { [key: string]: BeGoneMonthlyStats } = {}
    
    // Skapa tomma månader för senaste 12 månaderna
    for (let i = 11; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().slice(0, 7)
      
      monthlyStats[monthKey] = {
        month: monthKey,
        private_cases_count: 0,
        business_cases_count: 0,
        private_revenue: 0,
        business_revenue: 0,
        total_begone_revenue: 0,
        total_begone_cases: 0,
        avg_case_value: 0
      }
    }

    // Lägg till privatpersonsdata
    privateCases?.forEach(case_ => {
      if (case_.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].private_cases_count++
          monthlyStats[monthKey].private_revenue += case_.pris || 0
        }
      }
    })

    // Lägg till företagsdata
    businessCases?.forEach(case_ => {
      if (case_.completed_date) {
        const monthKey = case_.completed_date.slice(0, 7)
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].business_cases_count++
          monthlyStats[monthKey].business_revenue += case_.pris || 0
        }
      }
    })

    // Beräkna totaler och genomsnitt
    Object.values(monthlyStats).forEach(month => {
      month.total_begone_revenue = month.private_revenue + month.business_revenue
      month.total_begone_cases = month.private_cases_count + month.business_cases_count
      month.avg_case_value = month.total_begone_cases > 0 
        ? month.total_begone_revenue / month.total_begone_cases 
        : 0
    })

    return Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month))
  } catch (error) {
    console.error('Error fetching BeGone monthly stats:', error)
    throw error
  }
}

// 4. Uppdaterad ärendeekonomi med BeGone data
export const getCaseEconomy = async (): Promise<CaseEconomy> => {
  try {
    console.log('🔍 getCaseEconomy: Starting query...')
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
    const monthEnd = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`

    console.log('📅 Query period:', { monthStart, monthEnd })

    // Avtalskunder ärenden denna månad
    const { data: completedCases } = await supabase
      .from('cases')
      .select('price, completed_date, created_at, case_type')
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)
      .not('completed_date', 'is', null)

    const { data: ongoingCases } = await supabase
      .from('cases')
      .select('price')
      .is('completed_date', null)

    // 🆕 BeGone ärenden denna månad
    const { data: completedPrivateCases } = await supabase
      .from('private_cases')
      .select('pris, completed_date, created_at')
      .eq('status', 'Avslutat')
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)
      .not('completed_date', 'is', null)

    const { data: completedBusinessCases } = await supabase
      .from('business_cases')
      .select('pris, completed_date, created_at')
      .eq('status', 'Avslutat')
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)
      .not('completed_date', 'is', null)

    console.log('📊 Data fetched:', {
      completedCases: completedCases?.length || 0,
      completedPrivateCases: completedPrivateCases?.length || 0,
      completedBusinessCases: completedBusinessCases?.length || 0,
      ongoingCases: ongoingCases?.length || 0
    })

    // Beräkna avtalskunder statistik
    const avg_case_price = completedCases && completedCases.length > 0
      ? completedCases.reduce((sum, c) => sum + (c.price || 0), 0) / completedCases.length 
      : 0

    const avg_completion_days = completedCases && completedCases.length > 0
      ? completedCases.reduce((sum, c) => {
          const created = new Date(c.created_at)
          const completed = new Date(c.completed_date!)
          const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / completedCases.length
      : 0

    const total_cases_this_month = (completedCases?.length || 0)
    const total_revenue_this_month = completedCases?.reduce((sum, c) => sum + (c.price || 0), 0) || 0

    // 🆕 BeGone statistik
    const begone_cases_this_month = (completedPrivateCases?.length || 0) + (completedBusinessCases?.length || 0)
    const begone_private_revenue = completedPrivateCases?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
    const begone_business_revenue = completedBusinessCases?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
    const begone_revenue_this_month = begone_private_revenue + begone_business_revenue
    const begone_avg_case_price = begone_cases_this_month > 0 
      ? begone_revenue_this_month / begone_cases_this_month 
      : 0

    // Gruppera avtalskunder per ärendetype
    const caseTypeStats: { [key: string]: any } = {}
    completedCases?.forEach(case_ => {
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

    // 🆕 Lägg till BeGone som ärendetyper
    if (begone_cases_this_month > 0) {
      caseTypeStats['BeGone Privatperson'] = {
        case_type: 'BeGone Privatperson',
        count: completedPrivateCases?.length || 0,
        total_revenue: begone_private_revenue,
        avg_price: completedPrivateCases?.length ? begone_private_revenue / completedPrivateCases.length : 0
      }
      
      caseTypeStats['BeGone Företag'] = {
        case_type: 'BeGone Företag',
        count: completedBusinessCases?.length || 0,
        total_revenue: begone_business_revenue,
        avg_price: completedBusinessCases?.length ? begone_business_revenue / completedBusinessCases.length : 0
      }
    }

    const ongoingRevenue = ongoingCases?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
    const ongoingCount = ongoingCases?.length || 0

    const case_types = Object.values(caseTypeStats).map((type: any) => ({
      ...type,
      avg_price: type.count > 0 ? type.total_revenue / type.count : 0
    }))

    const result = {
      avg_case_price,
      avg_completion_days,
      total_cases_this_month,
      total_revenue_this_month,
      ongoing_cases_count: ongoingCount,
      ongoing_potential_revenue: ongoingRevenue,
      // 🆕 BeGone statistik
      begone_cases_this_month,
      begone_revenue_this_month,
      begone_avg_case_price,
      case_types
    }

    console.log('✅ getCaseEconomy result:', result)
    return result
  } catch (error) {
    console.error('💥 Error in getCaseEconomy:', error)
    throw error
  }
}

// Återstående funktioner behålls oförändrade...
export const getExpiringContracts = async (): Promise<ExpiringContract[]> => {
  try {
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    const { data } = await supabase
      .from('customers')
      .select('id, company_name, contract_end_date, annual_value, assigned_account_manager')
      .eq('is_active', true)
      .lte('contract_end_date', threeMonthsFromNow.toISOString())
      .gte('contract_end_date', new Date().toISOString())
      .order('contract_end_date')

    return data?.map(customer => {
      const endDate = new Date(customer.contract_end_date)
      const now = new Date()
      const months_remaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
      
      return {
        customer_id: customer.id,
        company_name: customer.company_name,
        contract_end_date: customer.contract_end_date,
        annual_value: customer.annual_value || 0,
        assigned_account_manager: customer.assigned_account_manager || 'Ej tilldelad',
        months_remaining,
        risk_level: months_remaining <= 1 ? 'high' : months_remaining <= 2 ? 'medium' : 'low'
      }
    }) || []
  } catch (error) {
    console.error('Error fetching expiring contracts:', error)
    throw error
  }
}

export const getTechnicianRevenue = async (): Promise<TechnicianRevenue[]> => {
  try {
    // Hämta aktiva tekniker från technicians-tabellen
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, email, is_active')
      .eq('is_active', true)

    if (techError) throw techError
    if (!technicians?.length) return []

    // Hämta data från alla tre ärendekällor parallellt per tekniker
    const results = await Promise.all(
      technicians.map(async (tech) => {
        const [privateRes, businessRes, contractRes] = await Promise.all([
          supabase
            .from('private_cases')
            .select('pris')
            .eq('primary_assignee_id', tech.id)
            .eq('status', 'Avslutat')
            .not('pris', 'is', null),
          supabase
            .from('business_cases')
            .select('pris')
            .eq('primary_assignee_id', tech.id)
            .eq('status', 'Avslutat')
            .not('pris', 'is', null),
          supabase
            .from('cases')
            .select('price')
            .eq('assigned_technician_id', tech.id)
            .in('status', ['Avslutat', 'Genomförd', 'Klar'])
            .not('price', 'is', null)
        ])

        const privateRevenue = (privateRes.data || []).reduce((sum, c) => sum + (c.pris || 0), 0)
        const businessRevenue = (businessRes.data || []).reduce((sum, c) => sum + (c.pris || 0), 0)
        const contractRevenue = (contractRes.data || []).reduce((sum, c) => sum + (c.price || 0), 0)

        const total_revenue = privateRevenue + businessRevenue + contractRevenue
        const cases_completed = (privateRes.data?.length || 0) + (businessRes.data?.length || 0) + (contractRes.data?.length || 0)

        return {
          technician_name: tech.name,
          technician_email: tech.email || '',
          cases_completed,
          total_revenue,
          avg_case_value: cases_completed > 0 ? total_revenue / cases_completed : 0,
          completion_rate: 100
        }
      })
    )

    return results
      .filter(t => t.cases_completed > 0 || t.total_revenue > 0)
      .sort((a, b) => b.total_revenue - a.total_revenue)
  } catch (error) {
    console.error('Error fetching technician revenue:', error)
    throw error
  }
}

export const getAccountManagerRevenue = async (): Promise<AccountManagerRevenue[]> => {
  try {
    const { data } = await supabase
      .from('customers')
      .select('assigned_account_manager, annual_value, total_contract_value')
      .eq('is_active', true)
      .not('assigned_account_manager', 'is', null)

    const managerStats: { [key: string]: any } = {}

    data?.forEach(customer => {
      const manager = customer.assigned_account_manager
      
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
      managerStats[manager].annual_revenue += customer.annual_value || 0
    })

    return Object.values(managerStats).map((manager: any) => ({
      ...manager,
      avg_contract_value: manager.customers_count > 0 
        ? manager.total_contract_value / manager.customers_count 
        : 0
    })).sort((a, b) => b.annual_revenue - a.total_revenue)
  } catch (error) {
    console.error('Error fetching account manager revenue:', error)
    throw error
  }
}

export const getMarketingSpend = async (): Promise<MarketingSpend[]> => {
  try {
    const { data: spendData } = await supabase
      .from('monthly_marketing_spend')
      .select('month, spend')
      .order('month')

    const { data: customerData } = await supabase
      .from('customers')
      .select('created_at')
      .eq('is_active', true)

    const monthlyStats: { [key: string]: MarketingSpend } = {}

    spendData?.forEach(spend => {
      const month = spend.month.slice(0, 7)
      monthlyStats[month] = {
        month,
        spend: spend.spend,
        new_customers: 0,
        cac: 0
      }
    })

    customerData?.forEach(customer => {
      const month = customer.created_at.slice(0, 7)
      if (monthlyStats[month]) {
        monthlyStats[month].new_customers++
      }
    })

    Object.values(monthlyStats).forEach(month => {
      month.cac = month.new_customers > 0 ? month.spend / month.new_customers : 0
    })

    return Object.values(monthlyStats)
      .filter(month => month.spend > 0 || month.new_customers > 0)
      .sort((a, b) => a.month.localeCompare(b.month))
  } catch (error) {
    console.error('Error fetching marketing spend:', error)
    throw error
  }
}

// Artikelintäkter - Hämta intäkter per artikel från case_billing_items
export interface ArticleRevenueItem {
  article_id: string
  article_name: string
  article_code: string
  category: string
  total_quantity: number
  total_revenue: number
  cases_used: number
  avg_unit_price: number
}

export const getArticleRevenueBreakdown = async (startDate: string, endDate: string): Promise<ArticleRevenueItem[]> => {
  try {
    const { data, error } = await supabase
      .from('case_billing_items')
      .select(`
        article_id,
        article_name,
        quantity,
        total_price,
        unit_price,
        case_id,
        articles(code, category)
      `)
      .in('status', ['approved', 'billed'])
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error) throw error
    if (!data || data.length === 0) return []

    // Gruppera per artikel
    const articleStats: { [key: string]: ArticleRevenueItem } = {}

    data.forEach((item: any) => {
      const id = item.article_id || 'unknown'
      if (!articleStats[id]) {
        articleStats[id] = {
          article_id: id,
          article_name: item.article_name || 'Okänd artikel',
          article_code: item.articles?.code || '',
          category: item.articles?.category || 'Övrigt',
          total_quantity: 0,
          total_revenue: 0,
          cases_used: 0,
          avg_unit_price: 0
        }
      }
      articleStats[id].total_quantity += item.quantity || 0
      articleStats[id].total_revenue += item.total_price || 0
      articleStats[id].cases_used++
    })

    // Beräkna snitt och sortera
    return Object.values(articleStats)
      .map(a => ({
        ...a,
        avg_unit_price: a.total_quantity > 0 ? a.total_revenue / a.total_quantity : 0
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
  } catch (error) {
    console.error('Error fetching article revenue breakdown:', error)
    return []
  }
}

// Prislisteutilisering - Vilka kunder har prislistor
export interface PriceListUtilizationData {
  totalActiveCustomers: number
  customersWithPriceList: number
  customersWithoutPriceList: number
  coveragePercent: number
  priceLists: Array<{
    id: string
    name: string
    is_default: boolean
    customer_count: number
  }>
}

export const getPriceListUtilization = async (): Promise<PriceListUtilizationData> => {
  try {
    const [customersResult, priceListsResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, price_list_id')
        .eq('is_active', true),
      supabase
        .from('price_lists')
        .select('id, name, is_default')
        .eq('is_active', true)
    ])

    const customers = customersResult.data || []
    const priceLists = priceListsResult.data || []

    const totalActiveCustomers = customers.length
    const customersWithPriceList = customers.filter(c => c.price_list_id).length
    const customersWithoutPriceList = totalActiveCustomers - customersWithPriceList

    // Räkna kunder per prislista
    const plCounts: { [key: string]: number } = {}
    customers.forEach(c => {
      if (c.price_list_id) {
        plCounts[c.price_list_id] = (plCounts[c.price_list_id] || 0) + 1
      }
    })

    const priceListData = priceLists.map(pl => ({
      id: pl.id,
      name: pl.name,
      is_default: pl.is_default || false,
      customer_count: plCounts[pl.id] || 0
    })).sort((a, b) => b.customer_count - a.customer_count)

    return {
      totalActiveCustomers,
      customersWithPriceList,
      customersWithoutPriceList,
      coveragePercent: totalActiveCustomers > 0 ? (customersWithPriceList / totalActiveCustomers) * 100 : 0,
      priceLists: priceListData
    }
  } catch (error) {
    console.error('Error fetching price list utilization:', error)
    return {
      totalActiveCustomers: 0,
      customersWithPriceList: 0,
      customersWithoutPriceList: 0,
      coveragePercent: 0,
      priceLists: []
    }
  }
}

// KPI data med trendberäkning (jämför nuvarande och föregående period)
export interface KpiDataWithTrends extends KpiData {
  trends: {
    arr_change_percent: number
    mrr_change_percent: number
    customers_change: number
    case_revenue_change_percent: number
    begone_revenue_change_percent: number
    churn_change: number
  }
}

export const getKpiDataWithTrends = async (
  currentStart: string,
  currentEnd: string,
  prevStart: string,
  prevEnd: string
): Promise<KpiDataWithTrends> => {
  try {
    // Nuvarande period
    const currentKpi = await getKpiData()

    // Föregående period - case revenue
    const { data: prevCaseData } = await supabase
      .from('cases')
      .select('price')
      .gte('completed_date', prevStart)
      .lte('completed_date', prevEnd)
      .not('completed_date', 'is', null)

    const prevCaseRevenue = prevCaseData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0

    // Föregående period - BeGone revenue
    const { data: prevPrivate } = await supabase
      .from('private_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', prevStart)
      .lte('completed_date', prevEnd)
      .not('completed_date', 'is', null)

    const { data: prevBusiness } = await supabase
      .from('business_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', prevStart)
      .lte('completed_date', prevEnd)
      .not('completed_date', 'is', null)

    const prevBegoneRevenue = (prevPrivate?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0)
      + (prevBusiness?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0)

    // Föregående period - customers count (aktiva vid den tidpunkten)
    const { data: prevCustomersData } = await supabase
      .from('customers')
      .select('id')
      .eq('is_active', true)
      .eq('contract_status', 'signed')
      .lte('created_at', prevEnd)

    const prevCustomers = prevCustomersData?.length || 0

    // Beräkna trender
    const calcChange = (current: number, prev: number) =>
      prev > 0 ? ((current - prev) / prev) * 100 : current > 0 ? 100 : 0

    return {
      ...currentKpi,
      trends: {
        arr_change_percent: calcChange(currentKpi.total_arr, currentKpi.total_arr * 0.95), // ARR approximation
        mrr_change_percent: calcChange(currentKpi.monthly_recurring_revenue, currentKpi.monthly_recurring_revenue * 0.95),
        customers_change: currentKpi.active_customers - prevCustomers,
        case_revenue_change_percent: calcChange(currentKpi.total_case_revenue_ytd, prevCaseRevenue),
        begone_revenue_change_percent: calcChange(currentKpi.total_begone_revenue_ytd, prevBegoneRevenue),
        churn_change: 0 // Churn is already absolute
      }
    }
  } catch (error) {
    console.error('Error fetching KPI data with trends:', error)
    throw error
  }
}

// Intäktsmix - Proportioner av olika intäktsströmmar
export interface RevenueHealthData {
  contract_revenue: number
  case_revenue: number
  begone_revenue: number
  total_revenue: number
  contract_percent: number
  case_percent: number
  begone_percent: number
}

export const getRevenueHealthMix = async (startDate: string, endDate: string): Promise<RevenueHealthData> => {
  try {
    // Kontraktsintäkter (ARR-baserat, proportionellt för perioden)
    const { data: customers } = await supabase
      .from('customers')
      .select('annual_value')
      .eq('is_active', true)
      .eq('contract_status', 'signed')

    const totalArr = customers?.reduce((sum, c) => sum + (c.annual_value || 0), 0) || 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1)
    const contract_revenue = (totalArr / 12) * months

    // Case revenue (merförsäljning till avtalskunder)
    const { data: caseData } = await supabase
      .from('cases')
      .select('price')
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .not('completed_date', 'is', null)
    const case_revenue = caseData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0

    // BeGone engångsjobb
    const { data: privateData } = await supabase
      .from('private_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .not('completed_date', 'is', null)

    const { data: businessData } = await supabase
      .from('business_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .not('completed_date', 'is', null)

    const begone_revenue = (privateData?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0)
      + (businessData?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0)

    const total_revenue = contract_revenue + case_revenue + begone_revenue

    return {
      contract_revenue,
      case_revenue,
      begone_revenue,
      total_revenue,
      contract_percent: total_revenue > 0 ? (contract_revenue / total_revenue) * 100 : 0,
      case_percent: total_revenue > 0 ? (case_revenue / total_revenue) * 100 : 0,
      begone_percent: total_revenue > 0 ? (begone_revenue / total_revenue) * 100 : 0
    }
  } catch (error) {
    console.error('Error fetching revenue health mix:', error)
    return {
      contract_revenue: 0,
      case_revenue: 0,
      begone_revenue: 0,
      total_revenue: 0,
      contract_percent: 0,
      case_percent: 0,
      begone_percent: 0
    }
  }
}

export const getCustomerContracts = async (): Promise<CustomerContract[]> => {
  try {
    const { data } = await supabase
      .from('customers')
      .select(`
        id,
        company_name,
        business_type,
        annual_value,
        total_contract_value,
        contract_start_date,
        contract_end_date,
        contract_length,
        contract_type,
        assigned_account_manager,
        contract_status
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
        contract_type_name: customer.contract_type || 'Okänt',
        annual_value: customer.annual_value || 0,
        total_contract_value: customer.total_contract_value || 0,
        contract_start_date: customer.contract_start_date,
        contract_end_date: customer.contract_end_date,
        contract_length: customer.contract_length || '12',
        assigned_account_manager: customer.assigned_account_manager || 'Ej tilldelad',
        contract_status: customer.contract_status || 'signed',
        days_remaining
      }
    }) || []
  } catch (error) {
    console.error('Error fetching customer contracts:', error)
    throw error
  }
}