// 📁 src/services/provisionService.ts - TEKNIKER PROVISION SYSTEM
import { supabase } from '../lib/supabase'

export interface ProvisionCase {
  id: string
  case_number: string | null
  title: string
  description: string | null
  status: string
  pris: number
  completed_date: string
  created_at: string
  primary_assignee_id: string | null
  primary_assignee_name: string | null
  primary_assignee_email: string | null
  secondary_assignee_id: string | null
  secondary_assignee_name: string | null
  tertiary_assignee_id: string | null
  tertiary_assignee_name: string | null
  clickup_task_id: string
  source: 'private' | 'business'
  // BeGone-specifika fält för kontext
  skadedjur?: string | null
  adress?: any // JSONB
  kontaktperson?: string | null
  telefon_kontaktperson?: string | null
}

export interface TechnicianProvision {
  technician_id: string
  technician_name: string
  technician_email: string | null
  total_provision_amount: number
  total_cases: number
  total_revenue: number
  cases: ProvisionCase[]
  primary_cases: number
  secondary_cases: number
  tertiary_cases: number
  // Provision fördelning per månad
  monthly_breakdown: {
    month: string
    provision_amount: number
    cases_count: number
    revenue: number
  }[]
}

export interface MonthlyProvisionSummary {
  month: string
  total_provision: number
  total_revenue: number
  total_cases: number
  technician_count: number
  top_earner: {
    name: string
    amount: number
  } | null
  private_cases_count: number
  business_cases_count: number
  private_provision: number
  business_provision: number
}

export interface ProvisionGraphData {
  month: string
  total_provision: number
  technician_data: {
    [technicianName: string]: number
  }
}

// Konstanter
const PROVISION_RATE = 0.05 // 5%
const PRIMARY_ASSIGNEE_RATE = 0.60   // Huvudtekniker får 60%
const SECONDARY_ASSIGNEE_RATE = 0.30 // Sekundär tekniker får 30%
const TERTIARY_ASSIGNEE_RATE = 0.10  // Tertiär tekniker får 10%

// 🎯 1. Hämta alla provision-berättigade ärenden för en period
export const getProvisionCases = async (
  monthsBack: number = 12,
  technicianId?: string
): Promise<ProvisionCase[]> => {
  try {
    console.log(`🔄 Fetching provision cases for last ${monthsBack} months...`)

    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBack)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Build base queries
    let privateQuery = supabase
      .from('private_cases')
      .select(`
        id, case_number, title, description, status, pris, completed_date, created_at,
        primary_assignee_id, primary_assignee_name, primary_assignee_email,
        secondary_assignee_id, secondary_assignee_name, 
        tertiary_assignee_id, tertiary_assignee_name,
        clickup_task_id, skadedjur, adress, kontaktperson, telefon_kontaktperson
      `)
      .eq('status', 'Avslutat')
      .not('pris', 'is', null)
      .not('completed_date', 'is', null)
      .gte('completed_date', startDateStr)
      .lte('completed_date', endDateStr)

    let businessQuery = supabase
      .from('business_cases')
      .select(`
        id, case_number, title, description, status, pris, completed_date, created_at,
        primary_assignee_id, primary_assignee_name, primary_assignee_email,
        secondary_assignee_id, secondary_assignee_name,
        tertiary_assignee_id, tertiary_assignee_name,
        clickup_task_id, skadedjur, adress, kontaktperson, telefon_kontaktperson
      `)
      .eq('status', 'Avslutat')
      .not('pris', 'is', null)
      .not('completed_date', 'is', null)
      .gte('completed_date', startDateStr)
      .lte('completed_date', endDateStr)

    // Filtrera på specifik tekniker om angiven
    if (technicianId) {
      privateQuery = privateQuery.or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
      businessQuery = businessQuery.or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
    }

    const [privateResult, businessResult] = await Promise.all([
      privateQuery,
      businessQuery
    ])

    if (privateResult.error) throw privateResult.error
    if (businessResult.error) throw businessResult.error

    // Kombinera och märk med source
    const privateCases: ProvisionCase[] = (privateResult.data || []).map(c => ({
      ...c,
      source: 'private' as const
    }))

    const businessCases: ProvisionCase[] = (businessResult.data || []).map(c => ({
      ...c,
      source: 'business' as const
    }))

    const allCases = [...privateCases, ...businessCases]
      .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())

    console.log(`✅ Found ${allCases.length} provision cases (${privateCases.length} private + ${businessCases.length} business)`)
    return allCases
  } catch (error) {
    console.error('❌ Error fetching provision cases:', error)
    throw new Error('Fel vid hämtning av provisionsärenden')
  }
}

// 🎯 2. Beräkna tekniker provisioner
export const calculateTechnicianProvisions = async (
  monthsBack: number = 12
): Promise<TechnicianProvision[]> => {
  try {
    console.log(`🔄 Calculating technician provisions for last ${monthsBack} months...`)

    // Hämta alla tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, email, is_active')
      .eq('is_active', true)

    if (techError) throw techError
    if (!technicians?.length) {
      console.log('ℹ️ No active technicians found')
      return []
    }

    // Hämta alla provision-ärenden
    const allCases = await getProvisionCases(monthsBack)

    // Bygg provision data för varje tekniker
    const technicianProvisions: TechnicianProvision[] = technicians.map(tech => {
      // Hitta ärenden där tekniker är involverad
      const technicianCases = allCases.filter(c => 
        c.primary_assignee_id === tech.id ||
        c.secondary_assignee_id === tech.id ||
        c.tertiary_assignee_id === tech.id
      )

      // Beräkna provision per ärende
      let totalProvision = 0
      let totalRevenue = 0
      let primaryCases = 0
      let secondaryCases = 0
      let tertiaryCases = 0

      const casesWithProvision = technicianCases.map(c => {
        let caseProvision = 0
        const baseProvision = (c.pris || 0) * PROVISION_RATE

        if (c.primary_assignee_id === tech.id) {
          caseProvision = baseProvision * PRIMARY_ASSIGNEE_RATE
          primaryCases++
        } else if (c.secondary_assignee_id === tech.id) {
          caseProvision = baseProvision * SECONDARY_ASSIGNEE_RATE
          secondaryCases++
        } else if (c.tertiary_assignee_id === tech.id) {
          caseProvision = baseProvision * TERTIARY_ASSIGNEE_RATE
          tertiaryCases++
        }

        totalProvision += caseProvision
        totalRevenue += c.pris || 0
        return c
      })

      // Månadsvis uppdelning
      const monthlyMap = new Map<string, { provision: number, cases: number, revenue: number }>()
      
      casesWithProvision.forEach(c => {
        const month = c.completed_date.substring(0, 7) // YYYY-MM
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { provision: 0, cases: 0, revenue: 0 })
        }
        
        const monthData = monthlyMap.get(month)!
        let caseProvision = 0
        const baseProvision = (c.pris || 0) * PROVISION_RATE

        if (c.primary_assignee_id === tech.id) {
          caseProvision = baseProvision * PRIMARY_ASSIGNEE_RATE
        } else if (c.secondary_assignee_id === tech.id) {
          caseProvision = baseProvision * SECONDARY_ASSIGNEE_RATE
        } else if (c.tertiary_assignee_id === tech.id) {
          caseProvision = baseProvision * TERTIARY_ASSIGNEE_RATE
        }

        monthData.provision += caseProvision
        monthData.cases += 1
        monthData.revenue += c.pris || 0
      })

      const monthlyBreakdown = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          provision_amount: data.provision,
          cases_count: data.cases,
          revenue: data.revenue
        }))
        .sort((a, b) => a.month.localeCompare(b.month))

      return {
        technician_id: tech.id,
        technician_name: tech.name,
        technician_email: tech.email,
        total_provision_amount: totalProvision,
        total_cases: technicianCases.length,
        total_revenue: totalRevenue,
        cases: casesWithProvision,
        primary_cases: primaryCases,
        secondary_cases: secondaryCases,
        tertiary_cases: tertiaryCases,
        monthly_breakdown: monthlyBreakdown
      }
    })

    // Sortera efter total provision
    const sortedProvisions = technicianProvisions.sort(
      (a, b) => b.total_provision_amount - a.total_provision_amount
    )

    console.log(`✅ Calculated provisions for ${sortedProvisions.length} technicians`)
    return sortedProvisions
  } catch (error) {
    console.error('❌ Error calculating technician provisions:', error)
    throw new Error('Fel vid beräkning av tekniker provisioner')
  }
}

// 🎯 3. Månadsvis provision sammanfattning
export const getMonthlyProvisionSummary = async (
  monthsBack: number = 12
): Promise<MonthlyProvisionSummary[]> => {
  try {
    console.log(`🔄 Generating monthly provision summary for last ${monthsBack} months...`)

    const allCases = await getProvisionCases(monthsBack)
    const technicianProvisions = await calculateTechnicianProvisions(monthsBack)

    // Gruppera per månad
    const monthlyMap = new Map<string, {
      cases: ProvisionCase[]
      provision: number
      revenue: number
      technicians: Set<string>
    }>()

    // Initiera senaste månader
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().slice(0, 7)
      
      monthlyMap.set(monthKey, {
        cases: [],
        provision: 0,
        revenue: 0,
        technicians: new Set()
      })
    }

    // Beräkna data per månad
    allCases.forEach(c => {
      const month = c.completed_date.substring(0, 7)
      if (!monthlyMap.has(month)) return

      const monthData = monthlyMap.get(month)!
      monthData.cases.push(c)
      monthData.revenue += c.pris || 0

      // Beräkna provision för detta ärende
      const baseProvision = (c.pris || 0) * PROVISION_RATE
      monthData.provision += baseProvision

      // Lägg till tekniker
      if (c.primary_assignee_name) monthData.technicians.add(c.primary_assignee_name)
      if (c.secondary_assignee_name) monthData.technicians.add(c.secondary_assignee_name)
      if (c.tertiary_assignee_name) monthData.technicians.add(c.tertiary_assignee_name)
    })

    // Konvertera till summary array
    const summaries: MonthlyProvisionSummary[] = Array.from(monthlyMap.entries()).map(([month, data]) => {
      const privateCases = data.cases.filter(c => c.source === 'private')
      const businessCases = data.cases.filter(c => c.source === 'business')
      
      const privateRevenue = privateCases.reduce((sum, c) => sum + (c.pris || 0), 0)
      const businessRevenue = businessCases.reduce((sum, c) => sum + (c.pris || 0), 0)

      // Hitta toppresterande tekniker för månaden
      const technicianEarnings = new Map<string, number>()
      
      // Beräkna earnings per tekniker för denna månad
      technicianProvisions.forEach(tech => {
        const monthBreakdown = tech.monthly_breakdown.find(m => m.month === month)
        if (monthBreakdown && monthBreakdown.provision_amount > 0) {
          technicianEarnings.set(tech.technician_name, monthBreakdown.provision_amount)
        }
      })

      const topEarner = Array.from(technicianEarnings.entries())
        .sort(([,a], [,b]) => b - a)[0]

      return {
        month,
        total_provision: data.provision,
        total_revenue: data.revenue,
        total_cases: data.cases.length,
        technician_count: data.technicians.size,
        top_earner: topEarner ? { name: topEarner[0], amount: topEarner[1] } : null,
        private_cases_count: privateCases.length,
        business_cases_count: businessCases.length,
        private_provision: privateRevenue * PROVISION_RATE,
        business_provision: businessRevenue * PROVISION_RATE
      }
    })

    console.log(`✅ Generated monthly provision summary for ${summaries.length} months`)
    return summaries.sort((a, b) => a.month.localeCompare(b.month))
  } catch (error) {
    console.error('❌ Error generating monthly provision summary:', error)
    throw new Error('Fel vid generering av månadsvis provision sammanfattning')
  }
}

// 🎯 4. Graf-data för provision över tid
export const getProvisionGraphData = async (
  monthsBack: number = 12,
  selectedTechnicians?: string[]
): Promise<ProvisionGraphData[]> => {
  try {
    console.log(`🔄 Generating provision graph data for ${monthsBack} months...`)

    const technicianProvisions = await calculateTechnicianProvisions(monthsBack)
    
    // Filtrera tekniker om specificerade
    const filteredProvisions = selectedTechnicians && selectedTechnicians.length > 0
      ? technicianProvisions.filter(tp => selectedTechnicians.includes(tp.technician_id))
      : technicianProvisions

    // Skapa månadsstruktur
    const monthlyGraphData: ProvisionGraphData[] = []
    
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().slice(0, 7)
      
      const graphData: ProvisionGraphData = {
        month: monthKey,
        total_provision: 0,
        technician_data: {}
      }

      // Samla data för alla tekniker denna månad
      filteredProvisions.forEach(tech => {
        const monthData = tech.monthly_breakdown.find(m => m.month === monthKey)
        const provision = monthData?.provision_amount || 0
        
        if (provision > 0) {
          graphData.technician_data[tech.technician_name] = provision
          graphData.total_provision += provision
        }
      })

      monthlyGraphData.push(graphData)
    }

    console.log(`✅ Generated graph data for ${monthlyGraphData.length} months`)
    return monthlyGraphData
  } catch (error) {
    console.error('❌ Error generating provision graph data:', error)
    throw new Error('Fel vid generering av graf-data')
  }
}

// 🎯 5. Provision för enskild tekniker
export const getTechnicianProvisionDetails = async (
  technicianId: string,
  monthsBack: number = 12
): Promise<TechnicianProvision | null> => {
  try {
    console.log(`🔄 Fetching provision details for technician ${technicianId}...`)

    const allProvisions = await calculateTechnicianProvisions(monthsBack)
    const technicianProvision = allProvisions.find(tp => tp.technician_id === technicianId)

    if (!technicianProvision) {
      console.log(`ℹ️ No provision data found for technician ${technicianId}`)
      return null
    }

    console.log(`✅ Found provision details for ${technicianProvision.technician_name}`)
    return technicianProvision
  } catch (error) {
    console.error('❌ Error fetching technician provision details:', error)
    throw new Error('Fel vid hämtning av tekniker provision detaljer')
  }
}

// 🎯 6. Provision KPI sammanfattning
export const getProvisionKpiSummary = async (monthsBack: number = 12) => {
  try {
    console.log(`🔄 Generating provision KPI summary...`)

    const [technicianProvisions, monthlySummary] = await Promise.all([
      calculateTechnicianProvisions(monthsBack),
      getMonthlyProvisionSummary(monthsBack)
    ])

    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentMonthData = monthlySummary.find(m => m.month === currentMonth)

    const totalProvisionYTD = monthlySummary
      .filter(m => m.month.startsWith(new Date().getFullYear().toString()))
      .reduce((sum, m) => sum + m.total_provision, 0)

    const totalRevenueYTD = monthlySummary
      .filter(m => m.month.startsWith(new Date().getFullYear().toString()))
      .reduce((sum, m) => sum + m.total_revenue, 0)

    const activeTechnicians = technicianProvisions.filter(tp => tp.total_cases > 0).length
    const averageProvisionPerTechnician = activeTechnicians > 0 
      ? totalProvisionYTD / activeTechnicians 
      : 0

    const topEarner = technicianProvisions[0] // Already sorted by provision amount

    return {
      current_month_provision: currentMonthData?.total_provision || 0,
      total_provision_ytd: totalProvisionYTD,
      total_revenue_ytd: totalRevenueYTD,
      provision_rate: totalRevenueYTD > 0 ? (totalProvisionYTD / totalRevenueYTD) * 100 : 0,
      active_technicians: activeTechnicians,
      average_provision_per_technician: averageProvisionPerTechnician,
      top_earner: topEarner ? {
        name: topEarner.technician_name,
        amount: topEarner.total_provision_amount,
        cases: topEarner.total_cases
      } : null
    }
  } catch (error) {
    console.error('❌ Error generating provision KPI summary:', error)
    throw new Error('Fel vid generering av provision KPI sammanfattning')
  }
}