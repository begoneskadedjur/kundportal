// 📁 src/hooks/useTechnicianDashboard.ts - UPPDATERAD MED KORREKT IMPORT
import { useState, useEffect } from 'react'
import { 
  getTechnicianKpi,
  getTechnicianPerformance,
  getTechnicianMonthlyData,
  getPestSpecialization,
  type TechnicianKpi,
  type TechnicianPerformance,
  type TechnicianMonthlyData,
  type PestSpecialization
} from '../services/technicianAnalyticsService'  // 🆕 Uppdaterad import

// Huvudhook för tekniker dashboard
export const useTechnicianDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      // Trigger re-fetch av alla data
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering')
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, refetch }
}

// Hook för KPI data
export const useTechnicianKpi = () => {
  const [data, setData] = useState<TechnicianKpi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching technician KPI data...')
        
        const result = await getTechnicianKpi()
        setData(result)
        
        console.log('✅ Technician KPI data loaded successfully')
      } catch (err) {
        console.error('❌ useTechnicianKpi error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI data')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Hook för tekniker prestanda
export const useTechnicianPerformance = () => {
  const [data, setData] = useState<TechnicianPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching technician performance data...')
        
        const result = await getTechnicianPerformance()
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded ${result.length} technician performance records`)
      } catch (err) {
        console.error('❌ useTechnicianPerformance error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av prestanda data')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Hook för månadsvis data med period-filtrering
export const useTechnicianMonthlyData = (monthsBack: number = 12) => {
  const [data, setData] = useState<TechnicianMonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log(`🔄 Fetching monthly data for last ${monthsBack} months...`)
        
        const result = await getTechnicianMonthlyData(monthsBack)
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded ${result.length} monthly data records`)
      } catch (err) {
        console.error('❌ useTechnicianMonthlyData error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av månadsdata')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monthsBack])

  return { data, loading, error }
}

// Hook för skadedjurs-specialisering
export const usePestSpecialization = () => {
  const [data, setData] = useState<PestSpecialization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching pest specialization data...')
        
        const result = await getPestSpecialization()
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded ${result.length} pest specialization records`)
      } catch (err) {
        console.error('❌ usePestSpecialization error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av specialisering data')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

// Kombinerad hook för komplett dashboard data
export const useCompleteTechnicianDashboard = () => {
  const kpi = useTechnicianKpi()
  const performance = useTechnicianPerformance()
  const monthlyData = useTechnicianMonthlyData(12)
  const pestData = usePestSpecialization()

  const loading = kpi.loading || performance.loading || monthlyData.loading || pestData.loading
  const error = kpi.error || performance.error || monthlyData.error || pestData.error

  return {
    kpi: kpi.data,
    performance: performance.data,
    monthlyData: monthlyData.data,
    pestSpecialization: pestData.data,
    loading,
    error
  }
}

// Hook för individuell tekniker-analys - UPPDATERAD
export const useIndividualTechnician = (technicianName: string) => {
  const { performance, monthlyData, pestSpecialization } = useCompleteTechnicianDashboard()
  
  const technicianPerformance = performance.find(t => t.name === technicianName)
  const technicianMonthlyData = monthlyData.filter(m => m.technician_name === technicianName)
  const technicianPestData = pestSpecialization.filter(p => p.technician_name === technicianName)

  return {
    performance: technicianPerformance,
    monthlyData: technicianMonthlyData,
    pestSpecialization: technicianPestData,
    isValid: !!technicianPerformance
  }
}0,
          avg_case_value_all: totalCases > 0 ? totalRevenue / totalCases : 0
        }

        setData(kpiData)
      } catch (err) {
        console.error('❌ useTechnicianKpi error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI data')
      } finally {
        setLoading(false)
      }
    }

    fetchKpiData()
  }, [])

  return { data, loading, error }
}

// 🎯 2. Performance Ranking Hook
export const useTechnicianPerformance = () => {
  const [data, setData] = useState<TechnicianPerformanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Hämta alla tekniker
        const { data: technicians, error: techError } = await supabase
          .from('technicians')
          .select('id, name, role, email, is_active')
          .eq('is_active', true)

        if (techError) throw techError
        if (!technicians?.length) {
          setData([])
          return
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

        setData(sortedData)
      } catch (err) {
        console.error('❌ useTechnicianPerformance error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av prestanda-data')
      } finally {
        setLoading(false)
      }
    }

    fetchPerformanceData()
  }, [])

  return { data, loading, error }
}

// 🎯 3. Monthly Performance Hook
export const useTechnicianMonthlyData = (months: number = 12) => {
  const [data, setData] = useState<TechnicianMonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMonthlyData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Beräkna datumintervall
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(startDate.getMonth() - months)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        // Hämta tekniker
        const { data: technicians, error: techError } = await supabase
          .from('technicians')
          .select('id, name')
          .eq('is_active', true)

        if (techError) throw techError
        if (!technicians?.length) {
          setData([])
          return
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
          (privateMonthly || []).forEach(c => {
            const month = c.created_at.substring(0, 7) // YYYY-MM
            if (!monthlyMap.has(month)) {
              monthlyMap.set(month, { private: 0, business: 0, contract: 0, cases: 0 })
            }
            const monthData = monthlyMap.get(month)!
            monthData.private += c.pris || 0
            monthData.cases += 1
          })

          // Processera business cases
          (businessMonthly || []).forEach(c => {
            const month = c.created_at.substring(0, 7)
            if (!monthlyMap.has(month)) {
              monthlyMap.set(month, { private: 0, business: 0, contract: 0, cases: 0 })
            }
            const monthData = monthlyMap.get(month)!
            monthData.business += c.pris || 0
            monthData.cases += 1
          })

          // Processera contract cases
          (contractMonthly || []).forEach(c => {
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
        setData(allMonthlyData)
      } catch (err) {
        console.error('❌ useTechnicianMonthlyData error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av månadsdata')
      } finally {
        setLoading(false)
      }
    }

    fetchMonthlyData()
  }, [months])

  return { data, loading, error }
}

// 🎯 4. Pest Specialization Hook - FIXAD
export const usePestSpecialization = () => {
  const [data, setData] = useState<PestSpecializationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPestData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Hämta tekniker
        const { data: technicians, error: techError } = await supabase
          .from('technicians')
          .select('id, name')
          .eq('is_active', true)

        if (techError) throw techError
        if (!technicians?.length) {
          setData([])
          return
        }

        const pestDataPromises = technicians.map(async (tech) => {
          const pestSpecializations: PestSpecializationData[] = []

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
        setData(allPestData)
      } catch (err) {
        console.error('❌ usePestSpecialization error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av specialiseringsdata')
      } finally {
        setLoading(false)
      }
    }

    fetchPestData()
  }, [])

  return { data, loading, error }
}

// 🎯 5. Individual Technician Hook - NY
export const useIndividualTechnician = (technicianId: string | null) => {
  const [data, setData] = useState<IndividualTechnicianData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!technicianId) {
      setData(null)
      return
    }

    const fetchIndividualData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Hämta grundläggande tekniker-info
        const { data: technician, error: techError } = await supabase
          .from('technicians')
          .select('*')
          .eq('id', technicianId)
          .single()

        if (techError) throw techError

        // Hämta prestanda-data för denna tekniker
        const performanceHook = useTechnicianPerformance()
        // Vänta på att performance data laddas
        await new Promise(resolve => {
          const checkData = () => {
            if (!performanceHook.loading) {
              resolve(undefined)
            } else {
              setTimeout(checkData, 100)
            }
          }
          checkData()
        })

        const technicianPerformance = performanceHook.data.find(t => t.id === technicianId)
        if (!technicianPerformance) throw new Error('Tekniker inte hittad i prestanda-data')

        // Hämta månadsdata för senaste 12 månaderna
        const monthlyHook = useTechnicianMonthlyData(12)
        await new Promise(resolve => {
          const checkData = () => {
            if (!monthlyHook.loading) {
              resolve(undefined)
            } else {
              setTimeout(checkData, 100)
            }
          }
          checkData()
        })

        const monthlyTrends = monthlyHook.data.filter(m => m.technician_name === technician.name)

        // Hämta specialiseringsdata
        const pestHook = usePestSpecialization()
        await new Promise(resolve => {
          const checkData = () => {
            if (!pestHook.loading) {
              resolve(undefined)
            } else {
              setTimeout(checkData, 100)
            }
          }
          checkData()
        })

        const pestSpecializations = pestHook.data.filter(p => p.technician_name === technician.name)

        // Beräkna jämförelse med team
        const teamAvgRevenue = performanceHook.data.reduce((sum, t) => sum + t.total_revenue, 0) / performanceHook.data.length
        const teamAvgCases = performanceHook.data.reduce((sum, t) => sum + t.total_cases, 0) / performanceHook.data.length
        const teamAvgCaseValue = performanceHook.data.reduce((sum, t) => sum + t.avg_case_value, 0) / performanceHook.data.length

        // Hämta topp-ärenden för denna tekniker
        const [topPrivateCases, topBusinessCases, topContractCases] = await Promise.all([
          supabase
            .from('private_cases')
            .select('id, title, pris, created_at')
            .eq('primary_assignee_id', technicianId)
            .eq('status', 'Avslutat')
            .not('pris', 'is', null)
            .order('pris', { ascending: false })
            .limit(3),
          
          supabase
            .from('business_cases')
            .select('id, title, pris, created_at')
            .eq('primary_assignee_id', technicianId)
            .eq('status', 'Avslutat')
            .not('pris', 'is', null)
            .order('pris', { ascending: false })
            .limit(3),
          
          supabase
            .from('cases')
            .select('id, title, price, created_at')
            .eq('assigned_technician_id', technicianId)
            .in('status', ['Avslutat', 'Genomförd', 'Klar'])
            .not('price', 'is', null)
            .order('price', { ascending: false })
            .limit(3)
        ])

        const topCases = [
          ...(topPrivateCases.data || []).map(c => ({
            case_id: c.id,
            title: c.title,
            revenue: c.pris || 0,
            date: c.created_at,
            source: 'BeGone Privatperson'
          })),
          ...(topBusinessCases.data || []).map(c => ({
            case_id: c.id,
            title: c.title,
            revenue: c.pris || 0,
            date: c.created_at,
            source: 'BeGone Företag'
          })),
          ...(topContractCases.data || []).map(c => ({
            case_id: c.id,
            title: c.title,
            revenue: c.price || 0,
            date: c.created_at,
            source: 'Avtalskund'
          }))
        ].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

        const individualData: IndividualTechnicianData = {
          technician: technicianPerformance,
          monthly_trends: monthlyTrends,
          pest_specializations: pestSpecializations,
          comparison_metrics: {
            revenue_vs_team_avg: teamAvgRevenue > 0 ? (technicianPerformance.total_revenue - teamAvgRevenue) / teamAvgRevenue * 100 : 0,
            cases_vs_team_avg: teamAvgCases > 0 ? (technicianPerformance.total_cases - teamAvgCases) / teamAvgCases * 100 : 0,
            avg_case_value_vs_team: teamAvgCaseValue > 0 ? (technicianPerformance.avg_case_value - teamAvgCaseValue) / teamAvgCaseValue * 100 : 0,
            rank_change_last_3_months: 0 // TODO: Implementera ranking-historik
          },
          top_cases: topCases
        }

        setData(individualData)
      } catch (err) {
        console.error('❌ useIndividualTechnician error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av individuell tekniker-data')
      } finally {
        setLoading(false)
      }
    }

    fetchIndividualData()
  }, [technicianId])

  return { data, loading, error }
}