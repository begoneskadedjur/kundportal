// 📁 src/hooks/useProvisionDashboard.ts - HOOKS FÖR PROVISION SYSTEMET
import { useState, useEffect, useMemo } from 'react'
import { 
  calculateTechnicianProvisions,
  getMonthlyProvisionSummary,
  getProvisionGraphData,
  getTechnicianProvisionDetails,
  getProvisionKpiSummary,
  getProvisionCases,
  type TechnicianProvision,
  type MonthlyProvisionSummary,
  type ProvisionGraphData,
  type ProvisionCase
} from '../services/provisionService'

// Huvudhook för provision dashboard
export const useProvisionDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      // Trigga re-fetch av alla data
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering')
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, refetch }
}

// Hook för provision KPI data
export const useProvisionKpi = (monthsBack: number = 12) => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching provision KPI data...')
        
        const result = await getProvisionKpiSummary(monthsBack)
        setData(result)
        
        console.log('✅ Provision KPI data loaded successfully')
      } catch (err) {
        console.error('❌ useProvisionKpi error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av provision KPI')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monthsBack])

  return { data, loading, error }
}

// Hook för tekniker provisioner
export const useTechnicianProvisions = (monthsBack: number = 12) => {
  const [data, setData] = useState<TechnicianProvision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching technician provisions...')
        
        const result = await calculateTechnicianProvisions(monthsBack)
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded ${result.length} technician provisions`)
      } catch (err) {
        console.error('❌ useTechnicianProvisions error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av tekniker provisioner')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monthsBack])

  return { data, loading, error }
}

// Hook för månadsvis provision sammanfattning
export const useMonthlyProvisionSummary = (monthsBack: number = 12) => {
  const [data, setData] = useState<MonthlyProvisionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching monthly provision summary...')
        
        const result = await getMonthlyProvisionSummary(monthsBack)
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded ${result.length} monthly provision summaries`)
      } catch (err) {
        console.error('❌ useMonthlyProvisionSummary error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av månadsvis provision sammanfattning')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monthsBack])

  return { data, loading, error }
}

// Hook för provision graf data med tekniker-filter
export const useProvisionGraphData = (
  monthsBack: number = 12, 
  selectedTechnicians: string[] = []
) => {
  const [data, setData] = useState<ProvisionGraphData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching provision graph data...')
        
        const result = await getProvisionGraphData(
          monthsBack, 
          selectedTechnicians.length > 0 ? selectedTechnicians : undefined
        )
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded graph data for ${result.length} months`)
      } catch (err) {
        console.error('❌ useProvisionGraphData error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av graf data')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monthsBack, selectedTechnicians])

  return { data, loading, error }
}

// Hook för enskild tekniker provision detaljer
export const useTechnicianProvisionDetails = (
  technicianId: string, 
  monthsBack: number = 12
) => {
  const [data, setData] = useState<TechnicianProvision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!technicianId) {
      setData(null)
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log(`🔄 Fetching provision details for technician ${technicianId}...`)
        
        const result = await getTechnicianProvisionDetails(technicianId, monthsBack)
        setData(result)
        
        console.log('✅ Loaded technician provision details')
      } catch (err) {
        console.error('❌ useTechnicianProvisionDetails error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av tekniker detaljer')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [technicianId, monthsBack])

  return { data, loading, error }
}

// Hook för alla provision ärenden med filter-möjligheter
export const useProvisionCases = (
  monthsBack: number = 12,
  technicianId?: string,
  filters?: {
    source?: 'private' | 'business'
    minAmount?: number
    maxAmount?: number
    startDate?: string
    endDate?: string
  }
) => {
  const [data, setData] = useState<ProvisionCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtrera data baserat på filters
  const filteredData = useMemo(() => {
    if (!filters) return data

    return data.filter(case_ => {
      // Source filter
      if (filters.source && case_.source !== filters.source) return false
      
      // Amount filters
      if (filters.minAmount !== undefined && (case_.pris || 0) < filters.minAmount) return false
      if (filters.maxAmount !== undefined && (case_.pris || 0) > filters.maxAmount) return false
      
      // Date filters
      if (filters.startDate && case_.completed_date < filters.startDate) return false
      if (filters.endDate && case_.completed_date > filters.endDate) return false
      
      return true
    })
  }, [data, filters])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🔄 Fetching provision cases...')
        
        const result = await getProvisionCases(monthsBack, technicianId)
        setData(Array.isArray(result) ? result : [])
        
        console.log(`✅ Loaded ${result.length} provision cases`)
      } catch (err) {
        console.error('❌ useProvisionCases error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av provision ärenden')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monthsBack, technicianId])

  return { 
    data: filteredData, 
    rawData: data,
    loading, 
    error,
    totalCases: filteredData.length,
    totalRevenue: filteredData.reduce((sum, c) => sum + (c.pris || 0), 0),
    totalProvision: filteredData.reduce((sum, c) => sum + ((c.pris || 0) * 0.05), 0)
  }
}

// Hook för komplett provision dashboard data
export const useCompleteProvisionDashboard = (monthsBack: number = 12) => {
  const kpi = useProvisionKpi(monthsBack)
  const technicianProvisions = useTechnicianProvisions(monthsBack)
  const monthlySummary = useMonthlyProvisionSummary(monthsBack)
  const graphData = useProvisionGraphData(monthsBack)

  const loading = kpi.loading || technicianProvisions.loading || monthlySummary.loading || graphData.loading
  const error = kpi.error || technicianProvisions.error || monthlySummary.error || graphData.error

  // Beräkna ytterligare insights
  const insights = useMemo(() => {
    if (!technicianProvisions.data.length || !monthlySummary.data.length) {
      return null
    }

    const currentMonth = new Date().toISOString().slice(0, 7)
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const lastMonthKey = lastMonth.toISOString().slice(0, 7)

    const currentMonthSummary = monthlySummary.data.find(m => m.month === currentMonth)
    const lastMonthSummary = monthlySummary.data.find(m => m.month === lastMonthKey)

    const monthOverMonthChange = lastMonthSummary && lastMonthSummary.total_provision > 0
      ? ((currentMonthSummary?.total_provision || 0) - lastMonthSummary.total_provision) / lastMonthSummary.total_provision * 100
      : 0

    // Topp 3 tekniker
    const topTechnicians = technicianProvisions.data
      .slice(0, 3)
      .map(t => ({
        name: t.technician_name,
        provision: t.total_provision_amount,
        cases: t.total_cases
      }))

    // Månad med högst provision
    const bestMonth = monthlySummary.data
      .reduce((best, current) => 
        (current.total_provision > (best?.total_provision || 0)) ? current : best, 
        monthlySummary.data[0]
      )

    return {
      monthOverMonthChange,
      topTechnicians,
      bestMonth: bestMonth ? {
        month: bestMonth.month,
        provision: bestMonth.total_provision,
        cases: bestMonth.total_cases
      } : null,
      averageProvisionPerCase: kpi.data?.total_revenue_ytd && kpi.data.total_revenue_ytd > 0
        ? (kpi.data.total_provision_ytd / kpi.data.total_revenue_ytd) * 100
        : 0
    }
  }, [technicianProvisions.data, monthlySummary.data, kpi.data])

  return {
    kpi: kpi.data,
    technicianProvisions: technicianProvisions.data,
    monthlySummary: monthlySummary.data,
    graphData: graphData.data,
    insights,
    loading,
    error
  }
}

// Hook för tekniker-lista med provision info
export const useTechniciansList = () => {
  const [technicians, setTechnicians] = useState<Array<{
    id: string
    name: string
    email: string | null
    is_active: boolean
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Importera supabase direkt här för att undvika cirkelberoende
        const { supabase } = await import('../lib/supabase')
        
        const { data, error: fetchError } = await supabase
          .from('technicians')
          .select('id, name, email, is_active')
          .eq('is_active', true)
          .order('name')

        if (fetchError) throw fetchError

        setTechnicians(data || [])
        console.log(`✅ Loaded ${data?.length || 0} active technicians`)
      } catch (err) {
        console.error('❌ useTechniciansList error:', err)
        setError(err instanceof Error ? err.message : 'Fel vid hämtning av tekniker-lista')
        setTechnicians([])
      } finally {
        setLoading(false)
      }
    }

    fetchTechnicians()
  }, [])

  return { data: technicians, loading, error }
}

// Hook för provision statistics och trends
export const useProvisionStatistics = (monthsBack: number = 12) => {
  const { monthlySummary, technicianProvisions } = useCompleteProvisionDashboard(monthsBack)

  const statistics = useMemo(() => {
    if (!monthlySummary.length || !technicianProvisions.length) {
      return null
    }

    // Beräkna trends
    const recentMonths = monthlySummary.slice(-6) // Senaste 6 månaderna
    const provisionTrend = recentMonths.map(m => m.total_provision)
    
    // Enkel trend-beräkning (stigande/fallande)
    const isIncreasing = provisionTrend.length >= 2 && 
      provisionTrend[provisionTrend.length - 1] > provisionTrend[provisionTrend.length - 2]

    // Genomsnittlig provision per månad
    const averageMonthlyProvision = monthlySummary.length > 0
      ? monthlySummary.reduce((sum, m) => sum + m.total_provision, 0) / monthlySummary.length
      : 0

    // Tekniker med högst variation i provision
    const technicianVariations = technicianProvisions.map(tech => {
      const monthlyAmounts = tech.monthly_breakdown.map(m => m.provision_amount)
      const average = monthlyAmounts.reduce((sum, a) => sum + a, 0) / monthlyAmounts.length
      const variance = monthlyAmounts.reduce((sum, a) => sum + Math.pow(a - average, 2), 0) / monthlyAmounts.length
      
      return {
        name: tech.technician_name,
        variance: Math.sqrt(variance),
        average
      }
    }).sort((a, b) => b.variance - a.variance)

    // Säsongsanalys
    const monthlyAverages = new Array(12).fill(0)
    const monthlyCounts = new Array(12).fill(0)
    
    monthlySummary.forEach(m => {
      const monthIndex = parseInt(m.month.split('-')[1]) - 1
      monthlyAverages[monthIndex] += m.total_provision
      monthlyCounts[monthIndex]++
    })

    const seasonalData = monthlyAverages.map((total, index) => ({
      month: index + 1,
      averageProvision: monthlyCounts[index] > 0 ? total / monthlyCounts[index] : 0
    }))

    return {
      trend: {
        isIncreasing,
        direction: isIncreasing ? 'up' : 'down',
        recentMonths: provisionTrend
      },
      averageMonthlyProvision,
      mostVariableTechnicians: technicianVariations.slice(0, 3),
      seasonalData,
      totalUniqueMonths: monthlySummary.length,
      consistency: {
        mostConsistent: technicianVariations[technicianVariations.length - 1],
        leastConsistent: technicianVariations[0]
      }
    }
  }, [monthlySummary, technicianProvisions])

  return statistics
}