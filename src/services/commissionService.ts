// 📁 src/services/commissionService.ts - Hämta provisionsdata från databas
import { supabase } from '../lib/supabase'
import type { 
  CommissionKpi, 
  CommissionMonthlyData, 
  TechnicianCommissionSummary, 
  CommissionCaseDetail,
  TechnicianFilter,
  MonthSelection
} from '../types/commission'

// 1. KPI-data för dashboard-kort
export const getCommissionKpis = async (month: string): Promise<CommissionKpi> => {
  try {
    console.log(`📊 Fetching commission KPIs for month: ${month}`)
    
    // Månadsgränser
    const monthStart = `${month}-01`
    const [year, monthNum] = month.split('-')
    const nextMonth = parseInt(monthNum) === 12 ? 1 : parseInt(monthNum) + 1
    const nextYear = parseInt(monthNum) === 12 ? parseInt(year) + 1 : parseInt(year)
    const monthEnd = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`

    // Hämta provisioner från private_cases
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('commission_amount, primary_assignee_id, primary_assignee_name')
      .not('commission_amount', 'is', null)
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)

    // Hämta provisioner från business_cases  
    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('commission_amount, primary_assignee_id, primary_assignee_name')
      .not('commission_amount', 'is', null)
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)

    const allCases = [
      ...(privateCases || []).map(c => ({ ...c, type: 'private' as const })),
      ...(businessCases || []).map(c => ({ ...c, type: 'business' as const }))
    ]

    // Beräkna KPIs
    const total_commission = allCases.reduce((sum, case_) => sum + (case_.commission_amount || 0), 0)
    const total_cases = allCases.length
    
    // Unika tekniker som har provisioner
    const uniqueTechnicians = new Set(
      allCases
        .filter(case_ => case_.primary_assignee_id)
        .map(case_ => case_.primary_assignee_id)
    )
    const active_technicians = uniqueTechnicians.size

    const avg_commission_per_case = total_cases > 0 ? total_commission / total_cases : 0
    const avg_commission_per_technician = active_technicians > 0 ? total_commission / active_technicians : 0

    // För pending/paid - kräver billing_status från befintlig system
    const pending_commission = total_commission // Alla är pending tills vidare
    const paid_commission = 0 // Implementeras senare med billing_status

    console.log(`✅ Commission KPIs calculated:`, {
      total_commission,
      total_cases,
      active_technicians
    })

    return {
      total_commission,
      total_cases,
      active_technicians,
      avg_commission_per_case,
      avg_commission_per_technician,
      pending_commission,
      paid_commission
    }

  } catch (error) {
    console.error('Error fetching commission KPIs:', error)
    throw error
  }
}

// 2. Månadslönedata för diagram (6 månader bakåt)
export const getCommissionMonthlyData = async (months: number = 6): Promise<CommissionMonthlyData[]> => {
  try {
    console.log(`📈 Fetching commission monthly data for ${months} months`)
    
    // Beräkna datumgränser
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const startDateString = startDate.toISOString().split('T')[0]

    // Hämta alla provisioner sedan startdatum
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('commission_amount, completed_date, primary_assignee_id, primary_assignee_name')
      .not('commission_amount', 'is', null)
      .gte('completed_date', startDateString)
      .not('primary_assignee_id', 'is', null)

    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('commission_amount, completed_date, primary_assignee_id, primary_assignee_name')
      .not('commission_amount', 'is', null)
      .gte('completed_date', startDateString)
      .not('primary_assignee_id', 'is', null)

    // Gruppera per månad och tekniker
    const monthlyStats: { [key: string]: CommissionMonthlyData } = {}
    
    const processCase = (case_: any, type: 'private' | 'business') => {
      if (!case_.completed_date || !case_.primary_assignee_id) return
      
      const monthKey = case_.completed_date.slice(0, 7) // YYYY-MM
      const technicianKey = `${monthKey}-${case_.primary_assignee_id}`
      
      if (!monthlyStats[technicianKey]) {
        monthlyStats[technicianKey] = {
          month: monthKey,
          month_display: formatSwedishMonth(monthKey),
          technician_id: case_.primary_assignee_id,
          technician_name: case_.primary_assignee_name || 'Okänd tekniker',
          total_commission: 0,
          case_count: 0,
          private_commission: 0,
          business_commission: 0,
          avg_commission_per_case: 0
        }
      }

      const commission = case_.commission_amount || 0
      monthlyStats[technicianKey].total_commission += commission
      monthlyStats[technicianKey].case_count += 1
      
      if (type === 'private') {
        monthlyStats[technicianKey].private_commission += commission
      } else {
        monthlyStats[technicianKey].business_commission += commission
      }
    }

    privateCases?.forEach(case_ => processCase(case_, 'private'))
    businessCases?.forEach(case_ => processCase(case_, 'business'))

    // Beräkna genomsnitt
    Object.values(monthlyStats).forEach(stat => {
      stat.avg_commission_per_case = stat.case_count > 0 
        ? stat.total_commission / stat.case_count 
        : 0
    })

    console.log(`✅ Commission monthly data calculated: ${Object.keys(monthlyStats).length} entries`)
    
    return Object.values(monthlyStats).sort((a, b) => {
      // Sortera efter månad, sedan tekniker-namn
      const monthCompare = a.month.localeCompare(b.month)
      if (monthCompare !== 0) return monthCompare
      return a.technician_name.localeCompare(b.technician_name)
    })

  } catch (error) {
    console.error('Error fetching commission monthly data:', error)
    throw error
  }
}

// 3. Tekniker-sammanfattningar för aktuell månad
export const getTechnicianCommissionSummaries = async (month: string): Promise<TechnicianCommissionSummary[]> => {
  try {
    console.log(`👥 Fetching technician commission summaries for: ${month}`)
    
    const monthStart = `${month}-01`
    const [year, monthNum] = month.split('-')
    const nextMonth = parseInt(monthNum) === 12 ? 1 : parseInt(monthNum) + 1
    const nextYear = parseInt(monthNum) === 12 ? parseInt(year) + 1 : parseInt(year)
    const monthEnd = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`

    // Hämta detaljerade case-data
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select(`
        id, clickup_task_id, case_number, title, pris, commission_amount, 
        commission_calculated_at, completed_date, primary_assignee_id, 
        primary_assignee_name, primary_assignee_email, skadedjur, adress, 
        kontaktperson, billing_status
      `)
      .not('commission_amount', 'is', null)
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)

    const { data: businessCases } = await supabase
      .from('business_cases')
      .select(`
        id, clickup_task_id, case_number, title, pris, commission_amount, 
        commission_calculated_at, completed_date, primary_assignee_id, 
        primary_assignee_name, primary_assignee_email, skadedjur, adress, 
        kontaktperson, org_nr, bestallare, billing_status
      `)
      .not('commission_amount', 'is', null)
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)

    // Gruppera per tekniker
    const technicianMap: { [technicianId: string]: TechnicianCommissionSummary } = {}

    const processCase = (case_: any, type: 'private' | 'business') => {
      if (!case_.primary_assignee_id) return

      const techId = case_.primary_assignee_id
      
      if (!technicianMap[techId]) {
        technicianMap[techId] = {
          technician_id: techId,
          technician_name: case_.primary_assignee_name || 'Okänd tekniker',
          technician_email: case_.primary_assignee_email,
          total_commission: 0,
          case_count: 0,
          private_cases: 0,
          business_cases: 0,
          private_commission: 0,
          business_commission: 0,
          avg_commission_per_case: 0,
          latest_case_date: case_.completed_date,
          cases: []
        }
      }

      const tech = technicianMap[techId]
      const commission = case_.commission_amount || 0

      tech.total_commission += commission
      tech.case_count += 1

      if (type === 'private') {
        tech.private_cases += 1
        tech.private_commission += commission
      } else {
        tech.business_cases += 1
        tech.business_commission += commission
      }

      // Uppdatera senaste datum
      if (case_.completed_date > tech.latest_case_date) {
        tech.latest_case_date = case_.completed_date
      }

      // Lägg till case-detaljer
      tech.cases.push({
        id: case_.id,
        clickup_task_id: case_.clickup_task_id,
        case_number: case_.case_number,
        title: case_.title,
        type,
        case_price: case_.pris,
        commission_amount: commission,
        commission_calculated_at: case_.commission_calculated_at,
        completed_date: case_.completed_date,
        primary_assignee_id: case_.primary_assignee_id,
        primary_assignee_name: case_.primary_assignee_name,
        primary_assignee_email: case_.primary_assignee_email,
        skadedjur: case_.skadedjur,
        adress: case_.adress,
        kontaktperson: case_.kontaktperson,
        org_nr: type === 'business' ? case_.org_nr : undefined,
        bestallare: type === 'business' ? case_.bestallare : undefined,
        billing_status: case_.billing_status
      })
    }

    privateCases?.forEach(case_ => processCase(case_, 'private'))
    businessCases?.forEach(case_ => processCase(case_, 'business'))

    // Beräkna genomsnitt och sortera cases
    const summaries = Object.values(technicianMap).map(tech => {
      tech.avg_commission_per_case = tech.case_count > 0 
        ? tech.total_commission / tech.case_count 
        : 0
      
      // Sortera cases efter datum (senaste först)
      tech.cases.sort((a, b) => b.completed_date.localeCompare(a.completed_date))
      
      return tech
    })

    // Sortera tekniker efter total provision (högst först)
    summaries.sort((a, b) => b.total_commission - a.total_commission)

    console.log(`✅ Technician summaries calculated: ${summaries.length} technicians`)
    
    return summaries

  } catch (error) {
    console.error('Error fetching technician commission summaries:', error)
    throw error
  }
}

// 4. Hämta tillgängliga tekniker för filter
export const getAvailableTechnicians = async (): Promise<TechnicianFilter[]> => {
  try {
    // Hämta alla tekniker som har provisioner
    const { data: techFromPrivate } = await supabase
      .from('private_cases')
      .select('primary_assignee_id, primary_assignee_name, primary_assignee_email')
      .not('commission_amount', 'is', null)
      .not('primary_assignee_id', 'is', null)

    const { data: techFromBusiness } = await supabase
      .from('business_cases')
      .select('primary_assignee_id, primary_assignee_name, primary_assignee_email')
      .not('commission_amount', 'is', null)
      .not('primary_assignee_id', 'is', null)

    // Kombinera och deduplicera
    const allTechs = [
      ...(techFromPrivate || []),
      ...(techFromBusiness || [])
    ]

    const uniqueTechs = Array.from(
      new Map(
        allTechs
          .filter(tech => tech.primary_assignee_id)
          .map(tech => [
            tech.primary_assignee_id, 
            {
              id: tech.primary_assignee_id!,
              name: tech.primary_assignee_name || 'Okänd tekniker',
              email: tech.primary_assignee_email
            }
          ])
      ).values()
    )

    // Sortera alfabetiskt och lägg till "Alla"
    uniqueTechs.sort((a, b) => a.name.localeCompare(b.name))
    
    return [
      { id: 'all', name: 'Alla tekniker' },
      ...uniqueTechs
    ]

  } catch (error) {
    console.error('Error fetching available technicians:', error)
    throw error
  }
}

// 5. Detaljerade case-data med filtrering
export const getCommissionCaseDetails = async (
  month: string, 
  technicianId: string = 'all'
): Promise<CommissionCaseDetail[]> => {
  try {
    console.log(`📋 Fetching commission case details for ${month}, technician: ${technicianId}`)
    
    const monthStart = `${month}-01`
    const [year, monthNum] = month.split('-')
    const nextMonth = parseInt(monthNum) === 12 ? 1 : parseInt(monthNum) + 1
    const nextYear = parseInt(monthNum) === 12 ? parseInt(year) + 1 : parseInt(year)
    const monthEnd = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`

    // Bygg queries med optional tekniker-filter
    let privateQuery = supabase
      .from('private_cases')
      .select(`
        id, clickup_task_id, case_number, title, pris, commission_amount, 
        commission_calculated_at, completed_date, primary_assignee_id, 
        primary_assignee_name, primary_assignee_email, skadedjur, adress, 
        kontaktperson, billing_status
      `)
      .not('commission_amount', 'is', null)
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)

    let businessQuery = supabase
      .from('business_cases')
      .select(`
        id, clickup_task_id, case_number, title, pris, commission_amount, 
        commission_calculated_at, completed_date, primary_assignee_id, 
        primary_assignee_name, primary_assignee_email, skadedjur, adress, 
        kontaktperson, org_nr, bestallare, billing_status
      `)
      .not('commission_amount', 'is', null)
      .gte('completed_date', monthStart)
      .lt('completed_date', monthEnd)

    // Lägg till tekniker-filter om specificerat
    if (technicianId !== 'all') {
      privateQuery = privateQuery.eq('primary_assignee_id', technicianId)
      businessQuery = businessQuery.eq('primary_assignee_id', technicianId)
    }

    const [{ data: privateCases }, { data: businessCases }] = await Promise.all([
      privateQuery,
      businessQuery
    ])

    // Kombinera och mappa
    const allCases: CommissionCaseDetail[] = [
      ...(privateCases || []).map(case_ => ({
        id: case_.id,
        clickup_task_id: case_.clickup_task_id,
        case_number: case_.case_number,
        title: case_.title,
        type: 'private' as const,
        case_price: case_.pris,
        commission_amount: case_.commission_amount,
        commission_calculated_at: case_.commission_calculated_at,
        completed_date: case_.completed_date,
        primary_assignee_id: case_.primary_assignee_id,
        primary_assignee_name: case_.primary_assignee_name,
        primary_assignee_email: case_.primary_assignee_email,
        skadedjur: case_.skadedjur,
        adress: case_.adress,
        kontaktperson: case_.kontaktperson,
        billing_status: case_.billing_status
      })),
      ...(businessCases || []).map(case_ => ({
        id: case_.id,
        clickup_task_id: case_.clickup_task_id,
        case_number: case_.case_number,
        title: case_.title,
        type: 'business' as const,
        case_price: case_.pris,
        commission_amount: case_.commission_amount,
        commission_calculated_at: case_.commission_calculated_at,
        completed_date: case_.completed_date,
        primary_assignee_id: case_.primary_assignee_id,
        primary_assignee_name: case_.primary_assignee_name,
        primary_assignee_email: case_.primary_assignee_email,
        skadedjur: case_.skadedjur,
        adress: case_.adress,
        kontaktperson: case_.kontaktperson,
        org_nr: case_.org_nr,
        bestallare: case_.bestallare,
        billing_status: case_.billing_status
      }))
    ]

    // Sortera efter datum (senaste först)
    allCases.sort((a, b) => b.completed_date.localeCompare(a.completed_date))

    console.log(`✅ Commission case details fetched: ${allCases.length} cases`)
    
    return allCases

  } catch (error) {
    console.error('Error fetching commission case details:', error)
    throw error
  }
}

// Helper function för månadsformatering
const formatSwedishMonth = (monthValue: string): string => {
  const [year, month] = monthValue.split('-')
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ]
  
  return `${monthNames[parseInt(month) - 1]} ${year}`
}