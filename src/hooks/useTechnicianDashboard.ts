// 📁 src/hooks/useTechnicianDashboard.ts - REACT HOOKS FÖR TEKNIKER DATA
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
} from '../services/technicianService'

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

// Hook för individuell tekniker-analys
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
}