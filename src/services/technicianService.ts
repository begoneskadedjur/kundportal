// 📁 src/services/technicianService.ts - DYNAMISK DATA SERVICE FÖR TEKNIKER
import { supabase } from '../lib/supabase'

// Types för tekniker data
export interface TechnicianPerformance {
  id: string
  name: string
  role: string
  email: string
  is_active: boolean
  
  // Revenue metrics (alla avslutade ärenden)
  private_cases: number
  business_cases: number
  contract_cases: number
  total_cases: number
  
  private_revenue: number
  business_revenue: number
  contract_revenue: number
  total_revenue: number
  
  avg_case_value: number
  rank: number
}

export interface TechnicianMonthlyData {
  technician_name: string
  month: string
  private_cases: number
  business_cases: number
  contract_cases: number
  total_cases: number
  private_revenue: number
  business_revenue: number
  contract_revenue: number
  total_revenue: number
}

export interface PestSpecialization {
  technician_name: string
  pest_type: string
  case_count: number
  total_revenue: number
  avg_case_value: number
  source: 'private' | 'business' | 'contract'
}

export interface TechnicianKpi {
  total_technicians: number
  active_technicians: number
  total_revenue_ytd: number
  total_cases_ytd: number
  avg_revenue_per_technician: number
  avg_cases_per_technician: number
  avg_case_value_all: number
}

// 1. KPI Data - Överblick för alla tekniker
export const getTechnicianKpi = async (): Promise<TechnicianKpi> => {
  try {
    console.log('🔍 getTechnicianKpi: Starting...')
    
    // Hämta alla tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, is_active')

    if (techError) throw techError

    const total_technicians = technicians?.length || 0
    const active_technicians = technicians?.filter(t => t.is_active).length || 0

    // Hämta YTD data (från 1 januari innevarande år)
    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`

    // BeGone privatpersoner YTD
    const { data: privateData } = await supabase
      .from('private_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', yearStart)
      .not('completed_date', 'is', null)
      .not('primary_assignee_name', 'is', null)

    // BeGone företag YTD  
    const { data: businessData } = await supabase
      .from('business_cases')
      .select('pris')
      .eq('status', 'Avslutat')
      .gte('completed_date', yearStart)
      .not('completed_date', 'is', null)
      .not('primary_assignee_name', 'is', null)

    // Avtalskunder YTD
    const { data: contractData } = await supabase
      .from('cases')
      .select('price')
      .gte('completed_date', yearStart)
      .not('completed_date', 'is', null)
      .not('assigned_technician_name', 'is', null)

    // Beräkna totaler
    const private_revenue = privateData?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
    const business_revenue = businessData?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
    const contract_revenue = contractData?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
    
    const total_revenue_ytd = private_revenue + business_revenue + contract_revenue
    const total_cases_ytd = (privateData?.length || 0) + (businessData?.length || 0) + (contractData?.length || 0)
    
    const avg_revenue_per_technician = active_technicians > 0 ? total_revenue_ytd / active_technicians : 0
    const avg_cases_per_technician = active_technicians > 0 ? total_cases_ytd / active_technicians : 0
    const avg_case_value_all = total_cases_ytd > 0 ? total_revenue_ytd / total_cases_ytd : 0

    console.log('✅ getTechnicianKpi completed:', {
      total_technicians,
      active_technicians,
      total_revenue_ytd,
      total_cases_ytd
    })

    return {
      total_technicians,
      active_technicians,
      total_revenue_ytd,
      total_cases_ytd,
      avg_revenue_per_technician,
      avg_cases_per_technician,
      avg_case_value_all
    }
  } catch (error) {
    console.error('❌ Error in getTechnicianKpi:', error)
    throw error
  }
}

// 2. Tekniker Performance - Huvudfunktion för ranking
export const getTechnicianPerformance = async (): Promise<TechnicianPerformance[]> => {
  try {
    console.log('🔍 getTechnicianPerformance: Starting...')
    
    // Hämta alla aktiva tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, role, email, is_active')
      .eq('is_active', true)
      .order('name')

    if (techError) throw techError
    if (!technicians || technicians.length === 0) {
      console.warn('⚠️ No active technicians found')
      return []
    }

    console.log(`📊 Found ${technicians.length} active technicians`)

    // Hämta alla avslutade ärenden (alla tider för komplett historik)
    const [privateResult, businessResult, contractResult] = await Promise.all([
      // BeGone privatpersoner
      supabase
        .from('private_cases')
        .select('primary_assignee_name, pris, completed_date')
        .eq('status', 'Avslutat')
        .not('completed_date', 'is', null)
        .not('primary_assignee_name', 'is', null),
      
      // BeGone företag
      supabase
        .from('business_cases')
        .select('primary_assignee_name, pris, completed_date')
        .eq('status', 'Avslutat')
        .not('completed_date', 'is', null)
        .not('primary_assignee_name', 'is', null),
      
      // Avtalskunder
      supabase
        .from('cases')
        .select('assigned_technician_name, price, completed_date')
        .not('completed_date', 'is', null)
        .not('assigned_technician_name', 'is', null)
    ])

    if (privateResult.error) throw privateResult.error
    if (businessResult.error) throw businessResult.error
    if (contractResult.error) throw contractResult.error

    const privateCases = privateResult.data || []
    const businessCases = businessResult.data || []
    const contractCases = contractResult.data || []

    console.log(`📊 Found cases: ${privateCases.length} private, ${businessCases.length} business, ${contractCases.length} contract`)

    // Debug: Visa exempel på tekniker-namn från data
    if (privateCases.length > 0) {
      console.log('🔍 Sample private case technician names:', privateCases.slice(0, 3).map(c => c.primary_assignee_name))
    }
    if (businessCases.length > 0) {
      console.log('🔍 Sample business case technician names:', businessCases.slice(0, 3).map(c => c.primary_assignee_name))
    }
    if (contractCases.length > 0) {
      console.log('🔍 Sample contract case technician names:', contractCases.slice(0, 3).map(c => c.assigned_technician_name))
    }

    // Debug: Visa tekniker från databasen
    console.log('🔍 Technicians from database:', technicians.map(t => t.name))

    // Bygga prestanda-data per tekniker
    const technicianMap = new Map<string, TechnicianPerformance>()

    // Initiera alla tekniker
    technicians.forEach(tech => {
      technicianMap.set(tech.name, {
        id: tech.id,
        name: tech.name,
        role: tech.role,
        email: tech.email,
        is_active: tech.is_active,
        private_cases: 0,
        business_cases: 0,
        contract_cases: 0,
        total_cases: 0,
        private_revenue: 0,
        business_revenue: 0,
        contract_revenue: 0,
        total_revenue: 0,
        avg_case_value: 0,
        rank: 0
      })
    })

    // Aggregera BeGone privatpersoner
    privateCases.forEach(case_ => {
      const techName = case_.primary_assignee_name?.trim()
      if (!techName) return
      
      const tech = technicianMap.get(techName)
      if (tech) {
        tech.private_cases++
        tech.private_revenue += case_.pris || 0
        console.log(`🔍 Added private case for ${techName}: ${case_.pris} kr`)
      } else {
        // Försök hitta tekniker med liknande namn (case-insensitive)
        const similarTech = Array.from(technicianMap.keys()).find(name => 
          name.toLowerCase() === techName.toLowerCase()
        )
        if (similarTech) {
          const tech = technicianMap.get(similarTech)!
          tech.private_cases++
          tech.private_revenue += case_.pris || 0
          console.log(`🔍 Added private case for ${similarTech} (matched ${techName}): ${case_.pris} kr`)
        } else {
          console.log(`⚠️ Unknown technician in private cases: "${techName}" - Available: ${Array.from(technicianMap.keys()).join(', ')}`)
        }
      }
    })

    // Aggregera BeGone företag
    businessCases.forEach(case_ => {
      const techName = case_.primary_assignee_name?.trim()
      if (!techName) return
      
      const tech = technicianMap.get(techName)
      if (tech) {
        tech.business_cases++
        tech.business_revenue += case_.pris || 0
        console.log(`🔍 Added business case for ${techName}: ${case_.pris} kr`)
      } else {
        // Försök hitta tekniker med liknande namn (case-insensitive)
        const similarTech = Array.from(technicianMap.keys()).find(name => 
          name.toLowerCase() === techName.toLowerCase()
        )
        if (similarTech) {
          const tech = technicianMap.get(similarTech)!
          tech.business_cases++
          tech.business_revenue += case_.pris || 0
          console.log(`🔍 Added business case for ${similarTech} (matched ${techName}): ${case_.pris} kr`)
        } else {
          console.log(`⚠️ Unknown technician in business cases: "${techName}" - Available: ${Array.from(technicianMap.keys()).join(', ')}`)
        }
      }
    })

    // Aggregera avtalskunder
    contractCases.forEach(case_ => {
      const techName = case_.assigned_technician_name?.trim()
      if (!techName) return
      
      const tech = technicianMap.get(techName)
      if (tech) {
        tech.contract_cases++
        tech.contract_revenue += case_.price || 0
        console.log(`🔍 Added contract case for ${techName}: ${case_.price} kr`)
      } else {
        // Försök hitta tekniker med liknande namn (case-insensitive)
        const similarTech = Array.from(technicianMap.keys()).find(name => 
          name.toLowerCase() === techName.toLowerCase()
        )
        if (similarTech) {
          const tech = technicianMap.get(similarTech)!
          tech.contract_cases++
          tech.contract_revenue += case_.price || 0
          console.log(`🔍 Added contract case for ${similarTech} (matched ${techName}): ${case_.price} kr`)
        } else {
          console.log(`⚠️ Unknown technician in contract cases: "${techName}" - Available: ${Array.from(technicianMap.keys()).join(', ')}`)
        }
      }
    })

    // Beräkna totaler och genomsnitt
    const technicianArray = Array.from(technicianMap.values()).map(tech => {
      tech.total_cases = tech.private_cases + tech.business_cases + tech.contract_cases
      tech.total_revenue = tech.private_revenue + tech.business_revenue + tech.contract_revenue
      tech.avg_case_value = tech.total_cases > 0 ? tech.total_revenue / tech.total_cases : 0
      return tech
    })

    // Sortera efter total intäkt och sätta rank
    technicianArray.sort((a, b) => b.total_revenue - a.total_revenue)
    technicianArray.forEach((tech, index) => {
      tech.rank = index + 1
    })

    console.log(`✅ getTechnicianPerformance completed for ${technicianArray.length} technicians`)
    return technicianArray

  } catch (error) {
    console.error('❌ Error in getTechnicianPerformance:', error)
    throw error
  }
}

// 3. Månadsvis Data - För trends och grafer
export const getTechnicianMonthlyData = async (monthsBack: number = 12): Promise<TechnicianMonthlyData[]> => {
  try {
    console.log(`🔍 getTechnicianMonthlyData: Getting last ${monthsBack} months...`)
    
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBack)
    const dateString = startDate.toISOString().split('T')[0]

    // Hämta alla avslutade ärenden från start-datum
    const [privateResult, businessResult, contractResult] = await Promise.all([
      supabase
        .from('private_cases')
        .select('primary_assignee_name, pris, completed_date')
        .eq('status', 'Avslutat')
        .gte('completed_date', dateString)
        .not('completed_date', 'is', null)
        .not('primary_assignee_name', 'is', null),
      
      supabase
        .from('business_cases')
        .select('primary_assignee_name, pris, completed_date')
        .eq('status', 'Avslutat')
        .gte('completed_date', dateString)
        .not('completed_date', 'is', null)
        .not('primary_assignee_name', 'is', null),
      
      supabase
        .from('cases')
        .select('assigned_technician_name, price, completed_date')
        .gte('completed_date', dateString)
        .not('completed_date', 'is', null)
        .not('assigned_technician_name', 'is', null)
    ])

    if (privateResult.error) throw privateResult.error
    if (businessResult.error) throw businessResult.error
    if (contractResult.error) throw contractResult.error

    // Aggregera per tekniker och månad
    const monthlyMap = new Map<string, TechnicianMonthlyData>()

    const addToMonthlyMap = (techName: string, completedDate: string, caseType: 'private' | 'business' | 'contract', revenue: number) => {
      const month = completedDate.slice(0, 7) // YYYY-MM
      const key = `${techName}-${month}`
      
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          technician_name: techName,
          month,
          private_cases: 0,
          business_cases: 0,
          contract_cases: 0,
          total_cases: 0,
          private_revenue: 0,
          business_revenue: 0,
          contract_revenue: 0,
          total_revenue: 0
        })
      }

      const data = monthlyMap.get(key)!
      
      if (caseType === 'private') {
        data.private_cases++
        data.private_revenue += revenue
      } else if (caseType === 'business') {
        data.business_cases++
        data.business_revenue += revenue
      } else if (caseType === 'contract') {
        data.contract_cases++
        data.contract_revenue += revenue
      }
    }

    // Processa alla case-typer
    privateResult.data?.forEach(case_ => {
      addToMonthlyMap(case_.primary_assignee_name, case_.completed_date, 'private', case_.pris || 0)
    })

    businessResult.data?.forEach(case_ => {
      addToMonthlyMap(case_.primary_assignee_name, case_.completed_date, 'business', case_.pris || 0)
    })

    contractResult.data?.forEach(case_ => {
      addToMonthlyMap(case_.assigned_technician_name, case_.completed_date, 'contract', case_.price || 0)
    })

    // Beräkna totaler och konvertera till array
    const monthlyArray = Array.from(monthlyMap.values()).map(data => {
      data.total_cases = data.private_cases + data.business_cases + data.contract_cases
      data.total_revenue = data.private_revenue + data.business_revenue + data.contract_revenue
      return data
    })

    // Sortera efter tekniker och månad
    monthlyArray.sort((a, b) => {
      if (a.technician_name !== b.technician_name) {
        return a.technician_name.localeCompare(b.technician_name)
      }
      return a.month.localeCompare(b.month)
    })

    console.log(`✅ getTechnicianMonthlyData completed: ${monthlyArray.length} records`)
    return monthlyArray

  } catch (error) {
    console.error('❌ Error in getTechnicianMonthlyData:', error)
    throw error
  }
}

// 4. Skadedjurs-specialisering
export const getPestSpecialization = async (): Promise<PestSpecialization[]> => {
  try {
    console.log('🔍 getPestSpecialization: Starting...')
    
    // Hämta alla avslutade ärenden med skadedjursinfo
    const [privateResult, businessResult, contractResult] = await Promise.all([
      supabase
        .from('private_cases')
        .select('primary_assignee_name, skadedjur, pris')
        .eq('status', 'Avslutat')
        .not('primary_assignee_name', 'is', null)
        .not('skadedjur', 'is', null),
      
      supabase
        .from('business_cases')
        .select('primary_assignee_name, skadedjur, pris')
        .eq('status', 'Avslutat')
        .not('primary_assignee_name', 'is', null)
        .not('skadedjur', 'is', null),
      
      supabase
        .from('cases')
        .select('assigned_technician_name, pest_type, price')
        .not('assigned_technician_name', 'is', null)
        .not('pest_type', 'is', null)
        .not('completed_date', 'is', null)
    ])

    if (privateResult.error) throw privateResult.error
    if (businessResult.error) throw businessResult.error
    if (contractResult.error) throw contractResult.error

    const specializationMap = new Map<string, PestSpecialization>()

    const addSpecialization = (techName: string, pestType: string, revenue: number, source: 'private' | 'business' | 'contract') => {
      // Rensa och normalisera skadedjursnamn
      const cleanPestType = pestType.trim().toLowerCase()
      const key = `${techName}-${cleanPestType}-${source}`
      
      if (!specializationMap.has(key)) {
        specializationMap.set(key, {
          technician_name: techName,
          pest_type: pestType.trim(), // Behåll original case
          case_count: 0,
          total_revenue: 0,
          avg_case_value: 0,
          source
        })
      }

      const spec = specializationMap.get(key)!
      spec.case_count++
      spec.total_revenue += revenue
    }

    // Processa alla data
    privateResult.data?.forEach(case_ => {
      addSpecialization(case_.primary_assignee_name, case_.skadedjur, case_.pris || 0, 'private')
    })

    businessResult.data?.forEach(case_ => {
      addSpecialization(case_.primary_assignee_name, case_.skadedjur, case_.pris || 0, 'business')
    })

    contractResult.data?.forEach(case_ => {
      addSpecialization(case_.assigned_technician_name, case_.pest_type, case_.price || 0, 'contract')
    })

    // Beräkna genomsnitt och konvertera till array
    const specializationArray = Array.from(specializationMap.values()).map(spec => {
      spec.avg_case_value = spec.case_count > 0 ? spec.total_revenue / spec.case_count : 0
      return spec
    })

    // Sortera efter total intäkt
    specializationArray.sort((a, b) => b.total_revenue - a.total_revenue)

    console.log(`✅ getPestSpecialization completed: ${specializationArray.length} specializations`)
    return specializationArray

  } catch (error) {
    console.error('❌ Error in getPestSpecialization:', error)
    throw error
  }
}