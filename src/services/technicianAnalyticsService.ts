// 📁 src/services/technicianAnalyticsService.ts - ANALYTICS FUNKTIONER FÖR TEKNIKER
import { supabase } from '../lib/supabaseClient'

// Types för tekniker analytics
export interface TechnicianKpi {
  active_technicians: number
  total_technicians: number
  total_revenue_ytd: number
  total_cases_ytd: number
  avg_revenue_per_technician: number
  avg_cases_per_technician: number
  avg_case_value_all: number
}

export interface TechnicianPerformance {
  id: string
  name: string
  role: string
  email: string
  total_revenue: number
  total_cases: number
  private_revenue: number
  business_revenue: number
  contract_revenue: number
  private_cases: number
  business_cases: number
  contract_cases: number
  avg_case_value: number
  rank: number
}

export interface TechnicianMonthlyData {
  month: string
  technician_name: string
  total_revenue: number
  total_cases: number
  private_revenue: number
  business_revenue: number
  contract_revenue: number
}

export interface PestSpecialization {
  technician_name: string
  pest_type: string
  case_count: number
  total_revenue: number
  avg_case_value: number
  source: 'private' | 'business' | 'contract'
}

// 🎯 1. KPI Data Service
export const getTechnicianKpi = async (): Promise<TechnicianKpi> => {
  try {
    console.log('🔄 Fetching technician KPI data...')

    // Hämta tekniker-statistik
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, is_active')

    if (techError) throw techError

    const activeTechnicians = technicians?.filter(t => t.is_active) || []

    // Beräkna YTD (Year To Date) baserat på created_at
    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`

    // Hämta alla avslutade ärenden för året (alla källor)
    const [privateResult, businessResult, contractResult] = await Promise.all([
      // Private cases
      supabase
        .from('private_cases')
        .select('pris, primary_assignee_id, created_at')
        .eq('status', 'Avslutat')
        .not('pris', 'is', null)
        .gte('created_at', yearStart),
      
      // Business cases  
      supabase
        .from('business_cases')
        .select('pris, primary_assignee_id, created_at')
        .eq('status', 'Avslutat')
        .not('pris', 'is', null)
        .gte('created_at', yearStart),
      
      // Contract cases
      supabase
        .from('cases')
        .select('price, assigned_technician_id, created_at')
        .in('status', ['Avslutat', 'Genomförd', 'Klar'])
        .not('price', 'is', null)
        .gte('created_at', yearStart)
    ])

    if (privateResult.error) throw privateResult.error
    if (businessResult.error) throw businessResult.error
    if (contractResult.error) throw contractResult.error

    // Summera data
    const privateCases = privateResult.data || []
    const businessCases = businessResult.data || []
    const contractCases = contractResult.data || []

    const totalRevenue = 
      privateCases.reduce((sum, c) => sum + (c.pris || 0), 0) +
      businessCases.reduce((sum, c) => sum + (c.pris || 0), 0) +
      contractCases.reduce((sum, c) => sum + (c.price || 0), 0)

    const totalCases = privateCases.length + businessCases.length + contractCases.length

    const kpiData: TechnicianKpi = {
      active_technicians: activeTechnicians.length,
      total_technicians: technicians?.length || 0,
      total_revenue_ytd: totalRevenue,
      total_cases_ytd: totalCases,
      avg_revenue_per_technician: activeTechnicians.length > 0 ? totalRevenue / activeTechnicians.length : 0,
      avg_cases_per_technician: activeTechnicians.length > 0 ? totalCases / activeTechnicians.length : 0,
      avg_case_value_all: totalCases > 0 ? totalRevenue / totalCases : 0
    }

    console.log('✅ KPI data fetched successfully:', kpiData)
    return kpiData
  } catch (error) {
    console.error('❌ Error fetching technician KPI:', error)
    throw new Error('Fel vid hämtning av KPI data')
  }
}

// 🎯 2. Performance Ranking Service
export const getTechnicianPerformance = async (): Promise<TechnicianPerformance[]> => {
  try {
    console.log('🔄 Fetching technician performance data...')

    // Hämta alla tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, role, email, is_active')
      .eq('is_active', true)

    if (techError) throw techError
    if (!technicians?.length) {
      console.log('ℹ️ No active technicians found')
      return []
    }

    // Bygg performance data för varje tekniker
    const performancePromises = technicians.map(async (tech) => {
      // Private cases
      const { data: privateCases } = await supabase
        .from('private_cases')
        .select('pris')
        .eq('primary_assignee_id', tech.id)
        .eq('status', 'Avslutat')
        .not('pris', 'is', null) || { data: [] }

      // Business cases
      const { data: businessCases } = await supabase
        .from('business_cases')
        .select('pris')
        .eq('primary_assignee_id', tech.id)
        .eq('status', 'Avslutat')
        .not('pris', 'is', null) || { data: [] }

      // Contract cases
      const { data: contractCases } = await supabase
        .from('cases')
        .select('price')
        .eq('assigned_technician_id', tech.id)
        .in('status', ['Avslutat', 'Genomförd', 'Klar'])
        .not('price', 'is', null) || { data: [] }

      // Beräkna totaler
      const privateRevenue = (privateCases || []).reduce((sum, c) => sum + (c.pris || 0), 0)
      const businessRevenue = (businessCases || []).reduce((sum, c) => sum + (c.pris || 0), 0)
      const contractRevenue = (contractCases || []).reduce((sum, c) => sum + (c.price || 0), 0)

      const totalRevenue = privateRevenue + businessRevenue + contractRevenue
      const totalCases = (privateCases?.length || 0) + (businessCases?.length || 0) + (contractCases?.length || 0)

      return {
        id: tech.id,
        name: tech.name,
        role: tech.role,
        email: tech.email,
        total_revenue: totalRevenue,
        total_cases: totalCases,
        private_revenue: privateRevenue,
        business_revenue: businessRevenue,
        contract_revenue: contractRevenue,
        private_cases: privateCases?.length || 0,
        business_cases: businessCases?.length || 0,
        contract_cases: contractCases?.length || 0,
        avg_case_value: totalCases > 0 ? totalRevenue / totalCases : 0,
        rank: 0 // Sätts nedan
      }
    })

    const performanceData = await Promise.all(performancePromises)
    
    // Sortera efter total intäkt och lägg till ranking
    const sortedData = performanceData
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .map((tech, index) => ({ ...tech, rank: index + 1 }))

    console.log(`✅ Performance data fetched for ${sortedData.length} technicians`)
    return sortedData
  } catch (error) {
    console.error('❌ Error fetching technician performance:', error)
    throw new Error('Fel vid hämtning av prestanda data')
  }
}

// 🎯 3. Monthly Data Service
export const getTechnicianMonthlyData = async (monthsBack: number = 12): Promise<TechnicianMonthlyData[]> => {
  try {
    console.log(`🔄 Fetching monthly data for last ${monthsBack} months...`)

    // Beräkna datumintervall
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBack)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Hämta tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name')
      .eq('is_active', true)

    if (techError) throw techError
    if (!technicians?.length) {
      console.log('ℹ️ No active technicians found for monthly data')
      return []
    }

    // Hämta månadsdata för alla tekniker
    const monthlyDataPromises = technicians.map(async (tech) => {
      // Private cases per månad
      const { data: privateMonthly } = await supabase
        .from('private_cases')
        .select('pris, created_at')
        .eq('primary_assignee_id', tech.id)
        .eq('status', 'Avslutat')
        .not('pris', 'is', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr) || { data: [] }

      // Business cases per månad
      const { data: businessMonthly } = await supabase
        .from('business_cases')
        .select('pris, created_at')
        .eq('primary_assignee_id', tech.id)
        .eq('status', 'Avslutat')
        .not('pris', 'is', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr) || { data: [] }

      // Contract cases per månad
      const { data: contractMonthly } = await supabase
        .from('cases')
        .select('price, created_at')
        .eq('assigned_technician_id', tech.id)
        .in('status', ['Avslutat', 'Genomförd', 'Klar'])
        .not('price', 'is', null)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr) || { data: [] }

      // Gruppera per månad
      const monthlyMap = new Map<string, { private: number, business: number, contract: number, cases: number }>()

      // Processera private cases
      ;(privateMonthly || []).forEach(c => {
        const month = c.created_at.substring(0, 7) // YYYY-MM
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { private: 0, business: 0, contract: 0, cases: 0 })
        }
        const monthData = monthlyMap.get(month)!
        monthData.private += c.pris || 0
        monthData.cases += 1
      })

      // Processera business cases
      ;(businessMonthly || []).forEach(c => {
        const month = c.created_at.substring(0, 7)
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { private: 0, business: 0, contract: 0, cases: 0 })
        }
        const monthData = monthlyMap.get(month)!
        monthData.business += c.pris || 0
        monthData.cases += 1
      })

      // Processera contract cases
      ;(contractMonthly || []).forEach(c => {
        const month = c.created_at.substring(0, 7)
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { private: 0, business: 0, contract: 0, cases: 0 })
        }
        const monthData = monthlyMap.get(month)!
        monthData.contract += c.price || 0
        monthData.cases += 1
      })

      // Konvertera till array
      return Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        technician_name: tech.name,
        total_revenue: data.private + data.business + data.contract,
        total_cases: data.cases,
        private_revenue: data.private,
        business_revenue: data.business,
        contract_revenue: data.contract
      }))
    })

    const allMonthlyData = (await Promise.all(monthlyDataPromises)).flat()
    console.log(`✅ Monthly data fetched: ${allMonthlyData.length} records`)
    return allMonthlyData
  } catch (error) {
    console.error('❌ Error fetching monthly data:', error)
    throw new Error('Fel vid hämtning av månadsdata')
  }
}

// 🎯 4. Pest Specialization Service - FIXAD
export const getPestSpecialization = async (): Promise<PestSpecialization[]> => {
  try {
    console.log('🔄 Fetching pest specialization data...')

    // Hämta tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name')
      .eq('is_active', true)

    if (techError) throw techError
    if (!technicians?.length) {
      console.log('ℹ️ No active technicians found for pest specialization')
      return []
    }

    const pestDataPromises = technicians.map(async (tech) => {
      const pestSpecializations: PestSpecialization[] = []

      // Private cases - skadedjur specialisering
      const { data: privateCases } = await supabase
        .from('private_cases')
        .select('skadedjur, pris')
        .eq('primary_assignee_id', tech.id)
        .eq('status', 'Avslutat')
        .not('skadedjur', 'is', null)
        .not('pris', 'is', null) || { data: [] }

      // Gruppera private cases per skadedjur
      const privateGroups = new Map<string, { count: number, revenue: number }>()
      ;(privateCases || []).forEach(c => {
        const pest = c.skadedjur || 'Okänt'
        if (!privateGroups.has(pest)) {
          privateGroups.set(pest, { count: 0, revenue: 0 })
        }
        const group = privateGroups.get(pest)!
        group.count += 1
        group.revenue += c.pris || 0
      })

      privateGroups.forEach((data, pest) => {
        pestSpecializations.push({
          technician_name: tech.name,
          pest_type: pest,
          case_count: data.count,
          total_revenue: data.revenue,
          avg_case_value: data.count > 0 ? data.revenue / data.count : 0,
          source: 'private'
        })
      })

      // Business cases - skadedjur specialisering
      const { data: businessCases } = await supabase
        .from('business_cases')
        .select('skadedjur, pris')
        .eq('primary_assignee_id', tech.id)
        .eq('status', 'Avslutat')
        .not('skadedjur', 'is', null)
        .not('pris', 'is', null) || { data: [] }

      const businessGroups = new Map<string, { count: number, revenue: number }>()
      ;(businessCases || []).forEach(c => {
        const pest = c.skadedjur || 'Okänt'
        if (!businessGroups.has(pest)) {
          businessGroups.set(pest, { count: 0, revenue: 0 })
        }
        const group = businessGroups.get(pest)!
        group.count += 1
        group.revenue += c.pris || 0
      })

      businessGroups.forEach((data, pest) => {
        pestSpecializations.push({
          technician_name: tech.name,
          pest_type: pest,
          case_count: data.count,
          total_revenue: data.revenue,
          avg_case_value: data.count > 0 ? data.revenue / data.count : 0,
          source: 'business'
        })
      })

      // Contract cases - pest_type specialisering
      const { data: contractCases } = await supabase
        .from('cases')
        .select('pest_type, price')
        .eq('assigned_technician_id', tech.id)
        .in('status', ['Avslutat', 'Genomförd', 'Klar'])
        .not('pest_type', 'is', null)
        .not('price', 'is', null) || { data: [] }

      const contractGroups = new Map<string, { count: number, revenue: number }>()
      ;(contractCases || []).forEach(c => {
        const pest = c.pest_type || 'Okänt'
        if (!contractGroups.has(pest)) {
          contractGroups.set(pest, { count: 0, revenue: 0 })
        }
        const group = contractGroups.get(pest)!
        group.count += 1
        group.revenue += c.price || 0
      })

      contractGroups.forEach((data, pest) => {
        pestSpecializations.push({
          technician_name: tech.name,
          pest_type: pest,
          case_count: data.count,
          total_revenue: data.revenue,
          avg_case_value: data.count > 0 ? data.revenue / data.count : 0,
          source: 'contract'
        })
      })

      return pestSpecializations
    })

    const allPestData = (await Promise.all(pestDataPromises)).flat()
    console.log(`✅ Pest specialization data fetched: ${allPestData.length} records`)
    return allPestData
  } catch (error) {
    console.error('❌ Error fetching pest specialization:', error)
    throw new Error('Fel vid hämtning av specialiseringsdata')
  }
}